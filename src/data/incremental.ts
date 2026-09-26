import {
  validateIncrementalExpectation,
  type IncrementalParticipantExpectation,
  type ParticipantSourceCounts,
} from "@/data/participants";
import { snapshot20260918head121309670 } from "@/data/snapshots/2026-09-18-121309670";

/** Indexer-produced aggregate metadata; no event counting is performed here. */
export interface IncrementalOverview {
  schemaVersion: 1;
  sourceRun: { chainId: number; headBlock: number; headBlockHash: string; startedAt: string; finishedAt: string };
  sourceRunStartBlock: number;
  counts: ParticipantSourceCounts;
  generations: {
    generation: string;
    factory: string;
    launchCount: number;
    deltaLaunchCount: number;
    lastObservedLaunchBlock: number;
    launchIdAudit: { min: number; max: number; dense: true; duplicateIds: 0 };
  }[];
  foreignCurveAddressCount: number;
  participantSha256: string;
  proofSha256: string;
}

export interface IncrementalOverviewExpectation extends IncrementalParticipantExpectation {
  participantSha256: string;
  foreignCurveAddressCount: number;
  factories: readonly {
    generation: string;
    factory: string;
    prefixLaunchCount: number;
    prefixLastObservedLaunchBlock: number | null;
  }[];
}

function requireValue(condition: unknown, field: string): asserts condition {
  if (!condition) throw new Error(`Invalid incremental Overview: ${field}`);
}

function object(value: unknown, field: string): Record<string, unknown> {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), field);
  return value as Record<string, unknown>;
}

function count(value: unknown, field: string): number {
  requireValue(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, field);
  return value;
}

/**
 * Match a candidate against reviewed publication pins and the preserved prefix.
 * It cannot turn incomplete event data into full-history data; the hashed indexer
 * proof establishes coverage before this publication boundary is reached.
 */
export function validateIncrementalOverview(
  input: unknown,
  expected: IncrementalOverviewExpectation,
): IncrementalOverview {
  validateIncrementalExpectation(expected);
  const overview = object(input, "root");
  requireValue(overview.schemaVersion === 1, "schemaVersion");
  requireValue(overview.sourceRunStartBlock === expected.source.startBlock, "sourceRunStartBlock");
  const source = object(overview.sourceRun, "sourceRun");
  for (const key of ["chainId", "headBlock", "headBlockHash", "startedAt", "finishedAt"] as const) {
    requireValue(source[key] === expected.source[key], `sourceRun.${key}`);
  }
  const counts = object(overview.counts, "counts");
  for (const [key, value] of Object.entries(expected.counts)) {
    requireValue(counts[key] === value, `counts.${key}`);
  }
  requireValue(/^[0-9a-f]{64}$/.test(expected.participantSha256) &&
    overview.participantSha256 === expected.participantSha256, "participantSha256");
  requireValue(overview.proofSha256 === expected.incremental.proofSha256, "proofSha256");
  const foreign = count(overview.foreignCurveAddressCount, "foreignCurveAddressCount");
  requireValue(foreign === expected.foreignCurveAddressCount && foreign <= expected.counts.foreignCurveLogs,
    "foreignCurveAddressCount");

  const factories = expected.factories;
  requireValue(factories.length > 0 && new Set(factories.map((f) => f.generation)).size === factories.length &&
    new Set(factories.map((f) => f.factory.toLowerCase())).size === factories.length, "expected factory identities");
  for (const original of snapshot20260918head121309670.generations) {
    const prefix = factories.find((f) => f.generation === original.id);
    requireValue(prefix && prefix.factory.toLowerCase() === original.factory.toLowerCase() &&
      prefix.prefixLaunchCount === original.launchCount &&
      prefix.prefixLastObservedLaunchBlock === original.lastObservedLaunchBlock,
      "expected factory differs from the preserved historical prefix");
  }
  for (const prefix of factories) {
    if (!snapshot20260918head121309670.generations.some((g) => g.id === prefix.generation)) {
      requireValue(prefix.prefixLaunchCount === 0 && prefix.prefixLastObservedLaunchBlock === null,
        "new factory cannot invent historical prefix coverage");
    }
  }
  requireValue(Array.isArray(overview.generations) && overview.generations.length === factories.length, "generations");
  const seen = new Set<string>();
  let launchTotal = 0;
  for (const item of overview.generations) {
    const generation = object(item, "generation");
    const prefix = factories.find((f) => f.generation === generation.generation);
    requireValue(prefix && !seen.has(prefix.generation), "generation identity");
    seen.add(prefix.generation);
    requireValue(typeof generation.factory === "string" && /^0x[0-9a-fA-F]{40}$/.test(generation.factory) &&
      generation.factory.toLowerCase() === prefix.factory.toLowerCase(), "generation factory");
    count(prefix.prefixLaunchCount, "expected prefixLaunchCount");
    const launches = count(generation.launchCount, "generation launchCount");
    const delta = count(generation.deltaLaunchCount, "generation deltaLaunchCount");
    requireValue(launches > 0 && launches === prefix.prefixLaunchCount + delta, "generation prefix/delta launch counts");
    const audit = object(generation.launchIdAudit, "generation launchIdAudit");
    requireValue(audit.min === 0 && audit.max === launches - 1 && audit.dense === true && audit.duplicateIds === 0,
      "generation dense launch ids");
    const last = count(generation.lastObservedLaunchBlock, "generation lastObservedLaunchBlock");
    requireValue(last >= expected.source.startBlock && last <= expected.source.headBlock,
      "generation last launch bounds");
    if (delta > 0) {
      requireValue(last >= expected.incremental.deltaFromBlock, "new launches missing a delta last block");
    } else {
      requireValue(prefix.prefixLastObservedLaunchBlock !== null && last === prefix.prefixLastObservedLaunchBlock,
        "unchanged generation last launch");
    }
    launchTotal += launches;
  }
  requireValue(launchTotal === expected.counts.launchRecords, "generation launch total");
  return overview as unknown as IncrementalOverview;
}
