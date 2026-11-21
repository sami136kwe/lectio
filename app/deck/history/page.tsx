import type { Metadata } from "next";
import Link from "next/link";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer, requireOnboardedUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor((await getViewer()).locale).deck.previousDays };
}

export default async function DeckHistoryPage() {
  const { user, locale } = await requireOnboardedUser("/deck/history");
  const t = messagesFor(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("daily_deck").select("deck_date, seen_at").eq("user_id", user.id).order("deck_date", { ascending: false }).limit(5000);
  const days = new Map<string, { total: number; seen: number }>();
  for (const r of data ?? []) {
    const d = days.get(r.deck_date) ?? { total: 0, seen: 0 };
    d.total += 1;
    if (r.seen_at) d.seen += 1;
    days.set(r.deck_date, d);
  }
  const fmt = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "full", timeZone: "UTC" });
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="font-serif text-3xl font-bold">{t.deck.previousDays}</h1>
      {days.size === 0 ? (
        <p className="text-muted">{t.deck.noPreviousDays}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...days.entries()].map(([date, d]) => (
            <li key={date}>
              <Link href={`/deck?day=${date}`} className="card-surface flex items-center justify-between p-4 hover:bg-surface-2">
                <span className="font-medium">{fmt.format(new Date(`${date}T12:00:00Z`))}</span>
                <span className="text-sm text-muted">
                  {d.seen} / {t.deck.dayCards(d.total)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
