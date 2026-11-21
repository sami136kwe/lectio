"use client";

import { LectioCard, toSpeakable } from "@/components/LectioCard";
import { SpeakButton } from "@/components/SpeakButton";
import { VoicePicker } from "@/components/VoicePicker";
import type { CardSummary } from "@/lib/cards";
import { useReadAloud } from "@/lib/tts/useReadAloud";

/** A card with its own listen button and voice picker (used on the card page). */
export function ReadableCard({ card, children }: { card: CardSummary; children?: React.ReactNode }) {
  const audio = useReadAloud(toSpeakable(card));
  return (
    <LectioCard card={card} headingLevel="h1" reading={audio.reading}>
      <div className="flex flex-wrap items-center gap-3">
        <SpeakButton state={audio.state} onToggle={audio.toggle} />
        <VoicePicker language={audio.language} voice={audio.voice} onChange={audio.setVoice} />
        {children}
      </div>
    </LectioCard>
  );
}
