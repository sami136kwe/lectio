import type { Metadata } from "next";
import { LectioCard } from "@/components/LectioCard";
import { gregorianToJdn } from "@/lib/liturgy/calendar";
import { psalmTitle } from "@/lib/bible/psalms";
import { cardsByIds } from "@/lib/cards";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor((await getViewer()).locale).psalm.title };
}

/** One psalm a day, chosen deterministically from the psalms that have cards, shown strophe by strophe. */
export default async function PsalmOfTheDay() {
  const { locale } = await getViewer();
  const t = messagesFor(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("card_details").select("id, chapter_start, psalm_number_hebrew, psalm_number_lxx, sort_key").eq("book_code", "PSA").eq("status", "published").eq("language", locale).order("sort_key");
  const rows = data ?? [];
  const psalms = [...new Set(rows.map((r) => r.chapter_start!))];
  if (psalms.length === 0) return <p className="text-muted">{t.psalm.empty}</p>;
  const now = new Date();
  const day = gregorianToJdn({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() });
  const psalm = psalms[day % psalms.length]!;
  const strophes = rows.filter((r) => r.chapter_start === psalm);
  const cards = await cardsByIds(supabase, strophes.map((r) => r.id!), locale);
  const first = strophes[0]!;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">{t.psalm.title}</h1>
        <p className="text-muted">{t.psalm.subtitle}</p>
        <p className="mt-2 text-lg font-semibold" data-testid="psalm-title">
          {psalmTitle(first.psalm_number_hebrew, first.psalm_number_lxx, locale)}
        </p>
      </div>
      {cards.map((card) => (
        <LectioCard key={card.id} card={card} headingLevel="h2" />
      ))}
    </div>
  );
}
