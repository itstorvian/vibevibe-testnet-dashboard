import type { IndexerSnapshot } from "@/data/types";

/**
 * Authoritative snapshot: the full-enrichment run of 2026-09-17 at head block
 * 120,753,391.
 *
 * This supersedes the earlier 2026-09-17 run at head 120,708,793. Both happened
 * on the same date, so snapshots are named by head block as well as date.
 *
 * WHAT THIS RUN ESTABLISHED, and what it did not:
 *
 *   Re-verified on chain by this run
 *     - launch counts and launchId ranges (full-history scan to head)
 *     - fee rate and creator/protocol split: TOTAL_FEE_BPS read across all
 *       96,490 curves, and 52,650/52,650 trades matched within 2 wei
 *     - name, symbol, launch timestamp and lifecycle state for every launch
 *
 *   NOT re-verified by this run, and deliberately still dated 2026-09-13
 *     - graduation targets. Stage 4b reads twelve curve functions and
 *       NET_GRADUATION_TARGET is not among them
 *     - the factory address book and its supporting evidence
 *
 * `totalLaunches` is absent on purpose. It is summed from the generations in
 * `@/data/derive`, so the headline can never drift from its parts.
 */
export const snapshot20260917head120753391 = {
  schemaVersion: 1,
  dataKind: "point-in-time-validated-run",
  access: "read-only",
  environment: "testnet",

  network: {
    name: "Robinhood Chain Testnet",
    chainId: 46630,
    explorerBase: "https://explorer.testnet.chain.robinhood.com",
    rpcEndpoint: "https://rpc.testnet.chain.robinhood.com",
  },

  run: {
    validationDate: "2026-09-17",
    finishedAt: "2026-09-17T11:29:01.629Z",
    headBlock: 120_753_391,
    launchScanIsFullHistory: true,
    windowedScans: {
      trades: [120_553_391, 120_753_391],
      burns: [118_753_391, 120_753_391],
    },
    sanityChecks: { passed: 5, total: 5 },
  },

  verification: {
    feeModels: {
      date: "2026-09-17",
      evidence:
        "Re-read on chain by this run. TOTAL_FEE_BPS was uniform within each generation across all 96,490 curves, and 52,650 of 52,650 indexed trades matched their generation's rate and split within 2 wei.",
    },
    graduationTargets: {
      date: "2026-09-13",
      evidence:
        "Read on chain during the earlier address-book verification. This run did not re-read NET_GRADUATION_TARGET, so these values keep their original date.",
    },
    addressBook: {
      date: "2026-09-13",
      evidence:
        "Factory addresses, deployment blocks and per-generation infrastructure were verified on chain then. This run scanned those factories but did not re-derive the address book.",
    },
  },

  generations: [
    {
      id: "retired",
      label: "gen1",
      displayName: "Retired",
      factory: "0x4FEbC267e0C24440bcDEF72B5DBC5FE7BED091dF",
      deploymentBlock: 95_916_239,
      launchCount: 14_799,
      launchIdAudit: { min: 0, max: 14_798, dense: true, duplicateIds: 0 },
      lastObservedLaunchBlock: 120_622_795,
      observedStillProducingLaunches: true,
      operatorListing:
        "Absent from every published operator list. The retired list was empty on the run date.",
      feeModel: {
        totalFeeBps: 100,
        creatorShareOfFeeBps: 5_000,
        protocolShareOfFeeBps: 5_000,
        evidence:
          "VERIFIED ONCHAIN: TOTAL_FEE_BPS reads 100 on retired curves, and every indexed retired trade matched 100 bps at a 5000 bps creator share within 2 wei.",
        verifiedAt: "2026-09-17",
      },
      graduationTarget: {
        status: "verified-onchain",
        verifiedAt: "2026-09-13",
        wei: "5000000000000000",
        display: "0.005 ETH",
      },
      note:
        "Retired is the operator's label, not an observed state. It produced no new launches between the two runs of 2026-09-17, but its 14,799 launches are real and a maintainer who dropped it would lose about 15% of the dataset. Its economics differ from the newer generations.",
    },
    {
      id: "legacy",
      label: "gen2",
      displayName: "Legacy",
      factory: "0xB5B7A2f6c4EAFa2D73918fcA32d50e2126339eb9",
      deploymentBlock: 108_435_450,
      launchCount: 43_016,
      launchIdAudit: { min: 0, max: 43_015, dense: true, duplicateIds: 0 },
      lastObservedLaunchBlock: 120_753_168,
      observedStillProducingLaunches: true,
      operatorListing: "Published by the operator as a legacy graph.",
      feeModel: {
        totalFeeBps: 125,
        creatorShareOfFeeBps: 7_500,
        protocolShareOfFeeBps: 2_500,
        evidence:
          "VERIFIED ONCHAIN: TOTAL_FEE_BPS reads 125 on legacy curves, and every indexed legacy trade matched 125 bps at 7500 bps within 2 wei.",
        verifiedAt: "2026-09-17",
      },
      graduationTarget: {
        status: "not-verified",
        verifiedAt: null,
        wei: null,
        display: null,
      },
      note:
        "Largest generation by launch count, and still the most active: its most recent launch sits 223 blocks below the head. Its graduation target has never been read on chain, so it stays unverified rather than borrowing another generation's.",
    },
    {
      id: "current",
      label: "gen3",
      displayName: "Current",
      factory: "0x40f1be6faf8DAB9C143cce1a0A04c2075Fb2DF59",
      deploymentBlock: 115_025_604,
      launchCount: 38_675,
      launchIdAudit: { min: 0, max: 38_674, dense: true, duplicateIds: 0 },
      lastObservedLaunchBlock: 120_741_383,
      observedStillProducingLaunches: true,
      operatorListing: "Published by the operator as the active deployment.",
      feeModel: {
        totalFeeBps: 125,
        creatorShareOfFeeBps: 7_500,
        protocolShareOfFeeBps: 2_500,
        evidence:
          "VERIFIED ONCHAIN: TOTAL_FEE_BPS reads 125 on current curves, and every indexed current trade matched 125 bps at 7500 bps within 2 wei.",
        verifiedAt: "2026-09-17",
      },
      graduationTarget: {
        status: "verified-onchain",
        verifiedAt: "2026-09-13",
        wei: "5000000000000000000",
        display: "5 ETH",
      },
      note:
        "The generation the operator's own interface launches into today.",
    },
  ],

  coverage: {
    factoryDiscovery: "manually-configured",
    factoriesConfigured: 3,
    unrecognizedCurveEventContracts: 0,
    note:
      "No on-chain registry listing factory deployments was identified, so the indexer's factory list is maintained by hand. A factory that is not configured is never scanned and would be missing here without any error. The run saw no unrecognized contract emitting curve events, which is a weak signal rather than proof that none exists.",
  },

  source: {
    indexerName: "vibevibe-testnet-indexer",
    indexerVersion: "0.1.0",
    repositoryUrl: "https://github.com/itstorvian/vibevibe-testnet-indexer",
    validationReport: "LATEST_VALIDATION_2026-09-17.md",
  },
} as const satisfies IndexerSnapshot;
