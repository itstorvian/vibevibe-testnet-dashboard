import type { IndexerSnapshot } from "@/data/types";
import { validateParticipantSnapshot } from "@/data/participants";
import { validateIncrementalOverview } from "@/data/incremental";
import { snapshot20260918head121309670 as prefix } from "./2026-09-18-121309670";
import { currentSource } from "./source-2026-09-26-124399779";
import participantArtifact from "./participants-2026-09-26-124399779.json";
import overviewArtifact from "./overview-2026-09-26-124399779.json";

const participants = validateParticipantSnapshot(participantArtifact, currentSource);
const overview = validateIncrementalOverview(overviewArtifact, currentSource);

/** Reconciled historical prefix plus the complete adjacent delta; Explore stays separate. */
export const snapshot20260926head124399779 = {
  ...prefix,
  run: {
    validationDate: "2026-09-26",
    finishedAt: currentSource.source.finishedAt,
    headBlock: currentSource.source.headBlock,
    launchScanIsFullHistory: true,
    curveScanIsFullHistory: true,
    windowedScans: { burns: null },
    sanityChecks: { passed: 10, total: 10 },
  },
  verification: {
    ...prefix.verification,
    feeModels: { ...prefix.verification.feeModels, evidence: "Fee rates and splits were verified by the September 18 run. This incremental event update did not re-read curve economics." },
    addressBook: { ...prefix.verification.addressBook, evidence: "Factory addresses and deployment blocks retain their September 13 verification. The September 26 configuration check found the same published factories and infrastructure; pinned factory counters matched all launch IDs." },
  },
  generations: overview.generations.map(row => {
    const previous = prefix.generations.find(g => g.id === row.generation)!;
    return {
      ...previous,
      launchCount: row.launchCount,
      launchIdAudit: row.launchIdAudit,
      lastObservedLaunchBlock: row.lastObservedLaunchBlock,
      observedStillProducingLaunches: row.deltaLaunchCount > 0,
      note: row.deltaLaunchCount.toLocaleString("en-US") + " launches were added in the delta. The latest observed launch is " + (overview.sourceRun.headBlock - row.lastObservedLaunchBlock).toLocaleString("en-US") + " blocks below the pinned head. Operator labels do not determine inclusion.",
    };
  }),
  activity: {
    ...prefix.activity,
    uniqueTransactionCount: overview.counts.uniqueTransactionCount,
    components: { launch: overview.counts.launchTransactionCount, trade: overview.counts.tradeTransactionCount, lifecycle: overview.counts.lifecycleTransactionCount },
    sharedAcrossCategories: overview.counts.sharedAcrossCategories,
    exclusions: [...prefix.activity.exclusions.slice(0, -1), "Unconfigured factories remain outside metric scope. Incremental discovery stops on unknown published factories or launch-event emitters; unpublished deployments with different event signatures may remain undetected."],
  },
  participants,
  coverage: {
    factoryDiscovery: "manually-configured",
    factoriesConfigured: 3,
    unrecognizedCurveEventLogs: overview.counts.foreignCurveLogs,
    unrecognizedContractsSampled: overview.foreignCurveAddressCount,
    unrecognizedContractSampleIsCapped: false,
    note: "The original 97,733-launch prefix through block 121,309,670 was reproduced unchanged. A contiguous delta covers 121,309,671–124,399,779. The operator configuration and pinned factory getters matched the configured factory and infrastructure addresses; its application deployment version changed. A topic-only launch-event scan of the complete delta found no unconfigured launch emitter. The delta excludes 34 curve-topic logs from 12 contracts outside the combined launch registry; the cumulative excluded total is 536 logs from 97 distinct contracts. September 18's separate review of 86 historical foreign contracts is retained as historical evidence; the new foreign emitters are excluded by project attribution and are not claimed to have undergone that bytecode review. No canonical registry establishes every possible factory, and different event signatures remain outside discovery. The last preserved historical event hash is at 121,309,669; the event-free old-head block 121,309,670 is inherited from the validated prefix. Canonical head hashes were checked before and after the delta scan; this is a pinned snapshot without a finality claim.",
  },
  source: { ...prefix.source, validationReport: "INCREMENTAL_VALIDATION_2026-09-26.md" },
} satisfies IndexerSnapshot;
