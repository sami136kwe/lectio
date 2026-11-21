import type { Metadata } from "next";
import Link from "next/link";
import { CardGrid } from "@/components/CardGrid";
import { byzantineSeason, orthodoxPascha, romanSeason, westernEaster, type YMD } from "@/lib/liturgy/calendar";
import { cardsByIds } from "@/lib/cards";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor((await getViewer()).locale).seasons.title };
}

export default async function SeasonsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { locale } = await getViewer();
  const t = messagesFor(locale);
  const supabase = await createClient();
  const now = new Date();
  const today: YMD = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
  const west = romanSeason(today);
  const east = byzantineSeason(today);
  const fmt = (d: YMD) => new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(d.year, d.month - 1, d.day));

  const { data: seasons } = await supabase.from("liturgical_seasons").select("id, slug, name_fr, name_en, description_fr, description_en").order("sort_order");
  const list = seasons ?? [];
  const wanted = (await searchParams).season;
  const selected = list.find((s) => s.slug === wanted) ?? list.find((s) => s.slug === west) ?? list[0];
  let cards: Awaited<ReturnType<typeof cardsByIds>> = [];
  if (selected) {
    const { data } = await supabase.from("card_seasons").select("card_id").eq("season_id", selected.id).limit(60);
    cards = await cardsByIds(supabase, [...new Set((data ?? []).map((d) => d.card_id))], locale);
  }
  const name = (s: { name_fr: string; name_en: string }) => (locale === "fr" ? s.name_fr : s.name_en);
  const seasonName = (slug: string) => name(list.find((s) => s.slug === slug) ?? { name_fr: slug, name_en: slug });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-bold">{t.seasons.title}</h1>
        <p className="text-muted">{t.seasons.subtitle}</p>
      </div>
      <section className="card-surface grid gap-3 p-5 text-sm sm:grid-cols-2" aria-label={t.seasons.current}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            {t.seasons.current} · {t.card.liturgyCatholic}
          </p>
          <p className="text-lg font-semibold" data-testid="season-roman">
            {seasonName(west)}
          </p>
          <p className="text-muted">{t.seasons.easterWest(fmt(westernEaster(today.year)))}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            {t.seasons.current} · {t.card.liturgyOrthodox}
          </p>
          <p className="text-lg font-semibold" data-testid="season-byzantine">
            {seasonName(east)}
          </p>
          <p className="text-muted">{t.seasons.easterEast(fmt(orthodoxPascha(today.year)))}</p>
        </div>
        <p className="text-xs text-muted sm:col-span-2">{t.seasons.calendars}</p>
      </section>
      <nav className="flex flex-wrap gap-2">
        {list.map((s) => (
          <Link key={s.slug} href={`/seasons?season=${s.slug}`} aria-current={selected?.slug === s.slug ? "page" : undefined} className={`chip ${selected?.slug === s.slug ? "bg-accent-soft text-accent" : "hover:text-ink"}`}>
            {name(s)}
          </Link>
        ))}
      </nav>
      {selected && (locale === "fr" ? selected.description_fr : selected.description_en) && <p className="text-sm text-muted">{locale === "fr" ? selected.description_fr : selected.description_en}</p>}
      {cards.length > 0 ? <CardGrid cards={cards} /> : <p className="text-muted">{t.seasons.empty}</p>}
    </div>
  );
}
