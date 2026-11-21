"use client";

import { speakable, unitAtFraction, type ReadingUnit, type Segment } from "./segment";
import type { TtsLanguage } from "./voices";

export type PlayerState = "idle" | "loading" | "playing";

type Options = {
  language: TtsLanguage;
  voice: string;
  /** Voice for the Bible text (segments with role "scripture"). */
  scriptureVoice: string;
  onUnit: (unit: ReadingUnit | null) => void;
  onState: (state: PlayerState) => void;
};

/** 0.1 s of silence: playing it inside the click handler unlocks audio on Safari/iOS. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
/** How many segments are requested ahead of the one being played. */
const PREFETCH_AHEAD = 2;
/** Past this, a segment is read with the browser's own voice instead of waiting. */
const FETCH_TIMEOUT_MS = 15_000;
const MAX_CACHED = 12;

// Object URLs of fetched audio, shared by every player (so a card prefetched
// while the previous one plays starts instantly).
const urlCache = new Map<string, Promise<string>>();

async function fetchUrl(text: string, voice: string): Promise<string> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

/** Starts (or reuses) the request for one segment's audio. */
export function prefetchAudio(text: string, voice: string): Promise<string> {
  const key = `${voice}|${text}`;
  let promise = urlCache.get(key);
  if (!promise) {
    promise = fetchUrl(text, voice);
    promise.catch(() => urlCache.delete(key));
    urlCache.set(key, promise);
    while (urlCache.size > MAX_CACHED) {
      const [oldKey, oldPromise] = urlCache.entries().next().value!;
      urlCache.delete(oldKey);
      void oldPromise.then((url) => URL.revokeObjectURL(url), () => undefined);
    }
  }
  return promise;
}

/**
 * Reads a card segment by segment. The next segments are requested while the
 * current one plays, the sentence being spoken is reported from the playback
 * position, and a segment that cannot be fetched is read with the browser's voice.
 */
export class ReadAloudPlayer {
  private audio = new Audio();
  private segments: Segment[] = [];
  private run = 0;

  constructor(private options: Options) {}

  setVoice(voice: string, scriptureVoice: string = voice) {
    this.options = { ...this.options, voice, scriptureVoice };
  }

  private voiceFor(segment: Segment): string {
    return segment.role === "scripture" ? this.options.scriptureVoice : this.options.voice;
  }

  /** Must be called from a user gesture (click) to be allowed on Safari. */
  async start(segments: Segment[]) {
    this.stop();
    const run = ++this.run;
    this.segments = segments;
    this.options.onState("loading");
    // Start the network work first, in parallel with the audio unlock below.
    for (let i = 0; i <= PREFETCH_AHEAD; i++) this.request(i);
    this.audio.src = SILENCE;
    await this.audio.play().catch(() => undefined);
    void this.playFrom(0, run);
  }

  stop() {
    this.run += 1;
    this.audio.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    this.options.onUnit(null);
    this.options.onState("idle");
  }

  private request(index: number): Promise<string> | null {
    const segment = this.segments[index];
    if (!segment) return null;
    const promise = prefetchAudio(segment.text, this.voiceFor(segment));
    promise.catch(() => undefined);
    return promise;
  }

  private async playFrom(index: number, run: number): Promise<void> {
    if (run !== this.run) return;
    const segment = this.segments[index];
    if (!segment) {
      this.finish(run);
      return;
    }
    const current = this.request(index);
    for (let ahead = 1; ahead <= PREFETCH_AHEAD; ahead++) this.request(index + ahead);

    let played = false;
    try {
      const url = await current;
      if (run !== this.run || !url) return;
      played = await this.playUrl(url, segment, run);
    } catch {
      if (run !== this.run) return;
    }
    if (run !== this.run) return;
    if (!played) await this.speakWithBrowser(segment, run);
    if (run !== this.run) return;
    void this.playFrom(index + 1, run);
  }

  private playUrl(url: string, segment: Segment, run: number): Promise<boolean> {
    return new Promise((resolve) => {
      const audio = this.audio;
      let last = -1;
      const report = () => {
        const duration = audio.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const index = unitAtFraction(segment.units, audio.currentTime / duration);
        if (index !== last) {
          last = index;
          this.options.onUnit(segment.units[index] ?? null);
        }
      };
      audio.ontimeupdate = report;
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.src = url;
      this.options.onUnit(segment.units[0] ?? null);
      this.options.onState("playing");
      audio.play().catch((error: unknown) => {
        // Autoplay refused (no user gesture yet): stop quietly instead of falling back.
        if (error instanceof DOMException && error.name === "NotAllowedError" && run === this.run) this.stop();
        resolve(false);
      });
    });
  }

  private async speakWithBrowser(segment: Segment, run: number): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    for (const unit of segment.units) {
      if (run !== this.run) return;
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(speakable(unit.text));
        utterance.lang = this.options.language === "fr" ? "fr-FR" : "en-US";
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        this.options.onUnit(unit);
        this.options.onState("playing");
        window.speechSynthesis.speak(utterance);
      });
    }
  }

  private finish(run: number) {
    if (run !== this.run) return;
    this.options.onUnit(null);
    this.options.onState("idle");
  }

  destroy() {
    this.stop();
    this.audio.removeAttribute("src");
  }
}
