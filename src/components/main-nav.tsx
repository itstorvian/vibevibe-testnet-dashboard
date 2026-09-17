"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * An item links only where there is something to reach.
 *
 * Explore is a real route. Factories and Methodology are in-page anchors on
 * the overview, so they are addressed from the site root and resolve from any
 * page. Nothing here points at a page that does not exist.
 */
const ROUTES = [
  { label: "Overview", href: "/" },
  { label: "Explore", href: "/explore" },
] as const;

const OVERVIEW_ANCHORS = [
  { label: "Factories", href: "/#factories" },
  { label: "Methodology", href: "/#methodology" },
] as const;

export function MainNav() {
  const pathname = usePathname();
  const onOverview = pathname === "/";

  return (
    <nav aria-label="Sections">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        {ROUTES.map((r) => {
          const active = r.href === "/" ? pathname === "/" : pathname.startsWith(r.href);
          return (
            <li key={r.href}>
              <Link
                href={r.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "text-ink underline decoration-accent decoration-2 underline-offset-[6px]"
                    : "text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
                }
              >
                {r.label}
              </Link>
            </li>
          );
        })}
        {OVERVIEW_ANCHORS.map((a) => {
          const hash = `#${a.href.split("#")[1]}`;
          const className =
            "text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-accent";
          return (
            <li key={a.href} className="hidden sm:block">
              {onOverview ? (
                /*
                 * A bare hash on the page that owns the anchor, so the browser
                 * does its native in-page jump and moves focus to the target
                 * section. Routing through next/link here would scroll but
                 * leave a keyboard user's focus stranded at the top.
                 */
                <a href={hash} className={className}>
                  {a.label}
                </a>
              ) : (
                <Link href={a.href} className={className}>
                  {a.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
