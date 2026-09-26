/** Aggregate-only contract for the indexer's versioned participants.json. */
export interface ParticipantSnapshot {
  schemaVersion: 1;
  definitionVersion: 1;
  chain: { chainId: number; network: "TESTNET" };
  sourceRunStartBlock: number;
  sourceRunHeadBlock: number;
  sourceRun: { chainId: number; headBlock: number; headBlockHash?: string; startedAt: string; finishedAt: string };
  derivedAt: string;
  scope: "configured-launch-and-curve-event-addresses";
  isFullHistory: true;
  launchScan: { fromBlock: number; toBlock: number; isFullHistory: true };
  curveScan: { fromBlock: number; toBlock: number; isFullHistory: true };
  indexedActorAddressCount: number;
  indexedParticipantAddressCount: number;
  distinctCreatorAddressCount: number;
  distinctBuyerSellerAddressCount: number;
  distinctBuyRecipientAddressCount: number;
  distinctTradeParticipantAddressCount: number;
  creatorBuyerSellerOverlap: number;
  creatorTradeParticipantOverlap: number;
  multiProjectActorAddressCount: number;
  multiProjectParticipantAddressCount: number;
  recipientOnlyAddressCount: number;
  definitions: { actor: string; participant: string };
  includedRoles: { actors: string[]; additionalParticipants: string[] };
  excludedRoles: string[];
  normalization: string;
  contractInclusionPolicy: string;
  exclusions: string[];
  limitations: string[];
  integrity: {
    launchRecords: number;
    tradeRecords: number;
    unusableAddressValues: number;
    malformedAddressValues: number;
    zeroAddressValues: number;
    rejectedByRole: Record<string, number>;
    rejectedByReason: { malformed: number; zero: number };
    rejectedByRoleAndReason: Record<string, { malformed: number; zero: number }>;
    unmappedTradeEvents: number;
  };
  validation: {
    coverageComplete: true;
    reconciled: true;
    method: "frozen-cache-replay" | "incremental-cache-replay";
    counts: Record<keyof typeof PARTICIPANT_SOURCE_COUNTS, number>;
    inputManifest: string;
    inputManifestSha256: string;
    incremental?: IncrementalParticipantProvenance;
  };
}

/** The frozen Overview source. A later derivation date never advances its head. */
export const PARTICIPANT_SOURCE = {
  chainId: 46_630,
  startBlock: 95_916_239,
  headBlock: 121_309_670,
  startedAt: "2026-09-18T16:27:46.209Z",
  finishedAt: "2026-09-18T17:00:25.492Z",
} as const;

export const PARTICIPANT_SOURCE_COUNTS = {
  launchRecords: 97_733,
  buyEvents: 1_565_964,
  sellEvents: 427_376,
  lifecycleEvents: 75_459,
  foreignCurveLogs: 502,
  uniqueTransactionCount: 2_098_026,
  launchTransactionCount: 97_733,
  tradeTransactionCount: 1_993_340,
  lifecycleTransactionCount: 62_848,
  sharedAcrossCategories: 55_895,
  unusableTransactionHashes: 0,
} as const;

export type ParticipantSourceCounts = { [K in keyof typeof PARTICIPANT_SOURCE_COUNTS]: number };

export interface ParticipantSourceIdentity {
  chainId: number;
  startBlock: number;
  headBlock: number;
  headBlockHash?: string;
  startedAt: string;
  finishedAt: string;
}

export interface IncrementalParticipantProvenance {
  prefixHeadBlock: number;
  deltaFromBlock: number;
  deltaToBlock: number;
  prefixManifestSha256: string;
  deltaManifestSha256: string;
  proofFile: string;
  proofSha256: string;
}

/** Explicit publication pins; never construct these from the artifact being checked. */
export interface IncrementalParticipantExpectation {
  source: ParticipantSourceIdentity & { headBlockHash: string };
  counts: ParticipantSourceCounts;
  method: "incremental-cache-replay";
  inputManifestSha256: string;
  incremental: IncrementalParticipantProvenance;
}

export const PARTICIPANT_PREFIX_MANIFEST_SHA256 =
  "45ac5115ff0dbfaed90f6a88f1d91a9d69da2ccf36d638049d55c8997a81e702";

const ACTOR_ROLES = ["TokenLaunched.creator", "TokenLaunchedQuoted.creator", "Bought.buyer", "Sold.seller"];
const RECIPIENT_ROLES = ["Bought.recipient"];
const COUNT_FIELDS = [
  "indexedActorAddressCount", "indexedParticipantAddressCount", "distinctCreatorAddressCount",
  "distinctBuyerSellerAddressCount", "distinctBuyRecipientAddressCount", "distinctTradeParticipantAddressCount",
  "creatorBuyerSellerOverlap", "creatorTradeParticipantOverlap", "multiProjectActorAddressCount",
  "multiProjectParticipantAddressCount", "recipientOnlyAddressCount",
] as const;

function requireValue(condition: unknown, field: string): asserts condition {
  if (!condition) throw new Error(`Invalid participant snapshot: ${field}`);
}

function object(value: unknown, field: string): Record<string, unknown> {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), field);
  return value as Record<string, unknown>;
}

function count(value: unknown, field: string): number {
  requireValue(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, field);
  return value;
}

function text(value: unknown, field: string): string {
  requireValue(typeof value === "string" && value.trim().length > 0, field);
  return value;
}

function strings(value: unknown, field: string): string[] {
  requireValue(Array.isArray(value) && value.length > 0, field);
  return value.map((entry, i) => text(entry, `${field}[${i}]`));
}

function exactRoles(value: unknown, expected: string[], field: string): void {
  const roles = strings(value, field);
  requireValue(roles.length === expected.length && new Set(roles).size === roles.length &&
    expected.every((role) => roles.includes(role)), field);
}

/** A delta can advance only the known, reconciled prefix without gaps. */
export function validateIncrementalExpectation(expected: IncrementalParticipantExpectation): void {
  const { source, counts, incremental: proof } = expected;
  requireValue(expected.method === "incremental-cache-replay", "expected method");
  requireValue(/^0x[0-9a-f]{64}$/.test(source.headBlockHash), "expected source head hash");
  requireValue(source.chainId === PARTICIPANT_SOURCE.chainId &&
    source.startBlock === PARTICIPANT_SOURCE.startBlock, "expected source chain/start");
  requireValue(Number.isSafeInteger(source.headBlock) && source.headBlock > PARTICIPANT_SOURCE.headBlock,
    "expected source head");
  requireValue(Number.isFinite(Date.parse(source.startedAt)) && Number.isFinite(Date.parse(source.finishedAt)) &&
    Date.parse(source.startedAt) >= Date.parse(PARTICIPANT_SOURCE.finishedAt) &&
    Date.parse(source.finishedAt) >= Date.parse(source.startedAt), "expected source timestamps");
  requireValue(proof.prefixHeadBlock === PARTICIPANT_SOURCE.headBlock &&
    proof.deltaFromBlock === proof.prefixHeadBlock + 1 && proof.deltaToBlock === source.headBlock,
    "expected contiguous prefix/delta");
  requireValue(proof.prefixManifestSha256 === PARTICIPANT_PREFIX_MANIFEST_SHA256,
    "expected prefix manifest");
  for (const hash of [expected.inputManifestSha256, proof.deltaManifestSha256, proof.proofSha256]) {
    requireValue(typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash), "expected provenance hash");
  }
  requireValue(proof.proofFile === "incremental-proof.json", "expected proofFile");
  for (const [key, baseline] of Object.entries(PARTICIPANT_SOURCE_COUNTS)) {
    const value = count(counts[key as keyof ParticipantSourceCounts], `expected counts.${key}`);
    requireValue(value >= baseline, `expected counts.${key} below historical prefix`);
  }
  requireValue(counts.unusableTransactionHashes === 0, "expected unusableTransactionHashes");
  requireValue(counts.launchTransactionCount <= counts.launchRecords &&
    counts.tradeTransactionCount <= counts.buyEvents + counts.sellEvents &&
    counts.lifecycleTransactionCount <= counts.lifecycleEvents, "expected transaction category bounds");
  const categories = [counts.launchTransactionCount, counts.tradeTransactionCount, counts.lifecycleTransactionCount];
  requireValue(categories.reduce((sum, value) => sum + value, 0) - counts.sharedAcrossCategories ===
    counts.uniqueTransactionCount && counts.uniqueTransactionCount >= Math.max(...categories),
    "expected transaction union");
}

/**
 * Fail closed before React sees an aggregate. This validates the replay's
 * reconciliation evidence; address sets and their derivation remain upstream.
 */
export function validateParticipantSnapshot(
  input: unknown,
  expected?: IncrementalParticipantExpectation,
): ParticipantSnapshot {
  if (expected) validateIncrementalExpectation(expected);
  const expectedSource = expected?.source ?? PARTICIPANT_SOURCE;
  const expectedCounts = expected?.counts ?? PARTICIPANT_SOURCE_COUNTS;
  const p = object(input, "root");
  requireValue(p.schemaVersion === 1 && p.definitionVersion === 1, "schema/definition version");
  requireValue(p.scope === "configured-launch-and-curve-event-addresses", "scope");
  requireValue(p.isFullHistory === true, "isFullHistory");
  const chain = object(p.chain, "chain");
  requireValue(chain.chainId === expectedSource.chainId && chain.network === "TESTNET", "chain");
  requireValue(p.sourceRunStartBlock === expectedSource.startBlock, "sourceRunStartBlock");
  requireValue(p.sourceRunHeadBlock === expectedSource.headBlock, "sourceRunHeadBlock");
  const source = object(p.sourceRun, "sourceRun");
  for (const key of ["chainId", "headBlock", "startedAt", "finishedAt"] as const) {
    requireValue(source[key] === expectedSource[key], `sourceRun.${key}`);
  }
  if (expected) requireValue(source.headBlockHash === expected.source.headBlockHash, "sourceRun.headBlockHash");
  const derivedAt = text(p.derivedAt, "derivedAt");
  requireValue(Number.isFinite(Date.parse(derivedAt)) &&
    Date.parse(derivedAt) >= Date.parse(expectedSource.finishedAt), "derivedAt");
  for (const key of ["launchScan", "curveScan"] as const) {
    const scan = object(p[key], key);
    requireValue(scan.fromBlock === expectedSource.startBlock &&
      scan.toBlock === expectedSource.headBlock && scan.isFullHistory === true, `${key} full-history bounds`);
  }

  const validation = object(p.validation, "validation");
  requireValue(validation.coverageComplete === true, "validation.coverageComplete");
  requireValue(validation.reconciled === true, "validation.reconciled");
  requireValue(validation.method === (expected?.method ?? "frozen-cache-replay"), "validation.method");
  const evidence = object(validation.counts, "validation.counts");
  for (const [key, value] of Object.entries(expectedCounts)) {
    requireValue(evidence[key] === value, `validation.counts.${key}`);
  }
  text(validation.inputManifest, "validation.inputManifest");
  requireValue(typeof validation.inputManifestSha256 === "string" &&
    /^[0-9a-f]{64}$/.test(validation.inputManifestSha256), "validation.inputManifestSha256");
  if (expected) {
    requireValue(validation.inputManifestSha256 === expected.inputManifestSha256, "validation.inputManifestSha256");
    const incremental = object(validation.incremental, "validation.incremental");
    for (const [key, value] of Object.entries(expected.incremental)) {
      requireValue(incremental[key] === value, `validation.incremental.${key}`);
    }
  }

  const integrity = object(p.integrity, "integrity");
  requireValue(integrity.launchRecords === expectedCounts.launchRecords, "integrity.launchRecords");
  requireValue(integrity.tradeRecords === expectedCounts.buyEvents + expectedCounts.sellEvents,
    "integrity.tradeRecords");
  for (const key of ["unusableAddressValues", "malformedAddressValues", "zeroAddressValues", "unmappedTradeEvents"]) {
    requireValue(integrity[key] === 0, `integrity.${key}`);
  }
  const byRole = object(integrity.rejectedByRole, "integrity.rejectedByRole");
  const byReason = object(integrity.rejectedByReason, "integrity.rejectedByReason");
  const byRoleAndReason = object(integrity.rejectedByRoleAndReason, "integrity.rejectedByRoleAndReason");
  for (const reason of ["malformed", "zero"]) requireValue(byReason[reason] === 0, `rejectedByReason.${reason}`);
  for (const role of [...ACTOR_ROLES, ...RECIPIENT_ROLES]) {
    requireValue(byRole[role] === 0, `rejectedByRole.${role}`);
    const reasons = object(byRoleAndReason[role], `rejectedByRoleAndReason.${role}`);
    for (const reason of ["malformed", "zero"]) requireValue(reasons[reason] === 0, `${role}.${reason}`);
  }
  for (const value of Object.values(byRole)) requireValue(value === 0, "rejectedByRole unexpected rejection");

  const definitions = object(p.definitions, "definitions");
  text(definitions.actor, "definitions.actor");
  text(definitions.participant, "definitions.participant");
  const roles = object(p.includedRoles, "includedRoles");
  exactRoles(roles.actors, ACTOR_ROLES, "includedRoles.actors");
  exactRoles(roles.additionalParticipants, RECIPIENT_ROLES, "includedRoles.additionalParticipants");
  for (const field of ["excludedRoles", "exclusions", "limitations"]) strings(p[field], field);
  for (const field of ["normalization", "contractInclusionPolicy"]) text(p[field], field);

  for (const field of COUNT_FIELDS) count(p[field], field);
  const result = p as unknown as ParticipantSnapshot;
  const a = result.indexedActorAddressCount, all = result.indexedParticipantAddressCount;
  const c = result.distinctCreatorAddressCount, t = result.distinctBuyerSellerAddressCount;
  const r = result.distinctBuyRecipientAddressCount, tp = result.distinctTradeParticipantAddressCount;
  requireValue(result.creatorBuyerSellerOverlap <= Math.min(c, t), "creatorBuyerSellerOverlap");
  requireValue(result.creatorTradeParticipantOverlap <= Math.min(c, tp) &&
    result.creatorTradeParticipantOverlap >= result.creatorBuyerSellerOverlap, "creatorTradeParticipantOverlap");
  requireValue(a === c + t - result.creatorBuyerSellerOverlap, "actor union consistency");
  requireValue(all === c + tp - result.creatorTradeParticipantOverlap, "participant union consistency");
  requireValue(all === a + result.recipientOnlyAddressCount && result.recipientOnlyAddressCount <= r,
    "recipientOnlyAddressCount");
  requireValue(tp >= Math.max(t, r) && tp <= t + r, "trade participant union consistency");
  requireValue(c <= expectedCounts.launchRecords &&
    t <= expectedCounts.buyEvents + expectedCounts.sellEvents &&
    r <= expectedCounts.buyEvents, "address counts exceed contributing records");
  requireValue(result.multiProjectActorAddressCount <= a &&
    result.multiProjectActorAddressCount <= result.multiProjectParticipantAddressCount &&
    result.multiProjectParticipantAddressCount <= all, "multi-project count consistency");
  return result;
}
