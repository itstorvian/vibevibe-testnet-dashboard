import {
  activeSnapshot,
  blocksBehindHead,
  generationById,
  generationShare,
  totalLaunches,
} from "@/data";
import type { GenerationId } from "@/data/types";
import { formatCount, formatPercent } from "@/lib/format";

/**
 * Only the current generation is accented. The other two are neutral and get
 * dimmer with age, so the bars encode recency without turning into a palette.
 */
const BAR_COLOR: Record<GenerationId, string> = {
  retired: "bg-bar-retired",
  legacy: "bg-bar-legacy",
  current: "bg-bar-current",
};

export function GenerationDistribution() {
  const snapshot = activeSnapshot;
  const total = totalLaunches(snapshot);

  /*
   * Derived rather than written into the sentence below, so the copy cannot
   * drift from the snapshot when a newer run is adopted.
   */
  const retired = generationById(snapshot, "retired");
  const retiredBehind = retired
    ? blocksBehindHead(retired, snapshot.run.headBlock)
    : null;

  return (
    <div className="space-y-5">
      <ul className="space-y-4">
        {snapshot.generations.map((generation) => {
          const share = generationShare(generation, total);
          return (
            <li key={generation.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-sm font-medium text-ink">
                    {generation.displayName}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                    {generation.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-ink tabular-nums">
                    {formatCount(generation.launchCount)}
                  </span>
                  <span className="font-mono text-xs text-ink-faint tabular-nums">
                    {formatPercent(share)}
                  </span>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="mt-2 h-1.5 w-full overflow-hidden bg-bar-track"
              >
                <div
                  className={`h-full ${BAR_COLOR[generation.id]}`}
                  style={{ width: `${share}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
        Retired and legacy are the operator&apos;s labels for these factory generations, not
        observations of whether a factory is active. Legacy and current were both still
        producing launches near the head block of this run. The retired one, which the
        operator no longer lists anywhere, was not: its most recent launch sits{" "}
        {retiredBehind === null ? (
          "further back"
        ) : (
          <>
            <span className="font-mono tabular-nums text-ink">
              {formatCount(retiredBehind)}
            </span>{" "}
            blocks below the head
          </>
        )}
        . Its launches still count, which is why it is listed here at all.
      </p>
    </div>
  );
}
