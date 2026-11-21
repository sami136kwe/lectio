"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InterestPicker } from "@/components/InterestPicker";
import { setTheme, useTheme } from "@/components/ThemeToggle";
import type { MainCategory } from "@/lib/categories";
import { apiFetch } from "@/lib/client/api";
import { useLocale, useT } from "@/lib/i18n/client";

type Values = {
  display_name: string;
  language: "fr" | "en";
  interests: string[];
  daily_goal: 3 | 5 | 10;
  daily_limit: "50" | "unlimited";
  tradition_view: "both" | "catholic" | "orthodox" | "neutral";
  bible_version_fr: "LSG1910";
  bible_version_en: "WEB" | "KJV" | "DRC";
  show_greek: boolean;
  reviewed_only: boolean;
};

const VERSION_NAMES: Record<string, string> = { LSG1910: "Louis Segond 1910", WEB: "World English Bible", KJV: "King James Version", DRC: "Douay-Rheims (Challoner)" };

export function ProfileForm({ categories, initial }: { categories: MainCategory[]; initial: Values }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const theme = useTheme();
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deleting, setDeleting] = useState(false);

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setState("idle");
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (values.interests.length === 0) {
      setState("error");
      return;
    }
    setState("saving");
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        json: { ...values, display_name: values.display_name.trim() || null },
      });
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  async function deleteAccount() {
    if (!window.confirm(t.profile.deleteConfirm)) return;
    setDeleting(true);
    try {
      await apiFetch("/api/account", { method: "DELETE" });
      router.replace("/");
      router.refresh();
    } catch {
      setDeleting(false);
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={save} className="flex flex-col gap-6">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t.profile.displayName}
          <input className="input font-normal" maxLength={60} value={values.display_name} onChange={(e) => update("display_name", e.target.value)} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{t.common.language}</legend>
          <div className="flex gap-2">
            {(["fr", "en"] as const).map((l) => (
              <label key={l} className={`btn-ghost cursor-pointer ${values.language === l ? "border-accent text-accent" : ""}`}>
                <input type="radio" name="language" className="sr-only" checked={values.language === l} onChange={() => update("language", l)} />
                {l === "fr" ? "Français" : "English"}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{t.profile.dailyGoal}</legend>
          <div className="flex gap-2">
            {([3, 5, 10] as const).map((g) => (
              <label key={g} className={`btn-ghost cursor-pointer ${values.daily_goal === g ? "border-accent text-accent" : ""}`}>
                <input type="radio" name="goal" className="sr-only" checked={values.daily_goal === g} onChange={() => update("daily_goal", g)} />
                {t.onboarding.goalOption(g)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">{t.profile.reading}</legend>
          <div className="flex flex-col gap-2">
            <span className="text-sm">{t.profile.traditionView}</span>
            <div className="flex flex-wrap gap-2">
              {(["both", "catholic", "orthodox", "neutral"] as const).map((v) => (
                <label key={v} className={`btn-ghost cursor-pointer ${values.tradition_view === v ? "border-accent text-accent" : ""}`}>
                  <input type="radio" name="tradition_view" className="sr-only" checked={values.tradition_view === v} onChange={() => update("tradition_view", v)} />
                  {t.card.views[v]}
                </label>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            {t.profile.versionFr}
            <select className="input" value={values.bible_version_fr} onChange={(e) => update("bible_version_fr", e.target.value as Values["bible_version_fr"])}>
              <option value="LSG1910">{VERSION_NAMES.LSG1910}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            {t.profile.versionEn}
            <select className="input" value={values.bible_version_en} onChange={(e) => update("bible_version_en", e.target.value as Values["bible_version_en"])}>
              {(["WEB", "KJV", "DRC"] as const).map((v) => (
                <option key={v} value={v}>
                  {VERSION_NAMES[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={values.show_greek} onChange={(e) => update("show_greek", e.target.checked)} />
            {t.profile.showGreek}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={values.reviewed_only} onChange={(e) => update("reviewed_only", e.target.checked)} />
            {t.profile.reviewedOnly}
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-sm">{t.deck.limitLabel}</span>
            <div className="flex flex-wrap gap-2">
              {(["unlimited", "50"] as const).map((v) => (
                <label key={v} className={`btn-ghost cursor-pointer ${values.daily_limit === v ? "border-accent text-accent" : ""}`} data-testid={`limit-${v}`}>
                  <input type="radio" name="daily_limit" className="sr-only" checked={values.daily_limit === v} onChange={() => update("daily_limit", v)} />
                  {t.deck.limits[v]}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t.profile.interests}</h2>
          <InterestPicker categories={categories} selected={values.interests} onChange={(ids) => update("interests", ids)} locale={locale} legend={t.profile.interests} />
          {values.interests.length === 0 && <p className="text-sm text-danger">{t.onboarding.pickOne}</p>}
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={state === "saving"}>
            {t.common.save}
          </button>
          <span role="status" className={state === "error" ? "text-sm text-danger" : "text-sm text-ok"}>
            {state === "saved" ? t.common.saved : state === "error" ? t.common.error : ""}
          </span>
        </div>
      </form>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t.profile.theme}</legend>
        <div className="flex gap-2">
          {(
            [
              ["system", t.profile.themeSystem],
              ["light", t.profile.themeLight],
              ["dark", t.profile.themeDark],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={`btn-ghost cursor-pointer ${theme === value ? "border-accent text-accent" : ""}`}>
              <input type="radio" name="theme" className="sr-only" checked={theme === value} onChange={() => setTheme(value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 className="text-lg font-semibold">{t.profile.data}</h2>
        <div className="flex flex-wrap gap-2">
          <a href="/api/account/export" className="btn-ghost" download>
            {t.profile.export}
          </a>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-ghost">
              {t.nav.signOut}
            </button>
          </form>
          <button type="button" className="btn-danger" onClick={deleteAccount} disabled={deleting}>
            {t.profile.deleteAccount}
          </button>
        </div>
      </section>
    </div>
  );
}
