"use client";

import Link from "next/link";
import { useState } from "react";
import type { CardSummary, KeyWord, Perspective, TraditionCode } from "@/lib/cards";
import type { PassageText } from "@/lib/bible/passage";
import { useLocale, useT } from "@/lib/i18n/client";
import { TRADITION_VIEWS, useReadingPrefs, type TraditionView } from "@/lib/reading/context";
import { splitSentences, type ReadingPosition, type SpeakableCard } from "@/lib/tts/segment";

type Props = {
  card: CardSummary;
  discovery?: boolean;
  /** "full" for the feed and card page, "compact" for lists. */
  variant?: "full" | "compact";
  /** Show only the reference (review mode before reveal). */
  hideContent?: boolean;
  headingLevel?: "h1" | "h2" | "h3";
  /** Sentence being read aloud. `undefined` = no read-aloud on this card, `null` = nothing playing. */
  reading?: ReadingPosition | null;
  /** Shows the per-card FR/EN button. */
  onFlipLanguage?: () => void;
  children?: React.ReactNode;
};

/** Text read aloud for a card: reference, verses, explanation, "to live". */
export function toSpeakable(card: CardSummary): SpeakableCard & { language: string } {
  return {
    reference: card.psalm_title ?? card.reference,
    verses: card.passage?.verses.map((v) => v.text) ?? [],
    plain_explanation: card.plain_explanation ?? "",
    action_step: card.action_step ?? "",
    language: card.language ?? "fr",
  };
}

export function CategoryChip({ card }: { card: Pick<CardSummary, "category_icon" | "category_name_fr" | "category_name_en" | "category_slug"> }) {
  const locale = useLocale();
  return (
    <Link href={`/categories/${card.category_slug}`} className="chip hover:text-ink">
      {card.category_icon && <span aria-hidden="true">{card.category_icon}</span>}
      {locale === "fr" ? card.category_name_fr : card.category_name_en}
    </Link>
  );
}

function Verses({ text, highlight, lang }: { text: PassageText; highlight?: (i: number) => boolean; lang?: string }) {
  return (
    <p className="font-serif text-lg leading-relaxed" lang={lang ?? (text.language === "grc" ? "grc" : text.language)}>
      {text.verses.map((v, i) => (
        <span key={`${v.chapter}:${v.verse}`} className={highlight?.(i) ? "rounded bg-accent-soft" : ""}>
          <sup className="mr-0.5 select-none font-sans text-[0.65em] font-semibold text-muted">{v.verse}</sup>
          {v.text}{" "}
        </span>
      ))}
    </p>
  );
}

export function TraditionSwitch({ value, onChange }: { value: TraditionView; onChange: (v: TraditionView) => void }) {
  const t = useT();
  return (
    <div role="group" aria-label={t.card.view} className="inline-flex flex-wrap rounded-full border border-line p-0.5 text-xs">
      {TRADITION_VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded-full px-2.5 py-1 font-medium ${value === v ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
        >
          {t.card.views[v]}
        </button>
      ))}
    </div>
  );
}

function Reading({ perspective, tradition, text, reviewedOnly, cardLanguage }: { perspective?: Perspective; tradition: TraditionCode; text: PassageText | null; reviewedOnly: boolean; cardLanguage: string }) {
  const t = useT();
  const title = tradition === "catholic" ? t.card.catholic : t.card.orthodox;
  const reviewed = perspective && (perspective.review_status === "reviewed" || perspective.review_status === "corrected");
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line p-4" aria-label={title} data-tradition={tradition}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-accent">{title}</h3>
      {!perspective ? (
        <p className="text-sm text-muted">{t.card.noReading}</p>
      ) : reviewedOnly && !reviewed ? (
        <p className="text-sm text-muted">{t.card.hiddenUnreviewed}</p>
      ) : (
        <>
          <p className="leading-relaxed text-ink/90">{perspective.body}</p>
          {!reviewed && <p className="text-xs italic text-muted">{t.card.unreviewed}</p>}
          {perspective.sources.length > 0 && (
            <div className="text-xs text-muted">
              <p className="font-semibold">{t.card.references}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {perspective.sources.map((s) => (
                  <li key={`${s.author}|${s.work}|${s.section}`}>
                    {s.quote && <q className="mr-1 italic">{s.quote}</q>}
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:decoration-accent">
                      {s.author}, <cite>{s.work}</cite>, {s.section}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {text && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">
            {t.card.traditionText[tradition]} · {text.versionName}
          </summary>
          {text.language !== cardLanguage && <p className="mt-2 text-xs italic text-muted">{t.card.englishOnlyNotice}</p>}
          <div className="mt-2">
            <Verses text={text} />
          </div>
        </details>
      )}
    </section>
  );
}

export function LectioCard({ card, discovery, variant = "full", hideContent, headingLevel = "h2", reading, onFlipLanguage, children }: Props) {
  const t = useT();
  const prefs = useReadingPrefs();
  const [view, setView] = useState<TraditionView>(prefs.view);
  const Heading = headingLevel;
  const full = variant === "full";
  const language = card.language === "en" ? "en" : "fr";
  const bodySentences = reading !== undefined ? splitSentences(card.plain_explanation ?? "", language) : null;
  const on = (part: ReadingPosition["part"], index = 0) => reading?.part === part && reading.index === index;
  const byTradition = new Map(card.perspectives.map((p) => [p.tradition, p]));
  const divergence = card.perspectives.find((p) => p.divergence_type !== "none");
  const shown: TraditionCode[] = view === "both" ? ["catholic", "orthodox"] : view === "neutral" ? [] : [view];
  const keyWords = (Array.isArray(card.key_words) ? card.key_words : []) as KeyWord[];

  return (
    <article className={`card-surface flex flex-col ${full ? "gap-5 p-6 sm:p-8" : "gap-3 p-5"}`} lang={language} data-card-id={card.id}>
      <div className="flex flex-wrap items-center gap-2">
        <CategoryChip card={card} />
        <span className="chip">{t.common.difficulty[card.difficulty ?? 1] ?? ""}</span>
        {discovery && <span className="chip bg-accent-soft text-accent">{t.common.discovery}</span>}
        {onFlipLanguage && (
          <button type="button" onClick={onFlipLanguage} className="chip ml-auto hover:text-ink" aria-label={t.common.flipLanguageLabel} data-testid="flip-language">
            {t.common.flipLanguage}
          </button>
        )}
      </div>

      <div>
        <Heading className={`font-serif font-bold leading-tight tracking-tight ${full ? "text-3xl sm:text-4xl" : "text-xl"} ${on("title") ? "rounded bg-accent-soft" : ""}`}>
          <Link href={`/cards/${card.id}`} className="hover:underline">
            {card.reference}
          </Link>
        </Heading>
        {card.psalm_title && <p className="mt-1 text-sm text-muted">{card.psalm_title}</p>}
      </div>

      {!hideContent && card.passage && (
        <div className="flex flex-col gap-1">
          <Verses text={card.passage} highlight={(i) => on("passage", i)} />
          <p className="text-xs text-muted">
            {card.passage.fallbackFrom ? t.card.fallbackNote(card.passage.versionName) : t.card.versionNote(card.passage.versionName)}
          </p>
          {card.greek && (
            <details className="mt-1 text-sm">
              <summary className="cursor-pointer text-muted">{t.card.greekText}</summary>
              <div className="mt-2">
                <Verses text={card.greek} lang="grc" />
              </div>
            </details>
          )}
        </div>
      )}

      {!hideContent && (
        <>
          <section className="flex flex-col gap-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{t.card.explanation}</h3>
            <p className={`${full ? "text-lg" : "text-base"} leading-relaxed text-ink/90`}>
              {bodySentences
                ? bodySentences.map((sentence, i) => (
                    <span key={i} className={on("body", i) ? "rounded bg-accent-soft" : ""}>
                      {sentence}{" "}
                    </span>
                  ))
                : card.plain_explanation}
            </p>
          </section>

          {full && <TraditionSwitch value={view} onChange={setView} />}

          {shown.length > 0 && (
            <div className={`grid gap-3 ${shown.length === 2 ? "lg:grid-cols-2" : ""}`}>
              {shown.map((tr) => (
                <Reading
                  key={tr}
                  tradition={tr}
                  perspective={byTradition.get(tr)}
                  text={card.tradition_texts[tr]}
                  reviewedOnly={prefs.reviewedOnly}
                  cardLanguage={language}
                />
              ))}
            </div>
          )}

          {divergence && view !== "neutral" && (
            <p className={`rounded-xl px-3 py-2 text-sm ${divergence.divergence_type === "differ" ? "bg-surface-2" : "bg-accent-soft"}`} data-divergence={divergence.divergence_type}>
              <strong>{divergence.divergence_type === "differ" ? t.card.differ : t.card.agree}.</strong> {divergence.divergence_summary}
            </p>
          )}

          {card.liturgy.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{t.card.liturgy}</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {card.liturgy.map((u, i) => (
                  <li key={i}>
                    <span className="font-medium">{u.tradition === "catholic" ? t.card.liturgyCatholic : t.card.liturgyOrthodox}</span> · {u.description}
                    {t.card.calendar[u.calendar] && <span className="text-muted"> ({t.card.calendar[u.calendar]})</span>}
                    {u.source && (
                      <>
                        {" "}
                        <a href={u.source.url} target="_blank" rel="noreferrer" className="text-xs text-muted underline">
                          {u.source.work}
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className={`rounded-2xl bg-accent-soft p-4 ${on("label") || on("action") ? "ring-2 ring-accent" : ""}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-accent">{t.common.actionToday}</p>
            <p className="mt-1 font-medium">{card.action_step}</p>
          </div>

          {keyWords.length > 0 && prefs.showGreek && (
            <section className="text-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{t.card.keyWords}</h3>
              <ul className="mt-1 flex flex-col gap-1">
                {keyWords.map((w) => (
                  <li key={w.lemma}>
                    <span lang="grc" className="font-serif text-base">
                      {w.lemma}
                    </span>{" "}
                    <span className="italic text-muted">{w.transliteration}</span> — {w.gloss}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {children}
    </article>
  );
}
