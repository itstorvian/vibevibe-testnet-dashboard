import { activeSnapshot } from "@/data";
import { formatBlock, formatUtcDate } from "@/lib/format";

/**
 * The freshness marker. Shared by Overview and Explore so the two pages can
 * never advertise different snapshot identities.
 */
export function SnapshotBadge() {
  const { run } = activeSnapshot;
  return (
    <p className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-muted">
      <span className="text-accent">Snapshot</span>
      <span aria-hidden="true" className="text-ink-faint">
        /
      </span>
      <span>{formatUtcDate(run.validationDate)}</span>
      <span aria-hidden="true" className="text-ink-faint">
        /
      </span>
      <span className="tabular-nums">Block {formatBlock(run.headBlock)}</span>
    </p>
  );
}
