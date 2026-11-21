import Link from "next/link";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer, requireOnboardedUser } from "@/lib/session";

/** Mobile menu: every page that does not fit in the bottom bar. */
export default async function MorePage() {
  const { isAdmin } = await requireOnboardedUser("/more");
  const { locale } = await getViewer();
  const t = messagesFor(locale);
  const links: [string, string][] = [
    ["/review", t.nav.review],
    ["/psalm", t.nav.psalm],
    ["/seasons", t.nav.seasons],
    ["/compare", t.nav.compare],
    ["/learn", t.nav.learn],
    ["/challenge", t.nav.challenge],
    ["/progress", t.nav.progress],
    ["/history", t.nav.history],
    ["/reread", t.nav.reread],
    ["/search", t.nav.search],
    ["/profile", t.nav.profile],
    ["/about", t.nav.about],
    ...(isAdmin ? ([["/admin", t.nav.admin]] as [string, string][]) : []),
  ];
  return (
    <ul className="mx-auto flex max-w-md flex-col gap-2">
      {links.map(([href, label]) => (
        <li key={href}>
          <Link href={href} className="card-surface block p-4 font-medium hover:bg-surface-2">
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
