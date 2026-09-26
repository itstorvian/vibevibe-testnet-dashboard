import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import frozenArtifact from "@/data/snapshots/participants-2026-09-18-121309670.json";
import { snapshot20260918head121309670 } from "@/data/snapshots/2026-09-18-121309670";
import { ProvenancePanel } from "@/components/provenance-panel";
import { LimitationsNote } from "@/components/limitations-note";
import type { IndexerSnapshot } from "@/data/types";
import {
  PARTICIPANT_PREFIX_MANIFEST_SHA256,
  PARTICIPANT_SOURCE,
  PARTICIPANT_SOURCE_COUNTS,
  validateParticipantSnapshot,
  type ParticipantSnapshot,
} from "@/data/participants";
import {
  validateIncrementalOverview,
  type IncrementalOverview,
  type IncrementalOverviewExpectation,
} from "@/data/incremental";

/** Synthetic pins test the boundary; these never select a published snapshot. */
function pins(): IncrementalOverviewExpectation {
  return {
    source: {
      ...PARTICIPANT_SOURCE,
      headBlock: PARTICIPANT_SOURCE.headBlock + 20,
      headBlockHash: "0x" + "1".repeat(64),
      startedAt: "2026-09-25T12:00:00.000Z",
      finishedAt: "2026-09-25T12:01:00.000Z",
    },
    counts: {
      ...PARTICIPANT_SOURCE_COUNTS,
      launchRecords: PARTICIPANT_SOURCE_COUNTS.launchRecords + 2,
      buyEvents: PARTICIPANT_SOURCE_COUNTS.buyEvents + 3,
      sellEvents: PARTICIPANT_SOURCE_COUNTS.sellEvents + 2,
      lifecycleEvents: PARTICIPANT_SOURCE_COUNTS.lifecycleEvents + 1,
      foreignCurveLogs: PARTICIPANT_SOURCE_COUNTS.foreignCurveLogs + 2,
      uniqueTransactionCount: PARTICIPANT_SOURCE_COUNTS.uniqueTransactionCount + 7,
      launchTransactionCount: PARTICIPANT_SOURCE_COUNTS.launchTransactionCount + 2,
      tradeTransactionCount: PARTICIPANT_SOURCE_COUNTS.tradeTransactionCount + 5,
      lifecycleTransactionCount: PARTICIPANT_SOURCE_COUNTS.lifecycleTransactionCount + 1,
      sharedAcrossCategories: PARTICIPANT_SOURCE_COUNTS.sharedAcrossCategories + 1,
    },
    method: "incremental-cache-replay",
    inputManifestSha256: "a".repeat(64),
    incremental: {
      prefixHeadBlock: PARTICIPANT_SOURCE.headBlock,
      deltaFromBlock: PARTICIPANT_SOURCE.headBlock + 1,
      deltaToBlock: PARTICIPANT_SOURCE.headBlock + 20,
      prefixManifestSha256: PARTICIPANT_PREFIX_MANIFEST_SHA256,
      deltaManifestSha256: "b".repeat(64),
      proofFile: "incremental-proof.json",
      proofSha256: "c".repeat(64),
    },
    participantSha256: "d".repeat(64),
    foreignCurveAddressCount: 87,
    factories: [
      { generation: "retired", factory: "0x4FEbC267e0C24440bcDEF72B5DBC5FE7BED091dF", prefixLaunchCount: 14_800,
        prefixLastObservedLaunchBlock: 121_064_267 },
      { generation: "legacy", factory: "0xB5B7A2f6c4EAFa2D73918fcA32d50e2126339eb9", prefixLaunchCount: 43_220,
        prefixLastObservedLaunchBlock: 121_093_373 },
      { generation: "current", factory: "0x40f1be6faf8DAB9C143cce1a0A04c2075Fb2DF59", prefixLaunchCount: 39_713,
        prefixLastObservedLaunchBlock: 121_306_584 },
    ],
  };
}

function participantFixture(): ParticipantSnapshot {
  const expected = pins();
  const p = structuredClone(frozenArtifact) as ParticipantSnapshot;
  p.sourceRunHeadBlock = expected.source.headBlock;
  p.sourceRun = {
    chainId: expected.source.chainId,
    headBlock: expected.source.headBlock,
    headBlockHash: expected.source.headBlockHash,
    startedAt: expected.source.startedAt,
    finishedAt: expected.source.finishedAt,
  };
  p.derivedAt = "2026-09-25T12:02:00.000Z";
  p.launchScan.toBlock = p.curveScan.toBlock = expected.source.headBlock;
  p.integrity.launchRecords = expected.counts.launchRecords;
  p.integrity.tradeRecords = expected.counts.buyEvents + expected.counts.sellEvents;
  p.validation = {
    coverageComplete: true,
    reconciled: true,
    method: expected.method,
    counts: { ...expected.counts },
    inputManifest: "participants-input-manifest.json",
    inputManifestSha256: expected.inputManifestSha256,
    incremental: { ...expected.incremental },
  };
  return p;
}

function overviewFixture(): IncrementalOverview {
  const expected = pins();
  const { startBlock, ...sourceRun } = expected.source;
  return {
    schemaVersion: 1,
    sourceRun,
    sourceRunStartBlock: startBlock,
    counts: { ...expected.counts },
    generations: expected.factories.map((f) => {
      const deltaLaunchCount = f.generation === "current" ? 2 : 0;
      const launchCount = f.prefixLaunchCount + deltaLaunchCount;
      return {
        generation: f.generation,
        factory: f.factory,
        launchCount,
        deltaLaunchCount,
        lastObservedLaunchBlock: deltaLaunchCount ? expected.source.headBlock - 1 : f.prefixLastObservedLaunchBlock!,
        launchIdAudit: { min: 0, max: launchCount - 1, dense: true, duplicateIds: 0 },
      };
    }),
    foreignCurveAddressCount: expected.foreignCurveAddressCount,
    participantSha256: expected.participantSha256,
    proofSha256: expected.incremental.proofSha256,
  };
}

function change<T>(input: T, path: string[], value: unknown): T {
  let target = input as Record<string, unknown>;
  for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[path[path.length - 1]!] = value;
  return input;
}

describe("explicit incremental participant publication", () => {
  it("accepts a reviewed contiguous extension while preserving the default frozen gate", () => {
    expect(validateParticipantSnapshot(frozenArtifact).sourceRunHeadBlock).toBe(PARTICIPANT_SOURCE.headBlock);
    const input = participantFixture();
    expect(validateParticipantSnapshot(input, pins())).toBe(input);
    expect(() => validateParticipantSnapshot(input)).toThrow("sourceRunHeadBlock");
    expect(() => validateParticipantSnapshot(frozenArtifact, pins())).toThrow("sourceRunHeadBlock");
  });

  it.each([
    [["sourceRunHeadBlock"], 121_309_670],
    [["sourceRun", "headBlockHash"], undefined],
    [["sourceRun", "headBlockHash"], "0x" + "2".repeat(64)],
    [["sourceRun", "finishedAt"], "2026-09-25T12:01:01.000Z"],
    [["launchScan", "fromBlock"], 121_309_671],
    [["curveScan", "toBlock"], 121_309_670],
    [["validation", "method"], "indexed-run"],
    [["validation", "reconciled"], false],
    [["validation", "coverageComplete"], false],
    [["validation", "inputManifestSha256"], "e".repeat(64)],
    [["validation", "incremental"], undefined],
    [["validation", "incremental", "prefixHeadBlock"], 121_309_669],
    [["validation", "incremental", "deltaFromBlock"], 121_309_672],
    [["validation", "incremental", "deltaToBlock"], 121_309_689],
    [["validation", "incremental", "prefixManifestSha256"], "e".repeat(64)],
    [["validation", "incremental", "deltaManifestSha256"], "e".repeat(64)],
    [["validation", "incremental", "proofSha256"], "e".repeat(64)],
    [["validation", "incremental", "proofFile"], "another-proof.json"],
    [["validation", "counts", "uniqueTransactionCount"], 2_098_026],
  ] as [string[], unknown][])("rejects an artifact mismatching publication pins at %j", (path, value) => {
    expect(() => validateParticipantSnapshot(change(participantFixture(), path, value), pins())).toThrow();
  });

  it.each([
    [["source", "chainId"], 1],
    [["source", "startBlock"], 121_309_671],
    [["source", "headBlock"], 121_309_670],
    [["source", "headBlockHash"], "invalid"],
    [["source", "startedAt"], "2026-09-01T12:00:00.000Z"],
    [["source", "finishedAt"], "2026-09-25T11:59:00.000Z"],
    [["incremental", "deltaFromBlock"], 121_309_672],
    [["incremental", "prefixHeadBlock"], 121_309_671],
    [["incremental", "deltaToBlock"], 121_309_689],
    [["incremental", "prefixManifestSha256"], "e".repeat(64)],
    [["incremental", "deltaManifestSha256"], "invalid"],
    [["counts", "launchRecords"], 97_732],
    [["counts", "unusableTransactionHashes"], 1],
    [["counts", "uniqueTransactionCount"], 2_098_040],
  ] as [string[], unknown][])("rejects invalid expectations at %j", (path, value) => {
    expect(() => validateParticipantSnapshot(participantFixture(), change(pins(), path, value))).toThrow();
  });
});

describe("incremental Overview publication boundary", () => {
  it("accepts explicit source and artifact pins, preserving old factory identities", () => {
    const input = overviewFixture();
    expect(validateIncrementalOverview(input, pins())).toBe(input);
  });

  it("rejects publication pins that rewrite or remove a historical factory", () => {
    for (const [path, value] of [
      [["factories", "0", "prefixLaunchCount"], 14_799],
      [["factories", "0", "prefixLastObservedLaunchBlock"], 121_064_268],
      [["factories", "0", "factory"], "0x" + "e".repeat(40)],
      [["factories"], pins().factories.slice(1)],
    ] as [string[], unknown][]) {
      expect(() => validateIncrementalOverview(overviewFixture(), change(pins(), path, value))).toThrow();
    }
  });

  it.each([
    [["schemaVersion"], 2], [["sourceRunStartBlock"], 121_309_671],
    [["sourceRun", "headBlock"], 121_309_670], [["sourceRun", "headBlockHash"], "0x" + "2".repeat(64)], [["counts", "launchRecords"], 97_733],
    [["participantSha256"], "e".repeat(64)], [["proofSha256"], "e".repeat(64)],
    [["foreignCurveAddressCount"], 86], [["generations"], []],
    [["generations", "0", "generation"], "current"],
    [["generations", "0", "factory"], "0x" + "e".repeat(40)],
    [["generations", "0", "lastObservedLaunchBlock"], 121_309_675],
    [["generations", "2", "deltaLaunchCount"], 1],
    [["generations", "2", "lastObservedLaunchBlock"], 121_309_670],
    [["generations", "2", "launchIdAudit", "dense"], false],
    [["generations", "2", "launchIdAudit", "max"], 39_712],
    [["generations", "2", "launchIdAudit", "duplicateIds"], 1],
  ] as [string[], unknown][])("rejects invalid Overview data at %j", (path, value) => {
    expect(() => validateIncrementalOverview(change(overviewFixture(), path, value), pins())).toThrow();
  });
});

describe("incremental provenance presentation", () => {
  const snapshot: IndexerSnapshot = {
    ...snapshot20260918head121309670,
    run: {
      ...snapshot20260918head121309670.run,
      headBlock: pins().source.headBlock,
      validationDate: "2026-09-25",
      finishedAt: pins().source.finishedAt,
      windowedScans: { burns: null },
    },
    participants: validateParticipantSnapshot(participantFixture(), pins()),
    coverage: {
      ...snapshot20260918head121309670.coverage,
      note: "Historical foreign contracts were reviewed separately. Newly observed emitters retain the delta review scope.",
    },
  };

  it("discloses the preserved prefix, exact delta and proof hash without refreshing economics evidence", () => {
    const markup = renderToStaticMarkup(ProvenancePanel({ snapshot }));
    expect(markup).toContain("Preserved prefix + validated delta");
    expect(markup).toContain("121,309,670");
    expect(markup).toContain("121,309,671–121,309,690");
    expect(markup).toContain(pins().incremental.proofSha256);
    expect(markup).toContain("incremental-proof.json");
    expect(snapshot.verification.feeModels.date).toBe("2026-09-18");
    expect(snapshot.verification.graduationTargets.date).toBe("2026-09-13");
    expect(markup).toContain("retain their own verification dates");
    expect(markup).not.toContain("Everything on this page comes from that single run");
  });

  it("renders the adopted coverage evidence without claiming all new foreign emitters were reviewed", () => {
    const markup = renderToStaticMarkup(LimitationsNote({ snapshot }));
    expect(markup).toContain(snapshot.coverage.note);
    expect(markup).not.toContain("Every contract behind those logs was reviewed by hand");
    expect(markup).not.toContain("real totals are already higher");
  });
});
