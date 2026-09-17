/**
 * The dashboard's internal data contract.
 *
 * This mirrors terminology used by the upstream indexer
 * (itstorvian/vibevibe-testnet-indexer) rather than inventing new names.
 * Where a field maps to an indexer output field, the mapping is noted.
 *
 * Nothing here is live. Every value originates from a completed, validated
 * indexing run and is labelled with the head block it was observed at.
 */

/** Indexer `generation`. Factory generations observed on chain 46630. */
export type GenerationId = "retired" | "legacy" | "current";

/**
 * Whether a value was read on chain or deliberately left unread.
 *
 * `not-verified` is never a default and never implies zero or unknown. The
 * indexer refuses to inherit one generation's economics for another, so the
 * dashboard has to be able to render that absence honestly.
 */
export type VerificationStatus = "verified-onchain" | "not-verified";

/**
 * Per-generation trading economics.
 *
 * Fee policy is NOT uniform across generations. The retired generation runs
 * 100 bps at a 50/50 split while legacy and current run 125 bps at 75/25.
 */
export interface FeeModel {
  /** `curve.TOTAL_FEE_BPS()`. */
  totalFeeBps: number;
  /** Creator's share of the total fee, in bps. */
  creatorShareOfFeeBps: number;
  /** Remainder of the total fee, in bps. */
  protocolShareOfFeeBps: number;
  /** Verbatim evidence string from the indexer's factory config. */
  evidence: string;
  /**
   * When the rate and split were last read on chain.
   *
   * Separate from the graduation target below on purpose: a run can re-confirm
   * fees without touching graduation parameters, and conflating the two would
   * make unverified values look freshly checked.
   */
  verifiedAt: string;
}

/**
 * `curve.NET_GRADUATION_TARGET()`.
 *
 * When `status` is `not-verified`, `wei` and `display` are both null. The
 * legacy generation's target was deliberately not read rather than assumed
 * equal to the current generation's.
 */
export interface GraduationTarget {
  status: VerificationStatus;
  /** When the target was read on chain. Null when it never was. */
  verifiedAt: string | null;
  /** Decimal string of wei. Never a JS number. */
  wei: string | null;
  /** Short human form, for example "0.005 ETH". */
  display: string | null;
}

/**
 * Completeness evidence for a generation's launch set.
 *
 * Every factory numbers its launches from 0 independently. A dense range with
 * no duplicates is how the indexer demonstrates that no launch was missed:
 * a missing launch would appear as a hole in the sequence.
 */
export interface LaunchIdAudit {
  min: number;
  max: number;
  dense: boolean;
  duplicateIds: number;
}

/**
 * One observed factory generation.
 *
 * Note there is deliberately no globally unique launch identifier anywhere in
 * this contract. `launchId` counters restart per factory, so a launch is only
 * identifiable as `{generation}:{launchId}` or by its token address.
 */
export interface GenerationSummary {
  /** Indexer `generation`. */
  id: GenerationId;
  /** Indexer `label`, for example "gen1". */
  label: string;
  /** Human name shown in the interface. */
  displayName: string;
  factory: `0x${string}`;
  /** Block of the factory's creation transaction. */
  deploymentBlock: number;
  /** Indexer `launchesIndexed` for this generation. */
  launchCount: number;
  launchIdAudit: LaunchIdAudit;
  /** Most recent block at which this factory was seen emitting a launch. */
  lastObservedLaunchBlock: number;
  /**
   * Observed on chain, not inferred from the operator's label. The generation
   * the operator files as "retired" was still producing launches.
   */
  observedStillProducingLaunches: boolean;
  /** How the operator's published config listed this factory on the run date. */
  operatorListing: string;
  feeModel: FeeModel;
  graduationTarget: GraduationTarget;
  /** Short note surfaced in the interface. */
  note: string;
}

/** How complete the indexed picture can claim to be. */
export interface CoverageNote {
  /** No on-chain factory registry was identified, so this is hand maintained. */
  factoryDiscovery: "manually-configured";
  factoriesConfigured: number;
  /**
   * Contracts that emitted a curve-shaped event but are not a configured
   * factory's curve, within the run's trade window. A new factory generation
   * would show up here. Zero on this run.
   */
  unrecognizedCurveEventContracts: number;
  note: string;
}

/** One area of the dataset, and when it was last established on chain. */
export interface VerificationRecord {
  /** ISO 8601 date of the run that established these values. */
  date: string;
  /** What that run actually did, in one sentence. */
  evidence: string;
}

/** Where the numbers came from, so a reader can check them. */
export interface SnapshotSource {
  indexerName: string;
  indexerVersion: string;
  repositoryUrl: string;
  /** Filename of the validation report backing this snapshot. */
  validationReport: string;
}

/**
 * A point-in-time indexing result.
 *
 * `dataKind` is a literal union with no "live" member on purpose. Labelling
 * snapshot data as live would be a type error, not a review catch.
 */
export interface IndexerSnapshot {
  schemaVersion: 1;
  dataKind: "point-in-time-validated-run";
  access: "read-only";
  environment: "testnet";

  network: {
    name: string;
    chainId: number;
    explorerBase: string;
    /** Sanitized public endpoint. Never carries a key. */
    rpcEndpoint: string;
  };

  run: {
    /** Calendar date of the validation run, ISO 8601 date. */
    validationDate: string;
    /** Run completion time, ISO 8601 instant. */
    finishedAt: string;
    /** Head block the run observed. */
    headBlock: number;
    /**
     * Launch reconstruction always scans from the earliest factory deployment
     * to head, which is why launch counts are lifetime totals.
     */
    launchScanIsFullHistory: true;
    /**
     * Scans that were windowed on this run. Anything derived from these is
     * NOT a lifetime total and is deliberately not shown on the overview.
     */
    windowedScans: {
      trades: readonly [number, number];
      burns: readonly [number, number];
    };
    sanityChecks: { passed: number; total: number };
  };

  /**
   * Verification provenance, split by what was actually re-checked.
   *
   * A single date here would imply the latest run re-verified everything. It
   * did not: it re-read fee rates and splits across every curve, but never
   * read NET_GRADUATION_TARGET and never re-derived the address book. Each
   * area therefore carries its own date and evidence.
   */
  verification: {
    feeModels: VerificationRecord;
    graduationTargets: VerificationRecord;
    addressBook: VerificationRecord;
  };

  generations: readonly GenerationSummary[];
  coverage: CoverageNote;
  source: SnapshotSource;
}
