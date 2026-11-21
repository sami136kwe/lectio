import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardGrid } from "@/components/CardGrid";
import { assembleCards, CARD_FIELDS } from "@/lib/cards";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ slug: string }> };

async function loadCategory(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const category = await loadCategory((await params).slug);
  if (!category) return {};
  const { locale } = await getViewer();
  return { title: locale === "fr" ? category.name_fr : category.name_en };
}

export default async function CategoryPage({ params }: Params) {
  const category = await loadCategory((await params).slug);
  if (!category) notFound();
  const { locale } = await getViewer();
  const t = messagesFor(locale);
  const supabase = await createClient();

  const { data: children } = await supabase.from("categories").select("id, slug, name_fr, name_en").eq("parent_id", category.id).order("sort_order");
  const ids = [category.id, ...(children ?? []).map((c) => c.id)];
  const { data: cards, count } = await supabase
    .from("card_details")
    .select(CARD_FIELDS, { count: "exact" })
    .in("category_id", ids)
    .eq("status", "published")
    .eq("language", locale)
    .order("sort_key")
    .limit(40);
  const assembled = await assembleCards(supabase, cards ?? [], locale);

  let parent: { slug: string; name_fr: string; name_en: string } | null = null;
  if (category.parent_id) {
    const { data } = await supabase.from("categories").select("slug, name_fr, name_en").eq("id", category.parent_id).maybeSingle();
    parent = data;
  }
  const name = (c: { name_fr: string; name_en: string }) => (locale === "fr" ? c.name_fr : c.name_en);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {parent && (
          <Link href={`/categories/${parent.slug}`} className="text-sm text-muted hover:text-ink">
            ← {name(parent)}
          </Link>
        )}
        <h1 className="font-serif text-3xl font-bold">
          {category.icon && <span aria-hidden="true">{category.icon} </span>}
          {name(category)}
        </h1>
        {(locale === "fr" ? category.description : category.description_en) && (
          <p className="text-muted">{locale === "fr" ? category.description : category.description_en}</p>
        )}
        <p className="text-sm text-muted">{t.category.cards(count ?? 0)}</p>
      </div>
      {children && children.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {children.map((c) => (
            <li key={c.id}>
              <Link href={`/categories/${c.slug}`} className="chip hover:text-ink">
                {name(c)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {assembled.length > 0 ? <CardGrid cards={assembled} /> : <p className="text-muted">{t.category.empty}</p>}
    </div>
  );
}
