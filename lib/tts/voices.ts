export type TtsLanguage = "fr" | "en";
export type TtsEngine = "edge" | "kokoro";

export type TtsVoice = { id: string; label: string; language: TtsLanguage; engine: TtsEngine };

/**
 * Voices offered in the app. The server only accepts ids from this list.
 * - edge:   Microsoft Edge neural voices (online, no setup)
 * - kokoro: local Kokoro server (`npm run tts:kokoro`), much faster, offline
 */
export const VOICES: TtsVoice[] = [
  { id: "kokoro:ff_siwis", label: "Siwis · femme (local, rapide)", language: "fr", engine: "kokoro" },
  { id: "fr-FR-RemyMultilingualNeural", label: "Rémy (Edge)", language: "fr", engine: "edge" },
  { id: "fr-FR-VivienneMultilingualNeural", label: "Vivienne (Edge)", language: "fr", engine: "edge" },
  { id: "fr-FR-HenriNeural", label: "Henri (Edge)", language: "fr", engine: "edge" },
  { id: "fr-FR-DeniseNeural", label: "Denise (Edge)", language: "fr", engine: "edge" },
  { id: "fr-CA-AntoineNeural", label: "Antoine (Edge, QC)", language: "fr", engine: "edge" },
  { id: "fr-CA-SylvieNeural", label: "Sylvie (Edge, QC)", language: "fr", engine: "edge" },
  { id: "fr-CA-JeanNeural", label: "Jean (Edge, QC)", language: "fr", engine: "edge" },
  { id: "kokoro:af_heart", label: "Heart · woman (local, fast)", language: "en", engine: "kokoro" },
  { id: "kokoro:af_bella", label: "Bella · woman (local, fast)", language: "en", engine: "kokoro" },
  { id: "kokoro:bf_emma", label: "Emma · woman, British (local, fast)", language: "en", engine: "kokoro" },
  { id: "kokoro:am_michael", label: "Michael · man (local, fast)", language: "en", engine: "kokoro" },
  { id: "kokoro:am_adam", label: "Adam · man (local, fast)", language: "en", engine: "kokoro" },
  { id: "kokoro:bm_george", label: "George · man, British (local, fast)", language: "en", engine: "kokoro" },
  { id: "en-US-AriaNeural", label: "Aria (Edge, US)", language: "en", engine: "edge" },
  { id: "en-US-GuyNeural", label: "Guy (Edge, US)", language: "en", engine: "edge" },
  { id: "en-US-EmmaMultilingualNeural", label: "Emma (Edge, US)", language: "en", engine: "edge" },
  { id: "en-GB-SoniaNeural", label: "Sonia (Edge, UK)", language: "en", engine: "edge" },
  { id: "en-GB-RyanNeural", label: "Ryan (Edge, UK)", language: "en", engine: "edge" },
];

export const VOICE_IDS = VOICES.map((v) => v.id) as [string, ...string[]];

export const isKokoroVoice = (id: string) => id.startsWith("kokoro:");

/** Voices of a language; Kokoro voices only when the local server is reachable. */
export function voicesFor(language: TtsLanguage, kokoroAvailable = false): TtsVoice[] {
  return VOICES.filter((v) => v.language === language && (kokoroAvailable || v.engine !== "kokoro"));
}

/** The fast local voice when available, otherwise the first Edge voice. */
export function defaultVoice(language: TtsLanguage, kokoroAvailable = false): string {
  return voicesFor(language, kokoroAvailable)[0]!.id;
}

/** Returns `id` when it is an available voice of this language, otherwise the default. */
export function validVoice(language: TtsLanguage, id: string | null | undefined, kokoroAvailable = false): string {
  return voicesFor(language, kokoroAvailable).some((v) => v.id === id) ? id! : defaultVoice(language, kokoroAvailable);
}

/** Second voice of the same engine, used for the Bible text so it is heard apart from the commentary. */
export function companionVoice(language: TtsLanguage, voice: string, kokoroAvailable = false): string {
  const current = VOICES.find((v) => v.id === voice);
  const other = voicesFor(language, kokoroAvailable).find((v) => v.id !== voice && v.engine === current?.engine);
  return other?.id ?? voice;
}
