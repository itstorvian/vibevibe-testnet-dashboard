/**
 * Build the static Explore shards from a completed indexer run.
 *
 * Streams the run's projects.ndjson line by line and never copies it. The
 * source stays wherever the run wrote it (a separate drive in practice); only
 * the small derived shards land in public/explore.
 *
 * The released indexer is a read-only input. Nothing here writes to it.
 *
 * Usage:
 *   node scripts/build-explore-index.mjs --input <path to projects.ndjson>
 *                                        [--out public/explore]
 *                                        [--page-size 100]
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

// ---------------------------------------------------------------------------
// Contract. Mirrored by src/data/explore-types.ts and pinned by tests.
// ---------------------------------------------------------------------------

/** Wire order of a row. Positional to keep shards small. */
// [g, id, token, creator, block, ts, name, symbol, status, quoted]
const GENERATION_CODE = { retired: 0, legacy: 1, current: 2 };
const GENERATION_ID = ["retired", "legacy", "current"];

/** Upstream lifecycle strings, coded. No state is invented here. */
const STATUS_CODE = {
  CURVE_TRADING: 0,
  CURVE_COMPLETE_AWAITING_GRADUATION: 1,
  GRADUATED: 2,
};
const STATUS_VIEW = { any: null, trading: 0, awaiting: 1, graduated: 2 };

const GENERATION_VIEWS = ["all", "retired", "legacy", "current"];
const STATUS_VIEWS = ["any", "trading", "awaiting", "graduated"];

/**
 * Fields that must never reach a shard.
 *
 * Two independent reasons, and the first outlives the second: this project
 * shows no rankings and no market view, by design. On top of that, these fields
 * are windowed to a block range on a default upstream run, so presenting them
 * would imply a completeness the data does not have. A --full-trades run makes
 * the trade-derived ones lifetime figures and this exclusion still stands.
 */
const FORBIDDEN_KEYS = /(volume|burn|totalfees|feeswei|trade|rank|score|trending|price|marketcap)/i;

// ---------------------------------------------------------------------------

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const INPUT = arg("input", null);
const OUT = path.resolve(arg("out", "public/explore"));
const PAGE_SIZE = Number(arg("page-size", 100));

if (!INPUT) {
  console.error("error: --input <projects.ndjson> is required");
  process.exit(1);
}
if (!fs.existsSync(INPUT)) {
  console.error(`error: input not found: ${INPUT}`);
  process.exit(1);
}

const val = (p) => (p && typeof p === "object" && "value" in p ? p.value : undefined);

console.log(`reading   ${INPUT}`);
console.log(`  size    ${(fs.statSync(INPUT).size / 1048576).toFixed(1)} MB (streamed, never copied)`);

// ---- 1. Stream the source into compact rows -------------------------------
const rows = [];
let skipped = 0;
{
  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT, { highWaterMark: 1 << 20 }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const t = line.trim();
    if (!t || t === "[" || t === "]") continue;
    let r;
    try { r = JSON.parse(t.replace(/,$/, "")); } catch { skipped++; continue; }
    if (!r?.identity) { skipped++; continue; }

    const gen = val(r.identity.generation);
    const g = GENERATION_CODE[gen];
    if (g === undefined) throw new Error(`unknown generation "${gen}" on ${r.key}`);

    const id = Number(val(r.identity.launchId));
    if (!Number.isInteger(id) || id < 0) throw new Error(`bad launchId on ${r.key}`);

    const state = val(r.lifecycle.state);
    const status = state in STATUS_CODE ? STATUS_CODE[state] : null;

    const tsRaw = val(r.timing.launchTimestamp);
    const ts = tsRaw == null ? null : Number(tsRaw);

    rows.push([
      g,
      id,
      String(val(r.identity.token)).replace(/^0x/, "").toLowerCase(),
      String(val(r.identity.creator)).replace(/^0x/, "").toLowerCase(),
      Number(val(r.timing.deploymentBlock)),
      Number.isFinite(ts) ? ts : null,
      val(r.identity.name) ?? null,
      val(r.identity.symbol) ?? null,
      status,
      val(r.market.isQuotedLaunch) ? 1 : 0,
    ]);
  }
}
console.log(`  parsed  ${rows.length.toLocaleString()} rows${skipped ? `, skipped ${skipped}` : ""}`);

// ---- 2. Canonical total order ---------------------------------------------
// deploymentBlock asc, then generation, then launchId. launchId is the exact
// per-factory sequence number upstream, so this is a total order, not a guess.
rows.sort((a, b) => a[4] - b[4] || a[0] - b[0] || a[1] - b[1]);

// ---- 3. Integrity assertions before anything is written -------------------
{
  const keys = new Set(), tokens = new Set();
  for (const r of rows) {
    const k = `${GENERATION_ID[r[0]]}:${r[1]}`;
    if (keys.has(k)) throw new Error(`duplicate canonical key ${k}`);
    keys.add(k);
    if (tokens.has(r[2])) throw new Error(`duplicate token address ${r[2]}`);
    tokens.add(r[2]);
    if (!/^[0-9a-f]{40}$/.test(r[2])) throw new Error(`bad token address ${r[2]}`);
    if (!/^[0-9a-f]{40}$/.test(r[3])) throw new Error(`bad creator address ${r[3]}`);
  }
  console.log(`  verified ${keys.size.toLocaleString()} unique keys, ${tokens.size.toLocaleString()} unique tokens`);
}

// ---- 4. Writers ------------------------------------------------------------
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let fileCount = 0, byteCount = 0;
function write(rel, data) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const s = JSON.stringify(data);
  if (FORBIDDEN_KEYS.test(Object.keys(data).join(" "))) {
    throw new Error(`refusing to write ${rel}: forbidden top-level key`);
  }
  fs.writeFileSync(p, s);
  fileCount++; byteCount += Buffer.byteLength(s);
}

/**
 * Paginate with the remainder in page 0.
 *
 * This makes descending page k exactly ascending page (pages-1-k) reversed, so
 * a newest-first view is always one fetch and never straddles two pages.
 */
function paginate(list) {
  const total = list.length;
  if (total === 0) return { total, pages: 0, firstPageRows: 0, slices: [] };
  const rem = total % PAGE_SIZE;
  const firstPageRows = rem === 0 ? PAGE_SIZE : rem;
  const slices = [list.slice(0, firstPageRows)];
  for (let i = firstPageRows; i < total; i += PAGE_SIZE) slices.push(list.slice(i, i + PAGE_SIZE));
  return { total, pages: slices.length, firstPageRows, slices };
}

// ---- 5. Browse shards: generation x status --------------------------------
const views = {};
for (const gv of GENERATION_VIEWS) {
  const byGen = gv === "all" ? rows : rows.filter((r) => GENERATION_ID[r[0]] === gv);
  for (const sv of STATUS_VIEWS) {
    const want = STATUS_VIEW[sv];
    const list = want === null ? byGen : byGen.filter((r) => r[8] === want);
    const { total, pages, firstPageRows, slices } = paginate(list);
    slices.forEach((slice, n) => write(`pages/${gv}/${sv}/${n}.json`, { v: `${gv}/${sv}`, p: n, n: slice.length, rows: slice }));
    views[`${gv}/${sv}`] = { total, pages, firstPageRows };
  }
}

// ---- 6. Address lookup buckets --------------------------------------------
const tokenBuckets = new Map(), creatorBuckets = new Map();
for (const r of rows) {
  const tb = r[2].slice(0, 2);
  if (!tokenBuckets.has(tb)) tokenBuckets.set(tb, {});
  tokenBuckets.get(tb)[r[2]] = [r[0], r[1]];

  const cb = r[3].slice(0, 2);
  if (!creatorBuckets.has(cb)) creatorBuckets.set(cb, {});
  const m = creatorBuckets.get(cb);
  (m[r[3]] ??= []).push([r[0], r[1]]);
}
for (const [k, v] of tokenBuckets) write(`addr/token/${k}.json`, v);
for (const [k, v] of creatorBuckets) write(`addr/creator/${k}.json`, v);

// ---- 6b. Id index: the universal row resolver -----------------------------
// Keyed by generation then launchId, because launchId alone is not unique.
// Address and name lookups resolve to {generation, launchId} pointers and then
// read full rows from here, so there is exactly one place a row is fetched by
// identity.
const ID_BUCKET = 500;
let idBucketCount = 0;
{
  const byGen = new Map();
  for (const r of rows) {
    const g = GENERATION_ID[r[0]];
    const b = Math.floor(r[1] / ID_BUCKET);
    const k = `${g}/${b}`;
    if (!byGen.has(k)) byGen.set(k, {});
    byGen.get(k)[r[1]] = r;
  }
  for (const [k, v] of byGen) {
    write(`id/${k}.json`, v);
    idBucketCount++;
  }
}

// ---- 7. Name and symbol prefix buckets ------------------------------------
// Bucketed on the first two alphanumerics of every WORD, so "panda" finds
// "PixelPanda" rather than only matching from the start of the string.
const normalize = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = (s) => normalize(s).split(" ").filter(Boolean);
const camelSplit = (s) => String(s ?? "").replace(/([a-z0-9])([A-Z])/g, "$1 $2");

const nameBuckets = new Map();
for (const r of rows) {
  const prefixes = new Set();
  for (const src of [camelSplit(r[6]), r[6], r[7]]) {
    for (const w of words(src)) {
      if (w.length >= 2) prefixes.add(w.slice(0, 2));
      else if (w.length === 1) prefixes.add(`${w}_`);
    }
  }
  for (const p of prefixes) {
    if (!nameBuckets.has(p)) nameBuckets.set(p, []);
    // [name, symbol, generation, launchId, status, deploymentBlock]
    //
    // status and block ride along so the client can apply the generation and
    // status filters and the sort order to search results without resolving
    // every match through the id index first. Only the visible page is
    // resolved to full rows.
    nameBuckets.get(p).push([r[6], r[7], r[0], r[1], r[8], r[4]]);
  }
}
for (const [k, v] of nameBuckets) write(`name/${k}.json`, v);

// ---- 8. Manifest, the sole authority for pagination -----------------------
const counts = { retired: 0, legacy: 0, current: 0 };
for (const r of rows) counts[GENERATION_ID[r[0]]]++;
const blocks = rows.map((r) => r[4]);
const lastBlockByGen = {};
for (const r of rows) {
  const g = GENERATION_ID[r[0]];
  lastBlockByGen[g] = Math.max(lastBlockByGen[g] ?? 0, r[4]);
}

const manifest = {
  schemaVersion: 1,
  builtFrom: { file: path.basename(INPUT), records: rows.length },
  pageSize: PAGE_SIZE,
  rowFormat: ["generation", "launchId", "token", "creator", "deploymentBlock",
              "launchTimestamp", "name", "symbol", "status", "isQuotedLaunch"],
  generationCodes: GENERATION_CODE,
  statusCodes: STATUS_CODE,
  sort: {
    canonical: "deploymentBlock",
    direction: "asc",
    tieBreak: ["generation", "launchId"],
    note: "Descending page k is ascending page (pages-1-k) reversed; the remainder lives in page 0 so a page never straddles.",
  },
  totals: { all: rows.length, ...counts },
  lastObservedLaunchBlock: lastBlockByGen,
  blockRange: { min: Math.min(...blocks), max: Math.max(...blocks) },
  views,
  indexes: {
    tokenBuckets: tokenBuckets.size,
    creatorBuckets: creatorBuckets.size,
    nameBuckets: nameBuckets.size,
    nameEntryFormat: ["name", "symbol", "generation", "launchId", "status", "deploymentBlock"],
    idBuckets: idBucketCount,
    idBucketSize: ID_BUCKET,
    nameSearchMinChars: 2,
  },
};
write("manifest.json", manifest);

console.log(`\nwrote ${fileCount.toLocaleString()} files, ${(byteCount / 1048576).toFixed(2)} MB`);
console.log(`  totals: ${JSON.stringify(manifest.totals)}`);
console.log(`  views:  ${Object.keys(views).length}`);
console.log(`  buckets: token ${tokenBuckets.size}, creator ${creatorBuckets.size}, name ${nameBuckets.size}`);
console.log(`  out: ${OUT}`);
