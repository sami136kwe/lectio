import type { Metadata } from "next";
import Link from "next/link";
import { LectioCard } from "@/components/LectioCard";
import { cardsByIds } from "@/lib/cards";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor((await getViewer()).locale).compare.title };
}

/** Cards marked "point of divergence", with a topic filter. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { locale } = await getViewer();
  const t = messagesFor(locale);
  const supabase = await createClient();
  const topic = (await searchParams).topic;
  const { data } = await supabase.from("card_perspectives").select("card_id, divergence_topic").eq("language", locale).eq("divergence_type", "differ").limit(500);
  const rows = data ?? [];
  const topics = [...new Set(rows.map((r) => r.divergence_topic ?? "other"))].sort();
  const ids = [...new Set(rows.filter((r) => !topic || (r.divergence_topic ?? "other") === topic).map((r) => r.card_id))];
  const cards = await cardsByIds(supabase, ids.slice(0, 40), locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">{t.compare.title}</h1>
        <p className="text-muted">{t.compare.subtitle}</p>
      </div>
      <nav aria-label={t.compare.topic} className="flex flex-wrap gap-2">
        <Link href="/compare" className={`chip ${!topic ? "bg-accent-soft text-accent" : "hover:text-ink"}`}>
          {t.compare.allTopics}
        </Link>
        {topics.map((k) => (
          <Link key={k} href={`/compare?topic=${k}`} className={`chip ${topic === k ? "bg-accent-soft text-accent" : "hover:text-ink"}`}>
            {t.compare.topics[k] ?? k}
          </Link>
        ))}
      </nav>
      {cards.length === 0 ? (
        <p className="text-muted">{t.compare.empty}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {cards.map((card) => (
            <LectioCard key={card.id} card={card} headingLevel="h2" />
          ))}
        </div>
      )}
    </div>
  );
}
