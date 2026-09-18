import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  activeSnapshot,
  allRangesDense,
  blocksBehindHead,
  generationById,
  generationShare,
  totalLaunches,
} from "@/data";
import type { GenerationId } from "@/data/types";

/**
 * These tests pin the facts the interface asserts in public, and the rules the
 * upstream indexer cares about. They exist to fail if a number, an address or a
 * verification status is ever changed by hand without a run to back it.
 */

const snapshot = activeSnapshot;

/** Walks every plain object and array in the snapshot, yielding key paths. */
function* walk(
  value: unknown,
  path: string[] = []
): Generator<{ path: string[]; key: string; value: unknown }> {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      yield* walk(item, [...path, String(index)]);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      yield { path: [...path, key], key, value: child };
      yield* walk(child, [...path, key]);
    }
  }
}

describe("launch totals", () => {
  it("sums the generations to the total the validation run reported", () => {
    expect(totalLaunches(snapshot)).toBe(97_733);
  });

  it("carries the per-generation counts from the adopted run", () => {
    const counts = Object.fromEntries(
      snapshot.generations.map((g) => [g.id, g.launchCount])
    );
    expect(counts).toEqual({ retired: 14_800, legacy: 43_220, current: 39_713 });
  });

  it("derives the total rather than storing it, so the parts cannot disagree", () => {
    const parts = snapshot.generations.reduce((sum, g) => sum + g.launchCount, 0);
    expect(totalLaunches(snapshot)).toBe(parts);
    expect(snapshot).not.toHaveProperty("totalLaunches");
  });

  it("splits the total into shares that account for everything", () => {
    const total = totalLaunches(snapshot);
    const shares = snapshot.generations.map((g) => generationShare(g, total));
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });
});

describe("network identity", () => {
  it("is Robinhood Chain testnet, chain 46630", () => {
    expect(snapshot.network.chainId).toBe(46_630);
    expect(snapshot.environment).toBe("testnet");
  });

  it("never claims to be live data", () => {
    expect(snapshot.dataKind).toBe("point-in-time-validated-run");
    const live = [...walk(snapshot)].filter(
      (entry) => typeof entry.value === "string" && /\blive\b/i.test(entry.value)
    );
    expect(live).toEqual([]);
  });

  it("is read only", () => {
    expect(snapshot.access).toBe("read-only");
  });
});

describe("factory identity", () => {
  it("has a unique id per generation", () => {
    const ids = snapshot.generations.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a unique factory address per generation", () => {
    const addresses = snapshot.generations.map((g) => g.factory.toLowerCase());
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it("has a unique label per generation", () => {
    const labels = snapshot.generations.map((g) => g.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("carries the factory addresses verified on chain", () => {
    const byId = Object.fromEntries(snapshot.generations.map((g) => [g.id, g.factory]));
    expect(byId).toEqual({
      retired: "0x4FEbC267e0C24440bcDEF72B5DBC5FE7BED091dF",
      legacy: "0xB5B7A2f6c4EAFa2D73918fcA32d50e2126339eb9",
      current: "0x40f1be6faf8DAB9C143cce1a0A04c2075Fb2DF59",
    });
  });

  it("uses well formed 20 byte addresses", () => {
    for (const generation of snapshot.generations) {
      expect(generation.factory).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});

describe("launch identity is scoped to a factory", () => {
  it("exposes no global launch identifier anywhere in the snapshot", () => {
    const offenders = [...walk(snapshot)]
      .filter((entry) => /^launch_?id$/i.test(entry.key))
      .map((entry) => entry.path.join("."));
    expect(offenders).toEqual([]);
  });

  it("keeps every generation's launch id range dense and duplicate free", () => {
    expect(allRangesDense(snapshot)).toBe(true);
  });

  it("matches each range width to its launch count", () => {
    for (const generation of snapshot.generations) {
      const { min, max } = generation.launchIdAudit;
      expect(max - min + 1).toBe(generation.launchCount);
      expect(min).toBe(0);
    }
  });
});

describe("per-generation economics", () => {
  const expected: Record<
    GenerationId,
    { totalFeeBps: number; creator: number; protocol: number }
  > = {
    retired: { totalFeeBps: 100, creator: 5_000, protocol: 5_000 },
    legacy: { totalFeeBps: 125, creator: 7_500, protocol: 2_500 },
    current: { totalFeeBps: 125, creator: 7_500, protocol: 2_500 },
  };

  it("does not apply one fee model across every generation", () => {
    const rates = new Set(snapshot.generations.map((g) => g.feeModel.totalFeeBps));
    expect(rates.size).toBeGreaterThan(1);
  });

  it("keeps each generation's verified fee model", () => {
    for (const generation of snapshot.generations) {
      const want = expected[generation.id];
      expect(generation.feeModel.totalFeeBps).toBe(want.totalFeeBps);
      expect(generation.feeModel.creatorShareOfFeeBps).toBe(want.creator);
      expect(generation.feeModel.protocolShareOfFeeBps).toBe(want.protocol);
    }
  });

  it("splits the whole fee between creator and protocol", () => {
    for (const generation of snapshot.generations) {
      const { creatorShareOfFeeBps, protocolShareOfFeeBps } = generation.feeModel;
      expect(creatorShareOfFeeBps + protocolShareOfFeeBps).toBe(10_000);
    }
  });

  it("cites evidence for every fee model", () => {
    for (const generation of snapshot.generations) {
      expect(generation.feeModel.evidence).toMatch(/VERIFIED ONCHAIN/);
    }
  });
});

describe("graduation targets", () => {
  it("leaves the legacy target unverified rather than borrowing another one", () => {
    const legacy = generationById(snapshot, "legacy");
    expect(legacy?.graduationTarget.status).toBe("not-verified");
    expect(legacy?.graduationTarget.wei).toBeNull();
    expect(legacy?.graduationTarget.display).toBeNull();
    expect(legacy?.graduationTarget.verifiedAt).toBeNull();
  });

  it("carries the two targets that were read on chain", () => {
    expect(generationById(snapshot, "retired")?.graduationTarget).toEqual({
      status: "verified-onchain",
      verifiedAt: "2026-09-13",
      wei: "5000000000000000",
      display: "0.005 ETH",
    });
    expect(generationById(snapshot, "current")?.graduationTarget).toEqual({
      status: "verified-onchain",
      verifiedAt: "2026-09-13",
      wei: "5000000000000000000",
      display: "5 ETH",
    });
  });

  it("holds wei as decimal strings, never as numbers", () => {
    for (const generation of snapshot.generations) {
      const { wei } = generation.graduationTarget;
      if (wei !== null) expect(wei).toMatch(/^[0-9]+$/);
    }
  });
});

describe("run metadata", () => {
  it("records the head block and validation date of the run", () => {
    expect(snapshot.run.headBlock).toBe(121_309_670);
    expect(snapshot.run.validationDate).toBe("2026-09-18");
    expect(snapshot.run.finishedAt).toBe("2026-09-18T17:00:25.492Z");
  });

  it("reports launch reconstruction as full history", () => {
    expect(snapshot.run.launchScanIsFullHistory).toBe(true);
  });

  it("passed every sanity check the indexer ran", () => {
    expect(snapshot.run.sanityChecks).toEqual({ passed: 5, total: 5 });
  });

  it("observed all three factories producing launches, long after each was deployed", () => {
    for (const generation of snapshot.generations) {
      expect(generation.observedStillProducingLaunches).toBe(true);
      expect(generation.lastObservedLaunchBlock).toBeLessThanOrEqual(
        snapshot.run.headBlock
      );
      expect(generation.lastObservedLaunchBlock).toBeGreaterThan(generation.deploymentBlock);
    }
  });

  /**
   * The earlier assertion here was that every generation's most recent launch
   * sat within 200,000 blocks of the head. That held while it did and stopped
   * holding on this run: the retired factory's most recent launch is 245,403
   * blocks back while the current factory's is 3,086.
   *
   * Relaxing the bound to fit would have thrown away the point. The claim worth
   * protecting was never "all three are equally current" -- it is "retired is
   * the operator's label, not an observed state, so do not drop that factory".
   * That is what these assert, and the interface shows the distance rather than
   * flattening it.
   */
  it("keeps the retired factory in the dataset despite the operator's label", () => {
    const retired = generationById(snapshot, "retired");
    expect(retired?.observedStillProducingLaunches).toBe(true);
    expect(retired?.launchCount).toBeGreaterThan(14_000);
    expect(retired?.operatorListing).toMatch(/absent/i);
  });

  it("does not pretend the retired factory is as current as the others", () => {
    const retired = generationById(snapshot, "retired")!;
    const current = generationById(snapshot, "current")!;
    expect(blocksBehindHead(retired, snapshot.run.headBlock)).toBeGreaterThan(
      blocksBehindHead(current, snapshot.run.headBlock)
    );
    // The gap is disclosed in words, not just implied by two block numbers.
    expect(retired.note).toContain("245,403 blocks below the head");
  });

  it("names the source so a reader can check the numbers", () => {
    expect(snapshot.source.indexerName).toBe("vibevibe-testnet-indexer");
    expect(snapshot.source.indexerVersion).toBe("0.1.0");
    expect(snapshot.source.repositoryUrl).toBe(
      "https://github.com/itstorvian/vibevibe-testnet-indexer"
    );
    expect(snapshot.source.validationReport).toBeTruthy();
  });

  it("dates fee models to the run that actually re-read them", () => {
    expect(snapshot.verification.feeModels.date).toBe("2026-09-18");
    expect(snapshot.verification.feeModels.date).toBe(snapshot.run.validationDate);
    for (const g of snapshot.generations) {
      expect(g.feeModel.verifiedAt).toBe("2026-09-18");
    }
  });

  it("does NOT claim this run re-verified graduation targets or the address book", () => {
    expect(snapshot.verification.graduationTargets.date).toBe("2026-09-13");
    expect(snapshot.verification.addressBook.date).toBe("2026-09-13");
    expect(snapshot.verification.graduationTargets.date).not.toBe(snapshot.run.validationDate);
    for (const g of snapshot.generations) {
      if (g.graduationTarget.status === "verified-onchain") {
        expect(g.graduationTarget.verifiedAt).toBe("2026-09-13");
      }
    }
  });

  it("leaves the unverified graduation target without a verification date", () => {
    const legacy = generationById(snapshot, "legacy");
    expect(legacy?.graduationTarget.status).toBe("not-verified");
    expect(legacy?.graduationTarget.verifiedAt).toBeNull();
  });
});

describe("coverage honesty", () => {
  it("states that factory discovery is manual", () => {
    expect(snapshot.coverage.factoryDiscovery).toBe("manually-configured");
  });

  it("counts configured factories, matching the generations it carries", () => {
    expect(snapshot.coverage.factoriesConfigured).toBe(snapshot.generations.length);
    expect(snapshot.coverage.factoriesConfigured).toBe(3);
  });
});

describe("no windowed aggregate reaches the interface", () => {
  /**
   * Trade, fee and burn figures from the run are bounded to a block window and
   * are not lifetime totals. None of them belong in this snapshot, so the
   * overview cannot accidentally present one as complete.
   */
  it("carries no volume, fee total, burn or ranking aggregate", () => {
    const banned = /(volume|burn|totalfees|feeswei|ranking|trending|score)/i;
    const offenders = [...walk(snapshot)]
      .map((entry) => ({ ...entry, path: entry.path.join(".") }))
      // `run.windowedScans` records the block bounds of the scans that were
      // NOT full history. It is the disclosure, not an aggregate.
      .filter((entry) => !entry.path.startsWith("run.windowedScans"))
      .filter((entry) => banned.test(entry.key))
      .map((entry) => entry.path);
    expect(offenders).toEqual([]);
  });

  it("records the windowed scan bounds only as metadata about the run", () => {
    expect(snapshot.run.windowedScans.burns[1]).toBe(snapshot.run.headBlock);
  });

  it("no longer windows the curve scan, which is what makes activity a lifetime figure", () => {
    expect(snapshot.run.curveScanIsFullHistory).toBe(true);
    expect(snapshot.run.windowedScans).not.toHaveProperty("trades");
  });
});

describe("no credentials or private endpoints", () => {
  it("uses the public rpc endpoint with no key, userinfo or query string", () => {
    const { rpcEndpoint } = snapshot.network;
    expect(rpcEndpoint).toBe("https://rpc.testnet.chain.robinhood.com");
    expect(rpcEndpoint).not.toContain("@");
    expect(rpcEndpoint).not.toContain("?");
  });

  it("contains no credential shaped string anywhere", () => {
    const credentialish =
      /(api[_-]?key|secret|passphrase|private[_-]?key|bearer\s|eyJ[A-Za-z0-9_-]{10,}|0x[0-9a-fA-F]{64})/i;
    const offenders = [...walk(snapshot)]
      .filter((entry) => typeof entry.value === "string" && credentialish.test(entry.value))
      .map((entry) => entry.path.join("."));
    expect(offenders).toEqual([]);
  });
});

describe("indexed transactions", () => {
  const { activity } = snapshot;

  it("carries the transaction count the validation run reported", () => {
    expect(activity.uniqueTransactionCount).toBe(2_098_026);
    expect(Number.isSafeInteger(activity.uniqueTransactionCount)).toBe(true);
  });

  it("names a scope narrower than the whole protocol", () => {
    expect(activity.scope).toBe("launch-and-curve-events");
  });

  it("is a lifetime figure, because every contributing scan was full history", () => {
    expect(activity.isFullHistory).toBe(true);
    expect(snapshot.run.launchScanIsFullHistory).toBe(true);
    expect(snapshot.run.curveScanIsFullHistory).toBe(true);
  });

  it("counts transactions, not events: the total is the union of the categories", () => {
    const { launch, trade, lifecycle } = activity.components;
    const naiveSum = launch + trade + lifecycle;
    expect(naiveSum - activity.sharedAcrossCategories).toBe(activity.uniqueTransactionCount);
  });

  it("never exceeds the sum, and never falls below its largest part", () => {
    const parts = Object.values(activity.components);
    expect(activity.uniqueTransactionCount).toBeLessThanOrEqual(
      parts.reduce((a, b) => a + b, 0)
    );
    expect(activity.uniqueTransactionCount).toBeGreaterThanOrEqual(Math.max(...parts));
  });

  it("cannot have more launch transactions than launches", () => {
    // Every launch carries exactly one deployment transaction, and
    // deduplication can only reduce that count, never raise it.
    expect(activity.components.launch).toBeLessThanOrEqual(totalLaunches(snapshot));
  });

  it("reports the overlap rather than hiding it", () => {
    expect(activity.sharedAcrossCategories).toBeGreaterThanOrEqual(0);
    expect(activity.sharedAcrossCategories).toBe(55_895);
  });

  it("lists exactly the event surfaces that contribute", () => {
    expect([...activity.includedEventSurfaces]).toEqual([
      "TokenLaunched",
      "TokenLaunchedQuoted",
      "Bought",
      "Sold",
      "CurveCompleted",
      "Graduated",
      "CreatorFeesForwarded",
    ]);
  });

  it("discloses what a Vibe/Vibe transaction can be and still be missing", () => {
    const text = activity.exclusions.join(" ");
    expect(activity.exclusions.length).toBeGreaterThan(0);
    expect(text).toMatch(/post-graduation/i);
    expect(text).toMatch(/burn/i);
    expect(text).toMatch(/LaunchFeesClaimed/);
    expect(text).toMatch(/not configured|unconfigured/i);
  });

  it("never calls itself a total", () => {
    const claims = [...walk(activity)]
      .filter(
        (entry) =>
          typeof entry.value === "string" &&
          /\b(total|all|every)\s+(vibe\/?vibe\s+)?transactions\b/i.test(entry.value)
      )
      .map((entry) => entry.path.join("."));
    expect(claims).toEqual([]);
  });
});

describe("the transaction count originates upstream, not in the interface", () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

  it("is rendered straight from the snapshot", () => {
    const tiles = read("src/components/metric-tiles.tsx");
    expect(tiles).toContain("snapshot.activity.uniqueTransactionCount");
    expect(tiles).toContain("Indexed transactions");
  });

  it("is never arithmetic over other dashboard fields", () => {
    // `totalLaunches` is summed here on purpose; a transaction count must not
    // be, because no combination of the fields in this contract produces it.
    const derive = read("src/data/derive.ts");
    expect(derive).not.toMatch(/transaction/i);
    for (const rel of [
      "src/components/metric-tiles.tsx",
      "src/components/provenance-panel.tsx",
      "src/components/limitations-note.tsx",
    ]) {
      expect(read(rel)).not.toMatch(/uniqueTransactionCount\s*[-+*/]/);
      expect(read(rel)).not.toMatch(/components\.(launch|trade|lifecycle)\s*\+/);
    }
  });

  it("formats with the shared count formatter, not a locale-dependent one", () => {
    const tiles = read("src/components/metric-tiles.tsx");
    expect(tiles).toMatch(/formatCount\(snapshot\.activity\.uniqueTransactionCount\)/);
    expect(tiles).not.toContain("toLocaleString");
  });
});
