/**
 * The run the static Explore shards were built from.
 *
 * Overview and Explore were built from one run until 2026-09-18, and the
 * contract said they could not drift apart. That held while every adopted run
 * enriched head state for every launch.
 *
 * The run that established the transaction count did not. Counting transactions
 * needs full-history launch and curve scans; it does not need `name`, `symbol`
 * or lifecycle state per launch, and reading those for ~98,000 launches is tens
 * of thousands of extra RPC calls against a shared public endpoint. That run was
 * therefore deliberately scoped to a small enrichment sample, which is enough
 * for the Overview and not enough to rebuild a browsable table: every row would
 * have lost its name, symbol and status.
 *
 * So Explore keeps the shards from the run that can populate them, and each
 * surface names its own run rather than one borrowing the other's head block.
 * That is the honest failure mode: a stale but complete and correctly labelled
 * table beats a current one full of nulls, and beats either one silently
 * claiming a block height it was not built at.
 *
 * Every field here is cross-checked against the generated manifest by
 * `test/explore.test.ts`, so this description can never drift from the shards
 * it describes. Rebuilding the shards from a fully enriched run and repointing
 * `activeSnapshot` at that same run collapses the two back into one.
 */
export interface ExploreSource {
  /** Calendar date of the run the shards were built from, ISO 8601 date. */
  validationDate: string;
  /** Head block THAT run observed. Not the Overview's head block. */
  headBlock: number;
  /** Launches in the shards. Pinned against `manifest.totals.all`. */
  launchCount: number;
  /** Why this run and not the Overview's, in one sentence. */
  note: string;
}

export const exploreSource: ExploreSource = {
  validationDate: "2026-09-17",
  headBlock: 120_753_391,
  launchCount: 96_490,
  note:
    "Built from the fully enriched run of 2026-09-17. The later run that established the " +
    "transaction count on the Overview sampled head state rather than reading it for every " +
    "launch, so it cannot populate a browsable table.",
};
