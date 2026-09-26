import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ParticipationDetails } from "@/components/participation-details";
import { MetricTiles } from "@/components/metric-tiles";
import { activeSnapshot } from "@/data";
import { snapshot20260918head121309670 } from "@/data/snapshots/2026-09-18-121309670";
import { formatCount } from "@/lib/format";
import { exploreSource } from "@/data/explore-source";
import {
  PARTICIPANT_SOURCE,
  PARTICIPANT_SOURCE_COUNTS,
  validateParticipantSnapshot,
  type ParticipantSnapshot,
} from "@/data/participants";

/** Synthetic address-set sizes, never a source of published aggregate values. */
function fixture(): ParticipantSnapshot {
  const actors = ["TokenLaunched.creator", "TokenLaunchedQuoted.creator", "Bought.buyer", "Sold.seller"];
  const roles = [...actors, "Bought.recipient"];
  return {
    schemaVersion: 1,
    definitionVersion: 1,
    chain: { chainId: PARTICIPANT_SOURCE.chainId, network: "TESTNET" },
    sourceRunStartBlock: PARTICIPANT_SOURCE.startBlock,
    sourceRunHeadBlock: PARTICIPANT_SOURCE.headBlock,
    sourceRun: {
      chainId: PARTICIPANT_SOURCE.chainId,
      headBlock: PARTICIPANT_SOURCE.headBlock,
      startedAt: PARTICIPANT_SOURCE.startedAt,
      finishedAt: PARTICIPANT_SOURCE.finishedAt,
    },
    derivedAt: "2026-09-25T12:00:00.000Z",
    scope: "configured-launch-and-curve-event-addresses",
    isFullHistory: true,
    launchScan: { fromBlock: PARTICIPANT_SOURCE.startBlock, toBlock: PARTICIPANT_SOURCE.headBlock, isFullHistory: true },
    curveScan: { fromBlock: PARTICIPANT_SOURCE.startBlock, toBlock: PARTICIPANT_SOURCE.headBlock, isFullHistory: true },
    indexedActorAddressCount: 5,
    indexedParticipantAddressCount: 7,
    distinctCreatorAddressCount: 3,
    distinctBuyerSellerAddressCount: 4,
    distinctBuyRecipientAddressCount: 4,
    distinctTradeParticipantAddressCount: 6,
    creatorBuyerSellerOverlap: 2,
    creatorTradeParticipantOverlap: 2,
    multiProjectActorAddressCount: 2,
    multiProjectParticipantAddressCount: 3,
    recipientOnlyAddressCount: 2,
    definitions: { actor: "Creator, buyer and seller union.", participant: "Actor and buy recipient union." },
    includedRoles: { actors, additionalParticipants: ["Bought.recipient"] },
    excludedRoles: ["creatorFeeRecipient", "CreatorFeesForwarded.vault"],
    normalization: "Normalize complete nonzero addresses to lowercase before deduplication.",
    contractInclusionPolicy: "Valid contract addresses are included.",
    exclusions: ["Post-graduation DEX activity."],
    limitations: ["Event roles do not establish transaction senders or people."],
    integrity: {
      launchRecords: PARTICIPANT_SOURCE_COUNTS.launchRecords,
      tradeRecords: PARTICIPANT_SOURCE_COUNTS.buyEvents + PARTICIPANT_SOURCE_COUNTS.sellEvents,
      unusableAddressValues: 0,
      malformedAddressValues: 0,
      zeroAddressValues: 0,
      unmappedTradeEvents: 0,
      rejectedByRole: Object.fromEntries(roles.map((role) => [role, 0])),
      rejectedByReason: { malformed: 0, zero: 0 },
      rejectedByRoleAndReason: Object.fromEntries(roles.map((role) => [role, { malformed: 0, zero: 0 }])),
    },
    validation: {
      coverageComplete: true,
      reconciled: true,
      method: "frozen-cache-replay",
      counts: { ...PARTICIPANT_SOURCE_COUNTS },
      inputManifest: "synthetic-test-manifest.json",
      inputManifestSha256: "a".repeat(64),
    },
  };
}

function changed(path: string[], value: unknown): unknown {
  const input = fixture();
  let target = input as unknown as Record<string, unknown>;
  for (const segment of path.slice(0, -1)) target = target[segment] as Record<string, unknown>;
  target[path[path.length - 1]!] = value;
  return input;
}

describe("participant snapshot publication gate", () => {
  it("accepts a complete reconciled artifact without deriving new counts", () => {
    const input = fixture();
    expect(validateParticipantSnapshot(input)).toBe(input);
  });

  it.each([
    [["schemaVersion"], 2], [["definitionVersion"], 2], [["scope"], "all-chain"],
    [["chain", "chainId"], 1], [["chain", "network"], "MAINNET"],
    [["sourceRunStartBlock"], 95_916_240], [["sourceRunHeadBlock"], 121_309_671],
    [["sourceRun", "chainId"], 1], [["sourceRun", "headBlock"], 121_309_671],
    [["sourceRun", "startedAt"], "2026-09-18T16:27:47.209Z"],
    [["sourceRun", "finishedAt"], "2026-09-25T12:00:00.000Z"],
    [["derivedAt"], "not a date"], [["derivedAt"], "2026-09-01T12:00:00.000Z"],
    [["isFullHistory"], false], [["launchScan", "isFullHistory"], false],
    [["curveScan", "isFullHistory"], false], [["launchScan", "fromBlock"], 95_916_240],
    [["curveScan", "fromBlock"], 121_296_239], [["curveScan", "toBlock"], 121_296_238],
    [["validation", "coverageComplete"], false], [["validation", "reconciled"], false],
    [["validation", "method"], "indexed-run"], [["validation", "inputManifest"], undefined],
    [["validation", "inputManifestSha256"], "not-a-hash"],
  ] as [string[], unknown][])("rejects provenance/coverage mismatch at %j", (path, value) => {
    expect(() => validateParticipantSnapshot(changed(path, value))).toThrow("Invalid participant snapshot");
  });

  it.each(Object.keys(PARTICIPANT_SOURCE_COUNTS))("rejects mismatched source count %s", (field) => {
    expect(() => validateParticipantSnapshot(changed(["validation", "counts", field], -1))).toThrow(field);
  });

  it.each([
    ["unusableAddressValues"], ["malformedAddressValues"], ["zeroAddressValues"], ["unmappedTradeEvents"],
    ["rejectedByRole", "Bought.recipient"], ["rejectedByReason", "zero"],
    ["rejectedByRoleAndReason", "Bought.buyer", "malformed"], ["launchRecords"], ["tradeRecords"],
  ])("rejects unusable or unreconciled input diagnostics at %j", (...path) => {
    expect(() => validateParticipantSnapshot(changed(["integrity", ...path], 1))).toThrow("Invalid participant snapshot");
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, "5"])(
    "rejects an invalid aggregate %s", (value) => {
      expect(() => validateParticipantSnapshot(changed(["indexedActorAddressCount"], value))).toThrow("indexedActorAddressCount");
    },
  );

  it.each([
    ["indexedActorAddressCount", 7], ["indexedParticipantAddressCount", 11],
    ["creatorBuyerSellerOverlap", 4], ["creatorTradeParticipantOverlap", 1],
    ["recipientOnlyAddressCount", 3], ["distinctTradeParticipantAddressCount", 10],
    ["multiProjectActorAddressCount", 4], ["multiProjectParticipantAddressCount", 8],
  ] as const)("rejects inconsistent set counts: %s", (field, value) => {
    expect(() => validateParticipantSnapshot(changed([field], value))).toThrow("Invalid participant snapshot");
  });

  it("rejects recipient being silently promoted to an actor role", () => {
    const input = fixture();
    input.includedRoles.actors.push("Bought.recipient");
    expect(() => validateParticipantSnapshot(input)).toThrow("includedRoles.actors");
  });

  it("requires definitions and public limitations", () => {
    expect(() => validateParticipantSnapshot(changed(["definitions", "actor"], ""))).toThrow("definitions.actor");
    expect(() => validateParticipantSnapshot(changed(["limitations"], []))).toThrow("limitations");
  });
});

describe("participant presentation", () => {
  const markup = renderToStaticMarkup(ParticipationDetails({ participants: validateParticipantSnapshot(fixture()) }));

  it("shows the broader union and useful overlapping breakdowns in supporting detail", () => {
    for (const label of ["Indexed participant addresses", "Creator addresses", "Buyer/seller actor addresses",
      "Buy recipient addresses", "Trade participant addresses", "Creator / buyer-seller overlap",
      "Creator / trade-participant overlap", "Multi-project actor addresses", "Multi-project participant addresses"]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain("<details");
    expect(markup).toContain("Category totals overlap");
  });

  it("publishes role, contract, lifecycle, scope and point-in-time limitations", () => {
    for (const phrase of ["globally deduplicated", "Bought.recipient", "Bought.buyer", "transaction senders",
      "Valid contract addresses remain included", "Lifecycle initiators cannot be measured",
      "DEX activity", "unconfigured factories", "factory-scoped launch identity", "95,916,239", "121,309,670"]) {
      expect(markup).toContain(phrase);
    }
    expect(markup).not.toMatch(/\busers\b|\bactive wallets\b/i);
  });
});

describe("adopted participant artifact and Overview integration", () => {
  it("adopts the exact indexer-produced artifact after authoritative reconciliation", () => {
    const bytes = readFileSync(new URL("../src/data/snapshots/participants-2026-09-18-121309670.json", import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("bd7bf075effc098e3256b594a018a7c1db81eb65bbc64defad010aae6066d564");
    expect(snapshot20260918head121309670.schemaVersion).toBe(3);
    expect(snapshot20260918head121309670.participants).toEqual(validateParticipantSnapshot(JSON.parse(bytes.toString("utf8"))));
    expect(snapshot20260918head121309670.participants.indexedActorAddressCount).toBe(88_781);
    expect(snapshot20260918head121309670.participants.indexedParticipantAddressCount).toBe(88_781);
    expect(snapshot20260918head121309670.participants.recipientOnlyAddressCount).toBe(0);
  });

  it("retains the two distinct source runs and original Overview completion time", () => {
    const p = activeSnapshot.participants;
    expect(p.sourceRunHeadBlock).toBe(activeSnapshot.run.headBlock);
    expect(p.sourceRun.finishedAt).toBe(activeSnapshot.run.finishedAt);
    expect(exploreSource.headBlock).toBe(120_753_391);
    expect(exploreSource.headBlock).not.toBe(p.sourceRunHeadBlock);
  });

  it("renders actor addresses as a primary metric and the broader count in detail", () => {
    const tiles = renderToStaticMarkup(MetricTiles());
    expect(tiles).toContain("Indexed actor addresses");
    expect(tiles).toContain(formatCount(activeSnapshot.participants.indexedActorAddressCount));
    expect(tiles).not.toContain("Indexed participant addresses");
    const source = readFileSync(new URL("../src/components/metric-tiles.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/formatCount\(snapshot\.participants\.indexedActorAddressCount\)/);
    expect(source).not.toMatch(/new Set|indexedActorAddressCount\s*[-+*/]/);
  });
});
