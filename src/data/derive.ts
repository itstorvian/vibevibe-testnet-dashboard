import type { GenerationId, GenerationSummary, IndexerSnapshot } from "@/data/types";

/**
 * Total launches across every configured generation.
 *
 * Derived rather than stored. The overview shows this number next to its three
 * parts, so the two can never disagree.
 */
export function totalLaunches(snapshot: IndexerSnapshot): number {
  return snapshot.generations.reduce((sum, g) => sum + g.launchCount, 0);
}

/** A generation's share of all indexed launches, as a percentage. */
export function generationShare(
  generation: GenerationSummary,
  total: number
): number {
  if (total <= 0) return 0;
  return (generation.launchCount / total) * 100;
}

export function generationById(
  snapshot: IndexerSnapshot,
  id: GenerationId
): GenerationSummary | undefined {
  return snapshot.generations.find((g) => g.id === id);
}

/**
 * Number of blocks a generation's last observed launch sits behind the head
 * block of the run. Useful for showing that all three were recently active.
 */
export function blocksBehindHead(
  generation: GenerationSummary,
  headBlock: number
): number {
  return Math.max(0, headBlock - generation.lastObservedLaunchBlock);
}

/**
 * True when every generation's launchId range is dense from its minimum with
 * no duplicates, which is the indexer's completeness evidence.
 */
export function allRangesDense(snapshot: IndexerSnapshot): boolean {
  return snapshot.generations.every(
    (g) =>
      g.launchIdAudit.dense &&
      g.launchIdAudit.duplicateIds === 0 &&
      g.launchIdAudit.max - g.launchIdAudit.min + 1 === g.launchCount
  );
}
