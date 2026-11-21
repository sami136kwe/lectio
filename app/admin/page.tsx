import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { reviewQueue } from "@/lib/admin/queue";
import { NT_BOOKS } from "@/lib/bible/books";
import { assembleCards, CARD_FIELDS, type CardRow, type CardSummary } from "@/lib/cards";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminQueueQuerySchema } from "@/lib/validation/api";
import { AdminCards, ReviewQueue, type AdminCard } from "./AdminClient";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const SAMPLE_SIZE = 20;
const ADMIN_PREFS = { bible_version_fr: "LSG1910", bible_version_en: "WEB", show_greek: false };

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type Db = ReturnType<typeof createAdminClient>;

async function adminCards(db: Db, ids: string[], locale: "fr" | "en"): Promise<AdminCard[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("card_details").select(`${CARD_FIELDS}, status, quality_score, theology_score, style_score`).in("id", ids).eq("language", locale);
  if (error) throw new Error(error.message);
  const byId = new Map(data.map((c) => [c.id!, c]));
  const rows = ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  const assembled: CardSummary[] = await assembleCards(db, rows as CardRow[], locale, ADMIN_PREFS);
  return assembled.map((card, i) => ({
    card,
    status: rows[i]!.status ?? "draft",
    scores: [rows[i]!.quality_score, rows[i]!.theology_score, rows[i]!.style_score],
  }));
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, isAdmin, locale } = await getViewer();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin) notFound();
  const t = messagesFor(locale);
  const db = createAdminClient();
  const parsed = adminQueueQuerySchema.safeParse(await searchParams);
  const filters = parsed.success ? parsed.data : adminQueueQuerySchema.parse({});

  const [runs, counts, categories, drafts, queue] = await Promise.all([
    db.from("ingestion_runs").select("*").order("started_at", { ascending: false }).limit(15),
    db.rpc("category_card_counts"),
    db.from("categories").select("id, slug, name_fr, name_en, icon").is("parent_id", null).order("sort_order"),
    db.from("cards").select("id").eq("status", "draft").order("created_at", { ascending: false }).limit(30),
    reviewQueue(db, { tradition: filters.tradition, book: filters.book, divergence: filters.divergence === "1", status: filters.status }),
  ]);
  for (const r of [runs, counts, categories, drafts]) if (r.error) throw new Error(r.error.message);

  const latestRun = runs.data!.find((r) => r.cards_created + r.cards_rejected > 0);
  let sampleIds: string[] = [];
  if (latestRun) {
    const { data, error } = await db.from("cards").select("id").eq("ingestion_run_id", latestRun.id).neq("status", "rejected").limit(500);
    if (error) throw new Error(error.message);
    sampleIds = shuffle(data.map((c) => c.id)).slice(0, SAMPLE_SIZE);
  }
  const [sample, draftCards] = await Promise.all([adminCards(db, sampleIds, locale), adminCards(db, drafts.data!.map((d) => d.id), locale)]);

  const name = (c: { name_fr: string; name_en: string }) => (locale === "fr" ? c.name_fr : c.name_en);
  const total = (categoryId: string, language: string, status: string) =>
    counts.data!.filter((c) => c.category_id === categoryId && c.language === language && c.status === status).reduce((s, c) => s + Number(c.total), 0);
  const dateFmt = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
  const exportQuery = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]).toString();

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-serif text-3xl font-bold">{t.admin.title}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.admin.queue}</h2>
        <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
          <label className="flex flex-col gap-1">
            {t.admin.filterTradition}
            <select name="tradition" defaultValue={filters.tradition ?? ""} className="input py-1.5">
              <option value="">{t.admin.allTraditions}</option>
              <option value="catholic">{t.card.catholic}</option>
              <option value="orthodox">{t.card.orthodox}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {t.admin.filterBook}
            <select name="book" defaultValue={filters.book ?? ""} className="input py-1.5">
              <option value="">{t.admin.allBooks}</option>
              {[...NT_BOOKS, { code: "PSA", name_fr: "Psaumes", name_en: "Psalms" }].map((b) => (
                <option key={b.code} value={b.code}>
                  {locale === "fr" ? b.name_fr : b.name_en}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {t.admin.filterDivergence}
            <select name="divergence" defaultValue={filters.divergence} className="input py-1.5">
              <option value="0">{t.admin.anyDivergence}</option>
              <option value="1">{t.admin.onlyDivergence}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {t.admin.filterStatus}
            <select name="status" defaultValue={filters.status} className="input py-1.5">
              {Object.entries(t.admin.reviewStatus).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-ghost py-1.5">
            OK
          </button>
          <a href={`/api/admin/review/export?${exportQuery}`} className="btn-ghost py-1.5">
            {t.admin.exportCsv}
          </a>
        </form>
        <ReviewQueue items={queue} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.admin.runs}</h2>
        {runs.data!.length === 0 ? (
          <p className="text-muted">{t.admin.noRuns}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  {Object.values(t.admin.columns).map((c) => (
                    <th key={c} scope="col" className="px-3 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.data!.map((r) => {
                  const errors = Array.isArray(r.errors) ? r.errors : [];
                  return (
                    <tr key={r.id} className="border-t border-line align-top">
                      <td className="whitespace-nowrap px-3 py-2">{dateFmt.format(new Date(r.started_at))} UTC</td>
                      <td className="px-3 py-2">{r.source}</td>
                      <td className={`px-3 py-2 font-medium ${r.status === "failed" ? "text-danger" : r.status === "success" ? "text-ok" : ""}`}>{r.status}</td>
                      <td className="px-3 py-2">{r.scope ?? "–"}</td>
                      <td className="px-3 py-2">{r.cards_created}</td>
                      <td className="px-3 py-2">{r.cards_rejected}</td>
                      <td className="px-3 py-2">{r.model_calls}</td>
                      <td className="px-3 py-2">${Number(r.cost_usd).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        {errors.length > 0 ? (
                          <details>
                            <summary className="cursor-pointer">{errors.length}</summary>
                            <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap text-xs text-muted">{JSON.stringify(errors.slice(0, 10), null, 1)}</pre>
                          </details>
                        ) : (
                          0
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.admin.counts}</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.data!.map((c) => (
            <li key={c.id} className="card-surface flex items-center justify-between gap-2 p-4 text-sm">
              <span className="font-medium">
                {c.icon} {name(c)}
              </span>
              <span className="shrink-0 whitespace-nowrap text-muted">
                FR {total(c.id, "fr", "published")} · EN {total(c.id, "en", "published")} · ✎ {total(c.id, "fr", "draft")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.admin.sample}</h2>
        <AdminCards cards={sample} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.admin.drafts}</h2>
        <AdminCards cards={draftCards} />
      </section>
    </div>
  );
}
