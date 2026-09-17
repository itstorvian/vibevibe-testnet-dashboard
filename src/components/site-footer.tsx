import { activeSnapshot } from "@/data";
import { formatUtcDate } from "@/lib/format";

export function SiteFooter() {
  const { source, run } = activeSnapshot;

  return (
    <footer className="mt-16 border-t border-line bg-canvas">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          <li>Unofficial</li>
          <li aria-hidden="true">/</li>
          <li>Community built</li>
          <li aria-hidden="true">/</li>
          <li>Testnet only</li>
          <li aria-hidden="true">/</li>
          <li>Read only</li>
        </ul>

        <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
          Not affiliated with Vibe/Vibe, Seedify, Robinhood, or Robinhood Chain. This is
          independent research infrastructure built against public testnet data, and none of
          it is financial advice or an endorsement of anything it describes.
        </p>

        <p className="text-sm text-ink-faint">
          Data from the{" "}
          <a
            href={source.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
          >
            {source.indexerName}
          </a>{" "}
          v{source.indexerVersion}, validation run of {formatUtcDate(run.validationDate)}.
        </p>
      </div>
    </footer>
  );
}
