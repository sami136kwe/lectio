import type { Metadata } from "next";
import { mainCategories } from "@/lib/categories";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer, requireOnboardedUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isTraditionView } from "@/lib/reading/views";
import { ProfileForm } from "./ProfileForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor((await getViewer()).locale).profile.title };
}

export default async function ProfilePage() {
  const { user, profile, locale } = await requireOnboardedUser("/profile");
  const categories = await mainCategories(await createClient());
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">{messagesFor(locale).profile.title}</h1>
        <p className="text-muted">{user.email}</p>
      </div>
      <ProfileForm
        categories={categories}
        initial={{
          display_name: profile.display_name ?? "",
          language: profile.language === "en" ? "en" : "fr",
          interests: profile.interests,
          daily_goal: profile.daily_goal as 3 | 5 | 10,
          daily_limit: profile.daily_limit === "50" ? "50" : "unlimited",
          tradition_view: isTraditionView(profile.tradition_view) ? profile.tradition_view : "both",
          bible_version_fr: "LSG1910",
          bible_version_en: profile.bible_version_en === "KJV" || profile.bible_version_en === "DRC" ? profile.bible_version_en : "WEB",
          show_greek: profile.show_greek,
          reviewed_only: profile.reviewed_only,
        }}
      />
    </div>
  );
}
