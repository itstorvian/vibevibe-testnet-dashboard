import { activeSnapshot } from "@/data";
import { formatBlock, formatUtcDate } from "@/lib/format";

interface SnapshotBadgeProps {
  /**
   * Which run to advertise. Defaults to the Overview's.
   *
   * Explore passes its own, because its shards are built from a different run
   * and a badge that borrowed the Overview's head block would misstate what the
   * table below it actually contains. See `@/data/explore-source`.
   */
  validationDate?: string;
  headBlock?: number;
}

/**
 * The freshness marker. Every page that shows indexed data carries one, and it
 * always names the run that page's own numbers came from.
 */
export function SnapshotBadge({ validationDate, headBlock }: SnapshotBadgeProps = {}) {
  const run = {
    validationDate: validationDate ?? activeSnapshot.run.validationDate,
    headBlock: headBlock ?? activeSnapshot.run.headBlock,
  };
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
