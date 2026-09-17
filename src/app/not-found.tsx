import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-20 sm:px-6"
    >
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Nothing here yet</h1>
      <p className="max-w-xl text-[15px] leading-relaxed text-ink-muted">
        This version of the dashboard has two pages. The overview covers factory
        generations, indexer methodology and what the data does not include; the explorer
        browses every indexed launch. There are no pages for individual launches.
      </p>
      <Link
        href="/"
        className="mt-2 border border-control px-3 py-1.5 text-sm text-ink transition-colors hover:border-control-strong"
      >
        Back to the overview
      </Link>
    </main>
  );
}
