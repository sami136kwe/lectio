import type { Metadata } from "next";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor((await getViewer()).locale).about.title };
}

export default async function AboutPage() {
  const { locale } = await getViewer();
  const t = messagesFor(locale);
  const supabase = await createClient();
  const { data: versions } = await supabase.from("bible_versions").select("code, name, license, attribution, source_url").order("code");
  const { count } = await supabase.from("sources").select("id", { count: "exact", head: true }).eq("kind", "patristic");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="font-serif text-3xl font-bold">{t.about.title}</h1>
      <p className="rounded-2xl bg-surface-2 p-4 text-sm" data-testid="disclaimer">
        {t.about.disclaimer}
      </p>
      <p className="leading-relaxed">{t.about.method}</p>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.about.sources}</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {(versions ?? []).map((v) => (
            <li key={v.code} className="card-surface p-3">
              <p className="font-semibold">{v.name}</p>
              <p className="text-muted">{v.license}</p>
              <p className="text-xs text-muted">{v.attribution}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          {locale === "fr"
            ? `${count ?? 0} extraits de Pères de l'Église, tirés de traductions du XIXe siècle du domaine public et vérifiés mot pour mot (HistoricalChristianFaith). Liturgie : lectionnaire romain (LiturgicalCalendarAPI) et lectures de l'Archidiocèse grec orthodoxe d'Amérique (orthocal).`
            : `${count ?? 0} extracts from the Church Fathers, from public-domain 19th-century translations, checked word for word (HistoricalChristianFaith). Liturgy: Roman Lectionary (LiturgicalCalendarAPI) and readings of the Greek Orthodox Archdiocese of America (orthocal).`}
        </p>
      </section>
    </div>
  );
}
