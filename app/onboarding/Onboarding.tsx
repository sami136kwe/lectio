"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InterestPicker } from "@/components/InterestPicker";
import type { MainCategory } from "@/lib/categories";
import { apiFetch } from "@/lib/client/api";
import { MESSAGES, type Locale } from "@/lib/i18n/messages";
import { TRADITION_VIEWS, type TraditionView } from "@/lib/reading/views";

type Goal = 3 | 5 | 10;
type Props = { categories: MainCategory[]; initial: { language: Locale; interests: string[]; dailyGoal: Goal } };

export function Onboarding({ categories, initial }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<Locale>(initial.language);
  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [goal, setGoal] = useState<Goal>(initial.dailyGoal);
  const [view, setView] = useState<TraditionView>("both");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = MESSAGES[language];

  async function finish() {
    if (interests.length === 0) {
      setError(t.onboarding.pickOne);
      setStep(1);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        json: { language, interests, daily_goal: goal, tradition_view: view, onboarded: true },
      });
      router.replace("/feed");
      router.refresh();
    } catch {
      setError(t.common.error);
      setPending(false);
    }
  }

  const steps = [t.onboarding.stepLanguage, t.onboarding.stepInterests, t.onboarding.stepGoal];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6" lang={language}>
      <div>
        <p className="text-sm font-medium text-muted">
          {step + 1} / {steps.length}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold">{t.onboarding.title}</h1>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <h2 className="text-xl font-semibold">{steps[step]}</h2>

      {step === 0 && (
        <div role="radiogroup" aria-label={t.common.language} className="grid gap-3 sm:grid-cols-2">
          {(["fr", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={language === l}
              onClick={() => setLanguage(l)}
              className={`rounded-2xl border p-5 text-left text-lg font-semibold ${
                language === l ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              {l === "fr" ? "Français" : "English"}
            </button>
          ))}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <h3 className="mt-4 text-lg font-semibold">{t.onboarding.stepTradition}</h3>
            <p className="text-sm text-muted">{t.onboarding.traditionHint}</p>
            <div role="radiogroup" aria-label={t.onboarding.stepTradition} className="flex flex-wrap gap-2">
              {TRADITION_VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full border px-4 py-2 font-medium ${view === v ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2"}`}
                >
                  {t.card.views[v]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <>
          <p className="text-muted">{t.onboarding.interestsHint}</p>
          <InterestPicker categories={categories} selected={interests} onChange={setInterests} locale={language} legend={t.onboarding.stepInterests} />
        </>
      )}

      {step === 2 && (
        <div role="radiogroup" aria-label={t.onboarding.stepGoal} className="grid gap-3 sm:grid-cols-3">
          {([3, 5, 10] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={goal === g}
              onClick={() => setGoal(g)}
              className={`flex flex-col rounded-2xl border p-5 text-left ${
                goal === g ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              <span className="text-lg font-semibold">{t.onboarding.goalOption(g)}</span>
              <span className="text-sm text-muted">{t.onboarding.goalHints[g]}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
          {t.common.back}
        </button>
        {step < steps.length - 1 ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (step === 1 && interests.length === 0) {
                setError(t.onboarding.pickOne);
                return;
              }
              setError(null);
              setStep((s) => s + 1);
            }}
          >
            {t.common.next}
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={finish} disabled={pending}>
            {t.onboarding.finish}
          </button>
        )}
      </div>
    </div>
  );
}
