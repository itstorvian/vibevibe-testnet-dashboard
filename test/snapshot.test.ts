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
    expect(totalLaunches(snapshot)).toBe(96_490);
  });

  it("carries the per-generation counts from the adopted run", () => {
    const counts = Object.fromEntries(
      snapshot.generations.map((g) => [g.id, g.launchCount])
    );
    expect(counts).toEqual({ retired: 14_799, legacy: 43_016, current: 38_675 });
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
    expect(snapshot.run.headBlock).toBe(120_753_391);
    expect(snapshot.run.validationDate).toBe("2026-09-17");
    expect(snapshot.run.finishedAt).toBe("2026-09-17T11:29:01.629Z");
  });

  it("reports launch reconstruction as full history", () => {
    expect(snapshot.run.launchScanIsFullHistory).toBe(true);
  });

  it("passed every sanity check the indexer ran", () => {
    expect(snapshot.run.sanityChecks).toEqual({ passed: 5, total: 5 });
  });

  it("observed all three factories producing launches near the head block", () => {
    for (const generation of snapshot.generations) {
      expect(generation.observedStillProducingLaunches).toBe(true);
      expect(generation.lastObservedLaunchBlock).toBeLessThanOrEqual(
        snapshot.run.headBlock
      );
      expect(blocksBehindHead(generation, snapshot.run.headBlock)).toBeLessThan(200_000);
    }
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
    expect(snapshot.verification.feeModels.date).toBe("2026-09-17");
    expect(snapshot.verification.feeModels.date).toBe(snapshot.run.validationDate);
    for (const g of snapshot.generations) {
      expect(g.feeModel.verifiedAt).toBe("2026-09-17");
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
    expect(snapshot.run.windowedScans.trades[1]).toBe(snapshot.run.headBlock);
    expect(snapshot.run.windowedScans.burns[1]).toBe(snapshot.run.headBlock);
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
