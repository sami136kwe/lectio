import type { Metadata } from "next";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer, requireOnboardedUser } from "@/lib/session";
import { LearnSession } from "./LearnSession";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor((await getViewer()).locale).learn.title };
}

export default async function LearnPage() {
  const { locale } = await requireOnboardedUser("/learn");
  const t = messagesFor(locale);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-serif text-3xl font-bold">{t.learn.title}</h1>
        <p className="text-muted">{t.learn.subtitle}</p>
      </div>
      <LearnSession />
    </div>
  );
}
