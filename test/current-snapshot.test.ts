import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { activeSnapshot, totalLaunches } from "@/data";
import { exploreSource } from "@/data/explore-source";
import { currentSource } from "@/data/snapshots/source-2026-09-26-124399779";
import { validateParticipantSnapshot } from "@/data/participants";
import { validateIncrementalOverview } from "@/data/incremental";
import proof from "@/data/snapshots/proof-2026-09-26-124399779.json";
import overview from "@/data/snapshots/overview-2026-09-26-124399779.json";

const bytes = (name: string) => fs.readFileSync(path.join(process.cwd(), "src/data/snapshots", `${name}-2026-09-26-124399779.json`));
const digest = (name: string) => createHash("sha256").update(bytes(name)).digest("hex");

describe("adopted current-head incremental snapshot", () => {
  it("pins the actual source, source hash, artifact digests and scan bounds", () => {
    expect(activeSnapshot.run.headBlock).toBe(124_399_779);
    expect(activeSnapshot.run.validationDate).toBe("2026-09-26");
    expect(activeSnapshot.run.finishedAt).toBe("2026-09-26T03:52:52.510Z");
    expect(activeSnapshot.participants.sourceRun.headBlockHash).toBe("0x4ac4a3ca08fe235d7a2427088dece9127b70b0ffd44911f1544224e6334da88e");
    expect(digest("participants")).toBe(currentSource.participantSha256);
    expect(digest("proof")).toBe(currentSource.incremental.proofSha256);
    expect(digest("overview")).toBe("7532d11fa7a60fb1cc9515b5ab066e0aa8d3e00096c1f4b96903d9714b398a54");
    expect(validateParticipantSnapshot(JSON.parse(bytes("participants").toString("utf8")), currentSource)).toEqual(activeSnapshot.participants);
    expect(validateIncrementalOverview(overview, currentSource)).toEqual(overview);
    expect(proof.delta.fromBlock).toBe(proof.prefix.sourceRun.headBlock + 1);
    expect(proof.delta.toBlock).toBe(activeSnapshot.run.headBlock);
    expect(activeSnapshot.participants.launchScan.fromBlock).toBe(95_916_239);
    expect(activeSnapshot.participants.curveScan).toEqual(activeSnapshot.participants.launchScan);
  });

  it("publishes reconciled event and globally deduplicated transaction totals", () => {
    expect(totalLaunches(activeSnapshot)).toBe(160_851);
    expect(activeSnapshot.generations.map(g => g.launchCount)).toEqual([14_806, 44_902, 101_143]);
    expect(activeSnapshot.activity.uniqueTransactionCount).toBe(3_431_107);
    expect(activeSnapshot.activity.components).toEqual({ launch: 160_851, trade: 3_318_631, lifecycle: 65_932 });
    expect(activeSnapshot.activity.sharedAcrossCategories).toBe(114_307);
    expect(proof.counts.lifecycleEvents).toBe(78_779);
    expect(proof.delta.counts).toMatchObject({ launchRecords: 63_118, buyEvents: 902_753, sellEvents: 422_538, lifecycleEvents: 3_320, foreignCurveLogs: 34 });
    expect(proof.delta.eventsFromNewCurves).toBe(513_547);
  });

  it("keeps the exact actor, recipient and project-membership definitions and results", () => {
    expect(activeSnapshot.participants).toMatchObject({
      indexedActorAddressCount: 118_251, indexedParticipantAddressCount: 118_251,
      distinctCreatorAddressCount: 65_705, distinctBuyerSellerAddressCount: 111_054,
      distinctBuyRecipientAddressCount: 112_403, distinctTradeParticipantAddressCount: 112_406,
      creatorBuyerSellerOverlap: 58_508, creatorTradeParticipantOverlap: 59_860,
      multiProjectActorAddressCount: 83_462, multiProjectParticipantAddressCount: 83_462,
      recipientOnlyAddressCount: 0,
      integrity: { unusableAddressValues: 0, malformedAddressValues: 0, zeroAddressValues: 0, unmappedTradeEvents: 0 },
    });
    expect(activeSnapshot.participants.includedRoles.actors).not.toContain("Bought.recipient");
  });

  it("preserves the historical source, distinct Explore source and earlier verification dates", () => {
    expect(proof.prefix.counts).toMatchObject({ launchRecords: 97_733, uniqueTransactionCount: 2_098_026, lifecycleEvents: 75_459 });
    expect(proof.prefixReconciled && proof.deltaValidated && proof.coverageComplete).toBe(true);
    expect(proof.unknownLaunchEmitters).toEqual([]);
    expect(exploreSource.headBlock).toBe(120_753_391);
    expect(activeSnapshot.verification.feeModels.date).toBe("2026-09-18");
    expect(activeSnapshot.verification.graduationTargets.date).toBe("2026-09-13");
    expect(activeSnapshot.run.windowedScans.burns).toBeNull();
    expect(activeSnapshot.coverage.unrecognizedContractsSampled).toBe(97);
    expect(activeSnapshot.coverage.unrecognizedContractSampleIsCapped).toBe(false);
    expect(activeSnapshot.coverage.note).toContain("not claimed to have undergone that bytecode review");
  });
});
