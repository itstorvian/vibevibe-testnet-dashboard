/**
 * Explore's static-shard contract.
 *
 * Mirrors scripts/build-explore-index.mjs. The builder is plain JavaScript so
 * it can stream a multi-hundred-megabyte source without a compile step, so
 * these types are the checked half of the agreement and the tests pin them.
 *
 * Deliberately absent: volume, fee totals, burn totals, trade counts, and
 * anything rank-shaped. Those upstream fields are windowed to a block range
 * rather than lifetime, so a browsable table must not carry them.
 */

export type GenerationCode = 0 | 1 | 2;

/** Upstream lifecycle strings, coded. No state is invented. */
export type StatusCode = 0 | 1 | 2;

export const GENERATION_IDS = ["retired", "legacy", "current"] as const;
export type ExploreGenerationId = (typeof GENERATION_IDS)[number];

/** The exact upstream constant each code maps to. */
export const STATUS_UPSTREAM: Record<StatusCode, string> = {
  0: "CURVE_TRADING",
  1: "CURVE_COMPLETE_AWAITING_GRADUATION",
  2: "GRADUATED",
};

export const GENERATION_VIEWS = ["all", "retired", "legacy", "current"] as const;
export type GenerationView = (typeof GENERATION_VIEWS)[number];

export const STATUS_VIEWS = ["any", "trading", "awaiting", "graduated"] as const;
export type StatusView = (typeof STATUS_VIEWS)[number];

/**
 * A row on the wire, positional to keep shards small.
 *
 * Note there is no `key` field. The canonical identity is derived as
 * `{generation}:{launchId}`, which makes a key that disagrees with its own
 * parts impossible to represent.
 */
export type ExploreRow = [
  generation: GenerationCode,
  launchId: number,
  /** 40 lowercase hex characters, no 0x prefix. */
  token: string,
  /** 40 lowercase hex characters, no 0x prefix. */
  creator: string,
  deploymentBlock: number,
  launchTimestamp: number | null,
  /** UNTRUSTED. Creator-controlled. Render as text, never as markup. */
  name: string | null,
  /** UNTRUSTED. Creator-controlled. */
  symbol: string | null,
  status: StatusCode | null,
  isQuotedLaunch: 0 | 1,
];

/** A decoded row, as the interface uses it. */
export interface ExploreLaunch {
  /** `{generation}:{launchId}`. The only safe launch identity. */
  key: string;
  generation: ExploreGenerationId;
  launchId: number;
  token: string;
  creator: string;
  deploymentBlock: number;
  launchTimestamp: number | null;
  name: string | null;
  symbol: string | null;
  status: StatusCode | null;
  isQuotedLaunch: boolean;
}

/**
 * One entry in a name-prefix bucket.
 *
 * Carries status and block alongside the identity so the client can apply the
 * generation filter, the status filter and the sort order to search results
 * without resolving every match to a full row. Only the visible page is
 * resolved through the id index.
 */
export type NameEntry = [
  /** UNTRUSTED. Creator-controlled. */
  name: string | null,
  /** UNTRUSTED. Creator-controlled. */
  symbol: string | null,
  generation: GenerationCode,
  launchId: number,
  status: StatusCode | null,
  deploymentBlock: number,
];

/** A search candidate before its full row is fetched. */
export interface Candidate {
  generation: GenerationCode;
  launchId: number;
  status: StatusCode | null;
  deploymentBlock: number;
}

export interface ExplorePage {
  v: string;
  p: number;
  n: number;
  rows: ExploreRow[];
}

export interface ViewStats {
  total: number;
  pages: number;
  /** Page 0 carries the remainder, so descending is always a single fetch. */
  firstPageRows: number;
}

export interface ExploreManifest {
  schemaVersion: 1;
  builtFrom: { file: string; records: number };
  pageSize: number;
  rowFormat: string[];
  generationCodes: Record<ExploreGenerationId, GenerationCode>;
  statusCodes: Record<string, StatusCode>;
  sort: {
    canonical: string;
    direction: "asc";
    tieBreak: string[];
    note: string;
  };
  totals: { all: number } & Record<ExploreGenerationId, number>;
  lastObservedLaunchBlock: Record<ExploreGenerationId, number>;
  blockRange: { min: number; max: number };
  views: Record<string, ViewStats>;
  indexes: {
    tokenBuckets: number;
    creatorBuckets: number;
    nameBuckets: number;
    nameEntryFormat: string[];
    idBuckets: number;
    /** Launch ids per id-index bucket. */
    idBucketSize: number;
    nameSearchMinChars: number;
  };
}

/** Decode a wire row into the shape the interface renders. */
export function decodeRow(r: ExploreRow): ExploreLaunch {
  const generation = GENERATION_IDS[r[0]];
  if (!generation) throw new Error(`unknown generation code ${r[0]}`);
  return {
    key: `${generation}:${r[1]}`,
    generation,
    launchId: r[1],
    token: `0x${r[2]}`,
    creator: `0x${r[3]}`,
    deploymentBlock: r[4],
    launchTimestamp: r[5],
    name: r[6],
    symbol: r[7],
    status: r[8],
    isQuotedLaunch: r[9] === 1,
  };
}

/** Compose the shard view key from the two filters. */
export function viewKey(generation: GenerationView, status: StatusView): string {
  return `${generation}/${status}`;
}
