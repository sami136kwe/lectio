"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { apiFetch } from "@/lib/client/api";
import { useLocale, useT } from "@/lib/i18n/client";

/** FR/EN switch in the header: the profile language when signed in, a cookie otherwise. */
export function LanguageToggle({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "fr" ? "en" : "fr";

  function toggle() {
    start(async () => {
      if (signedIn) {
        await apiFetch("/api/profile", { method: "PATCH", json: { language: next } }).catch(() => undefined);
      }
      document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={t.nav.switchLanguage}
      title={t.nav.switchLanguage}
      data-testid="language-toggle"
      className="rounded-full border border-line px-2.5 py-1 text-xs font-bold text-muted hover:text-ink"
    >
      {t.nav.languageShort}
    </button>
  );
}
