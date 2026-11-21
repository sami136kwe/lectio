import type { Metadata } from "next";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer, requireOnboardedUser } from "@/lib/session";
import { DeckReader } from "./DeckReader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor((await getViewer()).locale).deck.title };
}

export default async function DeckPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await requireOnboardedUser("/deck");
  const day = (await searchParams).day;
  return <DeckReader day={day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null} />;
}
