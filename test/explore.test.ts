import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { activeSnapshot, totalLaunches } from "@/data";
import {
  decodeRow,
  GENERATION_IDS,
  GENERATION_VIEWS,
  STATUS_UPSTREAM,
  STATUS_VIEWS,
  viewKey,
  type ExploreManifest,
  type ExplorePage,
  type ExploreRow,
  type NameEntry,
} from "@/data/explore-types";

/**
 * These tests read the generated shards, not a fixture. They fail if a rebuild
 * ever produces a dataset that disagrees with the snapshot Overview renders,
 * or that smuggles a windowed field into a browsable table.
 */

const ROOT = path.join(process.cwd(), "public", "explore");
const read = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as T;

const manifest = read<ExploreManifest>("manifest.json");

describe("manifest is the authority", () => {
  it("exists and declares its schema", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.pageSize).toBe(100);
  });

  it("carries the adopted run's total", () => {
    expect(manifest.totals.all).toBe(96_490);
  });

  it("splits into the adopted per-generation counts", () => {
    expect(manifest.totals.retired).toBe(14_799);
    expect(manifest.totals.legacy).toBe(43_016);
    expect(manifest.totals.current).toBe(38_675);
  });

  it("sums generations to the total", () => {
    const sum = GENERATION_IDS.reduce((acc, g) => acc + manifest.totals[g], 0);
    expect(sum).toBe(manifest.totals.all);
  });

  it("records the head block of the adopted run", () => {
    expect(manifest.blockRange.max).toBeLessThanOrEqual(120_753_391);
    expect(manifest.lastObservedLaunchBlock.retired).toBe(120_622_795);
    expect(manifest.lastObservedLaunchBlock.legacy).toBe(120_753_168);
    expect(manifest.lastObservedLaunchBlock.current).toBe(120_741_383);
  });

  it("orders canonically by deployment block with a deterministic tie break", () => {
    expect(manifest.sort.canonical).toBe("deploymentBlock");
    expect(manifest.sort.direction).toBe("asc");
    expect(manifest.sort.tieBreak).toEqual(["generation", "launchId"]);
  });
});

describe("Overview and Explore share one snapshot identity", () => {
  it("agrees on the total launch count", () => {
    expect(manifest.totals.all).toBe(totalLaunches(activeSnapshot));
  });

  it("agrees on every per-generation count", () => {
    for (const g of activeSnapshot.generations) {
      expect(manifest.totals[g.id]).toBe(g.launchCount);
    }
  });

  it("agrees on every last observed launch block", () => {
    for (const g of activeSnapshot.generations) {
      expect(manifest.lastObservedLaunchBlock[g.id]).toBe(g.lastObservedLaunchBlock);
    }
  });

  it("never indexes a launch past the snapshot head block", () => {
    expect(manifest.blockRange.max).toBeLessThanOrEqual(activeSnapshot.run.headBlock);
  });
});

describe("pagination", () => {
  it("declares a view for every generation and status combination", () => {
    for (const g of GENERATION_VIEWS) {
      for (const s of STATUS_VIEWS) {
        expect(manifest.views[viewKey(g, s)]).toBeDefined();
      }
    }
  });

  it("derives page counts from the data rather than a constant", () => {
    for (const [key, v] of Object.entries(manifest.views)) {
      expect(v.pages, key).toBe(Math.ceil(v.total / manifest.pageSize));
    }
  });

  it("puts the remainder in page 0 so a descending page never straddles", () => {
    for (const [key, v] of Object.entries(manifest.views)) {
      if (v.total === 0) continue;
      const expected = v.total % manifest.pageSize || manifest.pageSize;
      expect(v.firstPageRows, key).toBe(expected);
      expect(v.firstPageRows + (v.pages - 1) * manifest.pageSize, key).toBe(v.total);
    }
  });

  it("matches declared row counts on real page files", () => {
    for (const view of ["all/any", "retired/any", "legacy/any", "current/any"]) {
      const v = manifest.views[view]!;
      const first = read<ExplorePage>(`pages/${view}/0.json`);
      expect(first.rows.length, `${view} page 0`).toBe(v.firstPageRows);
      const last = read<ExplorePage>(`pages/${view}/${v.pages - 1}.json`);
      expect(last.rows.length, `${view} last page`).toBe(manifest.pageSize);
    }
  });

  it("keeps every shard row count equal to its declared total", () => {
    for (const view of ["all/any", "retired/any", "all/graduated", "all/awaiting"]) {
      const v = manifest.views[view]!;
      let counted = 0;
      for (let p = 0; p < v.pages; p++) {
        counted += read<ExplorePage>(`pages/${view}/${p}.json`).rows.length;
      }
      expect(counted, view).toBe(v.total);
    }
  });

  it("status views partition the generation view exactly", () => {
    for (const g of GENERATION_VIEWS) {
      const any = manifest.views[viewKey(g, "any")]!.total;
      const parts = (["trading", "awaiting", "graduated"] as const).reduce(
        (acc, s) => acc + manifest.views[viewKey(g, s)]!.total,
        0
      );
      expect(parts, g).toBe(any);
    }
  });
});

/**
 * A view with no rows is the case that produced the worst kind of bug: the
 * counter read "0 of 0" while the table underneath still showed the previous
 * view's rows, matching neither the generation filter nor the status filter.
 *
 * The suite runs in a node environment with no DOM, so these pin the two
 * halves that make the rendered outcome inevitable: the data really does
 * contain a zero-total view to walk into, and the component reads browse rows
 * only through a key check, so state belonging to another view cannot reach
 * the table. The rendered behaviour itself is verified in a browser.
 */
describe("a zero-total view renders empty, never stale rows", () => {
  const EMPTY = viewKey("current", "awaiting");

  it("still has a real zero-total view to guard against", () => {
    const empty = manifest.views[EMPTY]!;
    expect(empty.total).toBe(0);
    expect(empty.pages).toBe(0);
    expect(empty.firstPageRows).toBe(0);
  });

  it("writes no shard for it, so browse has nothing to fetch", () => {
    expect(fs.existsSync(path.join(ROOT, "pages", "current", "awaiting"))).toBe(false);
  });

  it("recovers into a non-empty sibling view of the same generation", () => {
    const graduated = manifest.views[viewKey("current", "graduated")]!;
    expect(graduated.total).toBeGreaterThan(0);
    expect(graduated.pages).toBeGreaterThan(0);
    expect(read<ExplorePage>(`pages/current/graduated/0.json`).rows.length).toBe(
      graduated.firstPageRows
    );
  });

  it("reads browse rows only through a key check, so no stale view can render", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "explore", "explore-browser.tsx"),
      "utf8"
    );
    // The gate itself.
    expect(src).toContain("const browseRows = browse?.key === browseKey ? browse.rows : null");
    // Every consumer goes through it rather than reaching into `browse`.
    expect(src).toContain(": (browseRows ?? []);");
    expect(src).toContain("(browseRows?.length || manifest.pageSize)");
    expect(src).toContain("browseRows === null");
    // The ungated read that caused the bug must not come back.
    expect(src).not.toContain("browse?.rows ?? []");
    expect(src).not.toContain("browse?.rows.length");
    expect(src).not.toContain("browse?.failed ?? false");
  });

  it("keeps an empty result explained rather than blank", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "explore", "explore-browser.tsx"),
      "utf8"
    );
    expect(src).toContain("those filters");
    expect(src).toContain("is present in this snapshot");
  });
});

describe("launch identity", () => {
  const sample = read<ExplorePage>("pages/all/any/0.json").rows;

  it("derives the canonical key from generation and launchId together", () => {
    for (const row of sample) {
      const d = decodeRow(row);
      expect(d.key).toBe(`${d.generation}:${d.launchId}`);
    }
  });

  it("exposes no standalone launchId lookup index", () => {
    // The id index is generation-scoped on disk: id/{generation}/{bucket}.json.
    // A flat id/{bucket}.json would make launchId look globally unique.
    const entries = fs.readdirSync(path.join(ROOT, "id"), { withFileTypes: true });
    expect(entries.every((e) => e.isDirectory())).toBe(true);
    expect(entries.map((e) => e.name).sort()).toEqual([...GENERATION_IDS].sort());
  });

  it("finds the same launchId in more than one generation, proving it is not unique", () => {
    const size = manifest.indexes.idBucketSize;
    const present = GENERATION_IDS.filter((g) => {
      const bucket = read<Record<string, ExploreRow>>(`id/${g}/${Math.floor(1000 / size)}.json`);
      return Boolean(bucket["1000"]);
    });
    expect(present.length).toBeGreaterThan(1);
  });

  it("keeps token addresses globally unique across a sampled page set", () => {
    const seen = new Set<string>();
    for (let p = 0; p < 12; p++) {
      for (const row of read<ExplorePage>(`pages/all/any/${p}.json`).rows) {
        expect(seen.has(row[2])).toBe(false);
        seen.add(row[2]);
      }
    }
    expect(seen.size).toBeGreaterThan(1000);
  });

  it("uses well formed lowercase addresses with no 0x prefix on the wire", () => {
    for (const row of sample) {
      expect(row[2]).toMatch(/^[0-9a-f]{40}$/);
      expect(row[3]).toMatch(/^[0-9a-f]{40}$/);
    }
    const d = decodeRow(sample[0]!);
    expect(d.token.startsWith("0x")).toBe(true);
  });
});

describe("row content", () => {
  const sample = read<ExplorePage>("pages/all/any/0.json").rows;

  it("uses only valid generation codes", () => {
    for (const row of sample) expect([0, 1, 2]).toContain(row[0]);
  });

  it("uses only the three upstream lifecycle states, inventing none", () => {
    expect(Object.keys(STATUS_UPSTREAM).sort()).toEqual(["0", "1", "2"]);
    expect(Object.values(STATUS_UPSTREAM).sort()).toEqual([
      "CURVE_COMPLETE_AWAITING_GRADUATION",
      "CURVE_TRADING",
      "GRADUATED",
    ]);
    for (const row of sample) expect([0, 1, 2, null]).toContain(row[8]);
    expect(Object.keys(manifest.statusCodes).sort()).toEqual([
      "CURVE_COMPLETE_AWAITING_GRADUATION",
      "CURVE_TRADING",
      "GRADUATED",
    ]);
  });

  it("carries exactly the ten agreed fields, in order", () => {
    expect(manifest.rowFormat).toEqual([
      "generation",
      "launchId",
      "token",
      "creator",
      "deploymentBlock",
      "launchTimestamp",
      "name",
      "symbol",
      "status",
      "isQuotedLaunch",
    ]);
    for (const row of sample) expect(row).toHaveLength(10);
  });
});

describe("no windowed or ranking data reaches Explore", () => {
  const banned = /(volume|burn|totalfees|feeswei|tradecount|trades|rank|score|trending|price|marketcap|holders)/i;

  it("declares no such field in the row format", () => {
    for (const f of manifest.rowFormat) expect(banned.test(f)).toBe(false);
  });

  it("has no such key anywhere in the manifest", () => {
    const walk = (v: unknown): string[] =>
      v && typeof v === "object"
        ? Object.entries(v as Record<string, unknown>).flatMap(([k, c]) => [k, ...walk(c)])
        : [];
    expect(walk(manifest).filter((k) => banned.test(k))).toEqual([]);
  });

  it("has no such key in a page shard", () => {
    const page = read<Record<string, unknown>>("pages/all/any/0.json");
    expect(Object.keys(page).filter((k) => banned.test(k))).toEqual([]);
  });
});

describe("untrusted name and symbol handling", () => {
  it("never fetches metadata or IPFS anywhere in the source", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx|mjs)$/.test(e.name)) files.push(p);
      }
    };
    walk(path.join(process.cwd(), "src"));
    walk(path.join(process.cwd(), "scripts"));
    const offenders = files.filter((f) => {
      const s = fs.readFileSync(f, "utf8");
      return /ipfs|metadataURI|gateway\.pinata|dweb\.link/i.test(s);
    });
    expect(offenders).toEqual([]);
  });

  it("never uses dangerouslySetInnerHTML", () => {
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(d, e.name);
        return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
      });
    const offenders = walk(path.join(process.cwd(), "src")).filter((f) =>
      fs.readFileSync(f, "utf8").includes("dangerouslySetInnerHTML")
    );
    expect(offenders).toEqual([]);
  });

  it("stores names as plain strings, never as markup the table would interpret", () => {
    const rows = read<ExplorePage>("pages/all/any/0.json").rows;
    for (const row of rows) {
      if (row[6] !== null) expect(typeof row[6]).toBe("string");
      if (row[7] !== null) expect(typeof row[7]).toBe("string");
    }
  });
});

describe("empty-result messaging states snapshot scope", () => {
  it("names the head block and rejects a bare not-found", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "explore", "explore-browser.tsx"),
      "utf8"
    );
    expect(src).toContain("is present in this snapshot");
    expect(src).toContain("formatBlock(headBlock)");
    expect(src).not.toMatch(/>\s*Not found\s*</);
  });

  it("explains that launch ids are factory scoped rather than resolving one", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "explore", "explore-browser.tsx"),
      "utf8"
    );
    expect(src).toContain("Launch ids are scoped to a factory generation");
  });
});

describe("public copy style", () => {
  /**
   * The project writes without em dashes. AGENTS.md is excluded because Next
   * generates and re-adds it on every dev run, so it is tooling output rather
   * than copy this project controls.
   */
  it("uses no em dashes in any source file", () => {
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(d, e.name);
        return e.isDirectory() ? walk(p) : /\.(ts|tsx|css|mjs)$/.test(e.name) ? [p] : [];
      });
    const offenders = [
      ...walk(path.join(process.cwd(), "src")),
      ...walk(path.join(process.cwd(), "scripts")),
    ].filter((f) => fs.readFileSync(f, "utf8").includes("\u2014"));
    expect(offenders).toEqual([]);
  });
});

describe("name index supports filtering and sorting without extra fetches", () => {
  it("declares the extended entry format", () => {
    expect(manifest.indexes.nameEntryFormat).toEqual([
      "name",
      "symbol",
      "generation",
      "launchId",
      "status",
      "deploymentBlock",
    ]);
  });

  it("carries generation, status and block on every entry", () => {
    const bucket = read<NameEntry[]>("name/pi.json");
    expect(bucket.length).toBeGreaterThan(0);
    for (const e of bucket) {
      expect(e).toHaveLength(6);
      expect([0, 1, 2]).toContain(e[2]);
      expect(Number.isInteger(e[3])).toBe(true);
      expect([0, 1, 2, null]).toContain(e[4]);
      expect(e[5]).toBeGreaterThan(0);
    }
  });

  it("agrees with the id index on status and block, so filters cannot disagree", () => {
    const size = manifest.indexes.idBucketSize;
    const bucket = read<NameEntry[]>("name/pi.json").slice(0, 40);
    for (const [, , g, id, status, block] of bucket) {
      const gen = GENERATION_IDS[g]!;
      const rows = read<Record<string, ExploreRow>>(`id/${gen}/${Math.floor(id / size)}.json`);
      const row = rows[String(id)];
      expect(row, `${gen}:${id}`).toBeDefined();
      expect(row![8]).toBe(status);
      expect(row![4]).toBe(block);
    }
  });

  it("indexes enough entries that a common prefix exceeds one page", () => {
    const bucket = read<NameEntry[]>("name/pi.json");
    const norm = "pixel";
    const matches = bucket.filter(([name, symbol]) =>
      `${name ?? ""} ${symbol ?? ""}`
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .some((w) => w.startsWith(norm))
    );
    // The old build truncated at 200. Nothing is truncated now, so a common
    // prefix must be reachable beyond the first page.
    expect(matches.length).toBeGreaterThan(manifest.pageSize);
  });
});

describe("search result semantics", () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "explore", "explore-browser.tsx"),
    "utf8"
  );

  it("separates identity lookups from filterable list results", () => {
    expect(src).toContain('kind: "identity"');
    expect(src).toContain('kind: "list"');
  });

  it("applies generation and status filters to list results", () => {
    expect(src).toContain("STATUS_FILTER_CODE[status]");
    expect(src).toContain("c.generation === genCode");
    expect(src).toContain("c.status === statusCode");
  });

  it("no longer truncates name matches at a fixed cap", () => {
    expect(src).not.toContain("slice(0, 200)");
    expect(src).not.toContain("first ${limited.length}");
  });

  it("paginates list results at the browse page size", () => {
    expect(src).toContain("searchPage * manifest.pageSize");
    expect(src).toContain("Math.ceil(searchTotal / manifest.pageSize)");
  });

  it("takes a launch id with thousands separators, as the table prints them", () => {
    // The table renders "1,000", so that string has to paste back in.
    expect(src).toContain("(\\d[\\d,]*)$/i");
    expect(src).toContain('.replace(/,/g, "")');
  });

  it("keeps the generation half of an identity strict", () => {
    // Only an explicit generation or a gen1/gen2/gen3 alias names a launch.
    expect(src).toContain("^(retired|legacy|current)");
    expect(src).toContain("^gen\\s*([123])");
    // A bare number still goes to the ambiguity branch, never to a generation.
    expect(src).toContain('kind: "ambiguous"');
  });
});

describe("the results region is announced and reachable", () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "explore", "explore-browser.tsx"),
    "utf8"
  );

  it("announces a result change through one status region", () => {
    expect(src).toContain('role="status" aria-live="polite"');
    // One live region only. A second would announce the same change twice.
    expect(src.match(/aria-live="polite"/g)?.length).toBeLessThanOrEqual(2);
  });

  it("marks the results region busy while it loads", () => {
    expect(src).toContain("aria-busy={loading}");
  });

  it("puts the scrollable table in the tab order as a labelled region", () => {
    expect(src).toContain('role="region"');
    expect(src).toContain("tabIndex={0}");
    expect(src).toContain('aria-label="Indexed launches, scrollable"');
  });

  it("separates name from symbol for assistive tech", () => {
    expect(src).toContain('<span className="sr-only">, symbol </span>');
  });
});

describe("interactive controls are distinguishable from decorative rules", () => {
  it("defines a control border token separate from the hairlines", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src", "app", "globals.css"),
      "utf8"
    );
    expect(css).toContain("--color-control:");
    expect(css).toContain("--color-control-strong:");
    // The decorative hairlines stay where they were.
    expect(css).toContain("--color-line: #23262b");
  });

  it("uses it for the search input, the selects and the pager", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "explore", "explore-browser.tsx"),
      "utf8"
    );
    // input, submit, clear, select, page button, picker button, copy button
    expect(src.match(/border-control\b/g)?.length).toBeGreaterThanOrEqual(6);
  });
});
