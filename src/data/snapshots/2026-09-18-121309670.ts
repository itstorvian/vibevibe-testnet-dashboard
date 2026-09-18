import type { IndexerSnapshot } from "@/data/types";

/**
 * Authoritative snapshot: the full-history run of 2026-09-18 at head block
 * 121,309,670.
 *
 * This supersedes the run of 2026-09-17 at head 120,753,391, which in turn
 * superseded an earlier 2026-09-17 run at head 120,708,793. None of those
 * figures have been back-fitted to these; the chain kept producing launches
 * between them, so the totals differ and are meant to.
 *
 * WHY THIS RUN EXISTS. Every previous run scanned curve events over a bounded
 * window, which is enough for launch totals and not enough for a transaction
 * count: a window's worth of transactions printed beside lifetime launch totals
 * would be a misrepresentation. This run scanned curve events from the earliest
 * factory deployment to head (`--full-trades`), which is what makes `activity`
 * below a lifetime figure.
 *
 *   npm run index -- --full-trades --enrich-limit 800 --burn-window 2000000 --compare-api
 *
 * WHAT THIS RUN ESTABLISHED
 *   - launch counts and launchId ranges, full history to head, all three
 *     generations dense with zero duplicates
 *   - the transaction count: 2,098,026 distinct hashes across full-history
 *     launch and curve activity
 *   - fee rate and creator/protocol split: TOTAL_FEE_BPS uniform within each
 *     generation across the 800 curves read, and 1,979,591 of 1,979,591
 *     non-dust trades matched their generation's rate and split within 2 wei
 *
 * WHAT IT DID NOT
 *   - head state for every launch. `--enrich-limit 800` was deliberate: name,
 *     symbol and lifecycle state are irrelevant to a transaction count and
 *     reading them for 97,733 launches is tens of thousands of RPC calls
 *     against a shared public endpoint. Lifecycle counts on this page are
 *     therefore NOT carried, and Explore still browses the fully enriched
 *     2026-09-17 run. See `@/data/explore-source`.
 *   - graduation targets. Stage 4b reads twelve curve functions and
 *     NET_GRADUATION_TARGET is not among them, so those keep their 2026-09-13
 *     date.
 *   - the factory address book, which also keeps its 2026-09-13 date.
 *
 * `totalLaunches` is absent on purpose. It is summed from the generations in
 * `@/data/derive`, so the headline can never drift from its parts.
 */
export const snapshot20260918head121309670 = {
  schemaVersion: 2,
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
    validationDate: "2026-09-18",
    finishedAt: "2026-09-18T17:00:25.492Z",
    headBlock: 121_309_670,
    launchScanIsFullHistory: true,
    curveScanIsFullHistory: true,
    windowedScans: {
      burns: [119_309_670, 121_309_670],
    },
    sanityChecks: { passed: 5, total: 5 },
  },

  verification: {
    feeModels: {
      date: "2026-09-18",
      evidence:
        "Re-read on chain by this run. TOTAL_FEE_BPS was uniform within each generation across the 800 curves read, and 1,979,591 of 1,979,591 non-dust trades from the full-history scan matched their generation's rate and split within 2 wei.",
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
      launchCount: 14_800,
      launchIdAudit: { min: 0, max: 14_799, dense: true, duplicateIds: 0 },
      lastObservedLaunchBlock: 121_064_267,
      observedStillProducingLaunches: true,
      operatorListing:
        "Absent from every published operator list. The retired list was empty on the run date.",
      feeModel: {
        totalFeeBps: 100,
        creatorShareOfFeeBps: 5_000,
        protocolShareOfFeeBps: 5_000,
        evidence:
          "VERIFIED ONCHAIN: TOTAL_FEE_BPS reads 100 on retired curves, and all 508,376 non-dust retired trades in the full-history scan matched 100 bps at a 5000 bps creator share within 2 wei.",
        verifiedAt: "2026-09-18",
      },
      graduationTarget: {
        status: "verified-onchain",
        verifiedAt: "2026-09-13",
        wei: "5000000000000000",
        display: "0.005 ETH",
      },
      note:
        "Retired is the operator's label, not an observed state. It added a single launch since the previous run and its most recent one sits 245,403 blocks below the head, but its 14,800 launches are real and a maintainer who dropped it would lose about 15% of the dataset. Its economics differ from the newer generations.",
    },
    {
      id: "legacy",
      label: "gen2",
      displayName: "Legacy",
      factory: "0xB5B7A2f6c4EAFa2D73918fcA32d50e2126339eb9",
      deploymentBlock: 108_435_450,
      launchCount: 43_220,
      launchIdAudit: { min: 0, max: 43_219, dense: true, duplicateIds: 0 },
      lastObservedLaunchBlock: 121_093_373,
      observedStillProducingLaunches: true,
      operatorListing: "Published by the operator as a legacy graph.",
      feeModel: {
        totalFeeBps: 125,
        creatorShareOfFeeBps: 7_500,
        protocolShareOfFeeBps: 2_500,
        evidence:
          "VERIFIED ONCHAIN: TOTAL_FEE_BPS reads 125 on legacy curves, and all 899,291 non-dust legacy trades in the full-history scan matched 125 bps at 7500 bps within 2 wei.",
        verifiedAt: "2026-09-18",
      },
      graduationTarget: {
        status: "not-verified",
        verifiedAt: null,
        wei: null,
        display: null,
      },
      note:
        "Largest generation by launch count, though the current factory is now the one producing launches closest to the head. Its graduation target has never been read on chain, so it stays unverified rather than borrowing another generation's.",
    },
    {
      id: "current",
      label: "gen3",
      displayName: "Current",
      factory: "0x40f1be6faf8DAB9C143cce1a0A04c2075Fb2DF59",
      deploymentBlock: 115_025_604,
      launchCount: 39_713,
      launchIdAudit: { min: 0, max: 39_712, dense: true, duplicateIds: 0 },
      lastObservedLaunchBlock: 121_306_584,
      observedStillProducingLaunches: true,
      operatorListing: "Published by the operator as the active deployment.",
      feeModel: {
        totalFeeBps: 125,
        creatorShareOfFeeBps: 7_500,
        protocolShareOfFeeBps: 2_500,
        evidence:
          "VERIFIED ONCHAIN: TOTAL_FEE_BPS reads 125 on current curves, and all 571,924 non-dust current trades in the full-history scan matched 125 bps at 7500 bps within 2 wei.",
        verifiedAt: "2026-09-18",
      },
      graduationTarget: {
        status: "verified-onchain",
        verifiedAt: "2026-09-13",
        wei: "5000000000000000000",
        display: "5 ETH",
      },
      note:
        "The generation the operator's own interface launches into today, and the one producing launches closest to the head: 3,086 blocks below it.",
    },
  ],

  /**
   * Transactions, counted by distinct hash, from `output/activity.json`.
   *
   * The components do not sum to the total and are not meant to: 55,895 hashes
   * appear in more than one category. The clearest case is graduation, where
   * CurveCompleted, Graduated and CreatorFeesForwarded land in the same
   * transaction as the buy that triggered them. 75,459 lifecycle events came
   * from only 62,848 distinct transactions for exactly that reason.
   */
  activity: {
    uniqueTransactionCount: 2_098_026,
    scope: "launch-and-curve-events",
    isFullHistory: true,
    components: {
      launch: 97_733,
      trade: 1_993_340,
      lifecycle: 62_848,
    },
    sharedAcrossCategories: 55_895,
    includedEventSurfaces: [
      "TokenLaunched",
      "TokenLaunchedQuoted",
      "Bought",
      "Sold",
      "CurveCompleted",
      "Graduated",
      "CreatorFeesForwarded",
    ],
    exclusions: [
      "Post-graduation trading. Graduated tokens trade on Uniswap v4 and those swaps are not indexed by this project at all.",
      "Buyback and burn transfers. Burns are ordinary ERC-20 Transfer logs, found by a separate scan with its own block window, so they fall outside this scope.",
      "LaunchFeesClaimed. The factory emits it when the operator sweeps accrued launch fees; it is a treasury action rather than launch or curve activity.",
      "Any transaction that emitted none of the included events: an approval, a plain token transfer, a failed call, or a read.",
      "Launches from a factory generation that is not configured in config/factories.ts. An unconfigured factory is never scanned, silently.",
    ],
  },

  coverage: {
    factoryDiscovery: "manually-configured",
    factoriesConfigured: 3,
    unrecognizedCurveEventLogs: 502,
    unrecognizedContractsSampled: 20,
    unrecognizedContractSampleIsCapped: true,
    note:
      "No on-chain registry listing factory deployments was identified, so the indexer's factory list is maintained by hand. A factory that is not configured is never scanned and would be missing here without any error. This run saw 502 logs carrying a curve event signature from contracts outside the configured factories, across 25,393,432 blocks; the previous run reported none, but its curve scan covered only 200,000 blocks, so the two are not comparable. Those 502 logs came from 86 distinct contracts, and all 86 were reviewed by hand. None matched the bytecode of a Vibe curve from any generation, none answered creatorVault() or TOTAL_FEE_BPS(), none named a token that is a known Vibe launch, and none emitted more than two of the five curve events. Ten form a coherent bonding curve of their own design, which is what a different launchpad sharing an event signature looks like. A topic-only scan for the Vibe launch event across 1,130,000 blocks covering the regions where those contracts were active found only the three configured factories emitting it. That is a bounded negative result for the windows examined, not proof that no other factory exists anywhere in history.",
  },

  source: {
    indexerName: "vibevibe-testnet-indexer",
    indexerVersion: "0.1.0",
    repositoryUrl: "https://github.com/itstorvian/vibevibe-testnet-indexer",
    validationReport: "LATEST_VALIDATION_2026-09-18.md",
  },
} as const satisfies IndexerSnapshot;
