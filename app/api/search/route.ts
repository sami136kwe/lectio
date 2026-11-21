import { NextResponse } from "next/server";
import { parseQuery, serverError } from "@/lib/api";
import { book } from "@/lib/bible/books";
import { bibleVersions, referenceText, textWithFallback } from "@/lib/bible/passage";
import { lxxLabel, psalmTitle } from "@/lib/bible/psalms";
import { formatReference, parseReference, type Range } from "@/lib/bible/reference";
import { cardsByIds, versionPlan } from "@/lib/cards";
import { resolveLocale } from "@/lib/i18n/server";
import { getProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { searchQuerySchema } from "@/lib/validation/api";

/** Escapes PostgREST ilike wildcards and filter separators. */
function likePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ")}%`;
}

const LAST_VERSE = 200;

export async function GET(request: Request) {
  const query = parseQuery(request, searchQuerySchema);
  if (!query.ok) return query.response;
  const q = query.data.q;
  const supabase = await createClient();
  const profile = await getProfile();
  const locale = await resolveLocale(profile?.language);
  const prefs = {
    bible_version_fr: profile?.bible_version_fr ?? "LSG1910",
    bible_version_en: profile?.bible_version_en ?? "WEB",
    show_greek: profile?.show_greek ?? false,
  };
  const config = locale === "fr" ? "french" : "english";

  try {
    // 1. A Bible reference ("Jn 3,16", "Ps 21 (LXX)").
    const ref = parseReference(q);
    let reference: { label: string; cardIds: string[]; text: Awaited<ReturnType<typeof referenceText>> | null } | null = null;
    if (ref) {
      const range: Range = {
        book: ref.book,
        chapterStart: ref.chapterStart,
        verseStart: ref.verseStart ?? 1,
        chapterEnd: ref.chapterEnd,
        verseEnd: ref.verseEnd ?? LAST_VERSE,
      };
      const { data: passages, error } = await supabase
        .from("passages")
        .select("id, chapter_start, verse_start, chapter_end, verse_end, sort_key")
        .eq("book_code", ref.book)
        .lte("chapter_start", range.chapterEnd)
        .gte("chapter_end", range.chapterStart)
        .order("sort_key");
      if (error) throw error;
      const start = range.chapterStart * 1000 + range.verseStart;
      const end = range.chapterEnd * 1000 + range.verseEnd;
      const overlapping = passages.filter((p) => p.chapter_start * 1000 + p.verse_start <= end && p.chapter_end * 1000 + p.verse_end >= start).map((p) => p.id);
      const { data: cardRows, error: cardError } = overlapping.length
        ? await supabase.from("card_details").select("id, sort_key").in("passage_id", overlapping).eq("language", locale).eq("status", "published").order("sort_key")
        : { data: [], error: null };
      if (cardError) throw cardError;
      const refText = await referenceText(supabase, range);
      const text = ref.verseStart !== null && refText.verses.length ? await textWithFallback(supabase, versionPlan(locale, prefs, ref.book === "PSA").neutral, range, refText) : null;
      const shown: Range =
        ref.verseStart === null ? { ...range, verseStart: 1, verseEnd: refText.verses.at(-1)?.verse ?? 1 } : { ...range, verseEnd: ref.verseEnd ?? ref.verseStart };
      const label = ref.book === "PSA" && ref.verseStart === null
        ? psalmTitle(ref.chapterStart <= 150 ? ref.chapterStart : null, ref.chapterStart <= 150 ? lxxLabel(ref.chapterStart) : "151", locale)
        : ref.verseStart === null
          ? `${ref.book === "PSA" ? (locale === "fr" ? "Psaume" : "Psalm") : locale === "fr" ? book(ref.book).name_fr : book(ref.book).name_en} ${ref.chapterStart}`
          : formatReference(shown, locale);
      reference = { label, cardIds: [...new Set(cardRows.map((c) => c.id!))], text };
    }

    // 2. Full text in cards (explanation, readings) and verses, and theme names.
    const pattern = likePattern(q);
    const versions = await bibleVersions(supabase);
    const versionId = versions.get(locale === "fr" ? prefs.bible_version_fr : prefs.bible_version_en)?.id ?? versions.get("LSG1910")?.id;
    const [translations, perspectives, verses, categories] = await Promise.all([
      supabase.from("card_translations").select("card_id").eq("status", "published").eq("language", locale).textSearch("search", q, { type: "websearch", config }).limit(20),
      supabase.from("card_perspectives").select("card_id").eq("language", locale).textSearch("search", q, { type: "websearch", config }).limit(20),
      versionId
        ? supabase.from("bible_verses").select("book_code, chapter, verse, text").eq("version_id", versionId).textSearch("search", q, { type: "websearch", config }).limit(20)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("categories").select("id, slug, name_fr, name_en, icon, parent_id").or(`name_fr.ilike.${pattern},name_en.ilike.${pattern}`).order("sort_order").limit(10),
    ]);
    for (const r of [translations, perspectives, verses, categories]) if (r.error) throw r.error;

    const refIds = reference?.cardIds.slice(0, 12) ?? [];
    const textIds = [...new Set([...(translations.data ?? []), ...(perspectives.data ?? [])].map((c) => c.card_id))].filter((id) => !refIds.includes(id));
    const [refCards, textCards] = await Promise.all([cardsByIds(supabase, refIds, locale, prefs), cardsByIds(supabase, textIds.slice(0, 20), locale, prefs)]);

    return NextResponse.json({
      reference: reference && { label: reference.label, cards: refCards, text: reference.text, firstCardId: reference.cardIds[0] ?? null },
      cards: textCards,
      verses: (verses.data ?? []).map((v) => ({
        ...v,
        label: formatReference({ book: v.book_code, chapterStart: v.chapter, verseStart: v.verse, chapterEnd: v.chapter, verseEnd: v.verse }, locale),
      })),
      categories: categories.data,
    });
  } catch (error) {
    return serverError("search", error);
  }
}
