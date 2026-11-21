import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadableCard } from "@/components/ReadableCard";
import { LearnButton } from "@/components/LearnButton";
import { StashButton } from "@/components/StashButton";
import { cardById } from "@/lib/cards";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/api";

type Params = { params: Promise<{ id: string }> };

async function loadCard(id: string, language: "fr" | "en") {
  if (!uuidSchema.safeParse(id).success) return null;
  return cardById(await createClient(), id, language);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await getViewer();
  const card = await loadCard((await params).id, locale);
  if (!card) return {};
  return { title: card.reference, description: card.action_step ?? undefined, openGraph: { title: card.reference, description: card.plain_explanation ?? undefined } };
}

export default async function CardPage({ params }: Params) {
  const { id } = await params;
  const { user, locale } = await getViewer();
  const card = await loadCard(id, locale);
  if (!card) notFound();
  let stashed = false;
  if (user) {
    const supabase = await createClient();
    const { count } = await supabase.from("stashes").select("card_id", { count: "exact", head: true }).eq("user_id", user.id).eq("card_id", id);
    stashed = (count ?? 0) > 0;
  }
  return (
    <div className="mx-auto max-w-2xl">
      <ReadableCard card={card}>
        {user && (
          <>
            <StashButton cardId={card.id!} initiallyStashed={stashed} />
            <LearnButton cardId={card.id!} />
          </>
        )}
      </ReadableCard>
    </div>
  );
}
