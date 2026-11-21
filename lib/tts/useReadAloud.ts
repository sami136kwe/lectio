"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useTtsCapabilities } from "./capabilities";
import { prefetchAudio, ReadAloudPlayer, type PlayerState } from "./player";
import { useVoicePref } from "./prefs";
import { buildSegments, buildUnits, type ReadingPosition, type SpeakableCard } from "./segment";
import { companionVoice, type TtsLanguage } from "./voices";

type Card = SpeakableCard & { language: string };

/** Read-aloud state for one card: toggle, current sentence, voice choice. */
export function useReadAloud(card: Card | undefined, options: { autoPlay?: boolean } = {}) {
  const t = useT();
  const language: TtsLanguage = card?.language === "en" ? "en" : "fr";
  const { kokoro } = useTtsCapabilities();
  const [voice, setVoice] = useVoicePref(language, kokoro);
  const scriptureVoice = companionVoice(language, voice, kokoro);
  const [state, setState] = useState<PlayerState>("idle");
  const [reading, setReading] = useState<ReadingPosition | null>(null);
  const playerRef = useRef<ReadAloudPlayer | null>(null);

  const versesKey = card?.verses.join("\n");
  const units = useMemo(
    () => (card ? buildUnits(card, t.common.actionToday, language) : []),
    // Rebuild only when the card text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card?.reference, versesKey, card?.plain_explanation, card?.action_step, language, t.common.actionToday],
  );

  const getPlayer = useCallback(() => {
    if (!playerRef.current) {
      playerRef.current = new ReadAloudPlayer({
        language,
        voice,
        scriptureVoice,
        onUnit: (unit) => setReading(unit ? { part: unit.part, index: unit.index } : null),
        onState: setState,
      });
    }
    playerRef.current.setVoice(voice, scriptureVoice);
    return playerRef.current;
  }, [language, voice, scriptureVoice]);

  const stop = useCallback(() => playerRef.current?.stop(), []);
  const segments = useMemo(() => buildSegments(units), [units]);
  const start = useCallback(() => void getPlayer().start(segments), [getPlayer, segments]);

  /** Requests the first segments of another card, so it starts instantly when it is read next. */
  const prefetch = useCallback(
    (next: Card | undefined) => {
      if (!next) return;
      const nextLanguage: TtsLanguage = next.language === "en" ? "en" : "fr";
      const nextSegments = buildSegments(buildUnits(next, t.common.actionToday, nextLanguage));
      for (const segment of nextSegments.slice(0, 2)) prefetchAudio(segment.text, segment.role === "scripture" ? scriptureVoice : voice).catch(() => undefined);
    },
    [t, voice, scriptureVoice],
  );
  const toggle = useCallback(() => (state === "idle" ? start() : stop()), [state, start, stop]);

  // Changing card (or leaving the page) always stops the current reading.
  useEffect(() => {
    const player = playerRef.current;
    return () => player?.stop();
  }, [card?.reference]);
  useEffect(
    () => () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    },
    [],
  );

  const autoPlay = options.autoPlay ?? false;
  useEffect(() => {
    if (!autoPlay || !card) return;
    const timer = window.setTimeout(start, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, card?.reference]);

  return { state, reading, toggle, stop, prefetch, voice, setVoice, language };
}
