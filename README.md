# Vibe/Vibe Testnet Dashboard

A public, read-only view of Vibe/Vibe launch activity on Robinhood Chain testnet, built on
output from the [vibevibe-testnet-indexer](https://github.com/itstorvian/vibevibe-testnet-indexer).

**Unofficial and community built.** Not affiliated with Vibe/Vibe, Seedify, Robinhood, or
Robinhood Chain. Testnet only, chain ID `46630`. All values are test values.

This is a research interface, not a product. There is no trading, no wallet connection, no
portfolio tracking, no rankings, and no write path of any kind.

---

## Current scope

| Section | Status |
|---|---|
| Overview `/` | Implemented |
| Launch Explorer `/explore` | Implemented |
| Factory generations | Implemented as an Overview section, `/#factories` |
| Methodology / indexer status | Implemented as an Overview section, `/#methodology` |
| Launch Detail | Not built |
| Known Limitations page | Not built |

Nothing in the interface navigates to a page that does not exist, and no table row pretends
to link to a launch detail page that has not been built.

## Explore

Explore browses all indexed launches from static shards generated at build time. The browser
fetches one page of 100 rows at a time, roughly 13 KB, and never loads the full dataset.

Search resolves by the shape of the input:

| Input | Resolves to |
|---|---|
| `retired:42`, `legacy:42`, `current:42`, `gen1:42` | that one launch. Thousands separators are accepted, so `retired:1,000` works too |
| a 40 character hex address | token lookup and creator lookup, both reported |
| a bare integer | **nothing.** Launch ids are factory scoped, so it offers the candidates per generation and makes you choose |
| anything else | word-prefix match on name and symbol, minimum two characters |

Filters cover generation and lifecycle status; sort is newest or oldest by deployment block.
There are no rankings, scores, prices or trending metrics, by design.

### Regenerating the shards

The shards are derived from a completed indexer run and are not committed by the indexer.
Point the builder at a run's `projects.ndjson`; it streams the file and never copies it.

```bash
npm run build:explore -- --input "D:/path/to/output/projects.ndjson"
```

The generated `public/explore/manifest.json` is the sole authority for totals and page
counts. Nothing in the interface or the tests hardcodes a page count.

---

## Running locally

Requires Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

The dashboard is then at `http://localhost:3000`.

No environment configuration is needed. There is no `.env` file and no API key, because the
browser never talks to an RPC endpoint or to any operator API.

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` in strict mode |
| `npm run lint` | ESLint |
| `npm test` | Vitest, run once |
| `npm run build:explore` | Regenerate Explore shards from an indexer run |
| `npm run test:watch` | Vitest, watch mode |

---

## Architecture

```
Robinhood Chain testnet (46630)
        |
   vibevibe-testnet-indexer        full history launch scan, read only
        |
   validated run output            projects.ndjson, factories.json, fees.json
        |
   +-- dashboard snapshot          src/data/snapshots/*.ts, typed aggregates
   |        |
   |   Overview page               server rendered, static
   |
   +-- static Explore shards       public/explore/**, built by a streaming script
            |
       Explore page                server shell + client island, one page fetched at a time
```

The browser does no chain scanning. It never queries an RPC endpoint, never fetches the
operator's API, and never loads a launch dataset. The full indexer output runs to hundreds of
megabytes, so none of it belongs in a page.

Pages render on the server. The client components are the navigation (for active-route
state), the address copy control, and the Explore browser, which fetches one shard at a time.

### The data layer

`src/data/types.ts` defines `IndexerSnapshot`, the dashboard's contract. It mirrors the
indexer's own terminology (`generation`, `label`, `launchId`, `dense`, `headBlock`) rather
than renaming anything upstream.

`src/data/snapshots/2026-09-17-120753391.ts` is the only place aggregate figures live.
Snapshots are named by date and head block, because two validated runs can land on one day. It is a TypeScript literal
checked with `satisfies IndexerSnapshot`, so a malformed snapshot is a compile error.
`src/data/index.ts` picks the active one.

Two rules the data layer enforces:

- **`totalLaunches` is derived, not stored.** It is summed from the generations in
  `src/data/derive.ts`, so the headline total can never disagree with the three numbers
  printed below it.
- **There is no global launch identifier.** Every factory numbers its launches from zero
  independently, so `launchId` collides across generations. A launch is only identifiable as
  `{generation}:{launchId}` or by its token address. The contract has no field that would let
  a component treat `launchId` as unique, and a test fails if one is ever added.

To connect a newer run, add a snapshot file beside the existing one, repoint
`activeSnapshot`, and rebuild the Explore shards from the same run. A test asserts that the
Overview snapshot and the Explore manifest agree on the total, every per-generation count and
every last-observed block, so the two cannot drift onto different runs.

---

## Data freshness

**Nothing here is live, and the interface says so in several places.**

The figures come from one validated indexing run finished on September 17, 2026 at head block
`120,753,391`. They stay fixed until a newer snapshot is connected. There is no polling, no
relative "updated N minutes ago" timer, and no background refresh.

Launch counts are lifetime totals because launch reconstruction always scans from the earliest
factory deployment to the head block. That is the one scan the indexer never windows.

Trade, fee, volume and burn figures from the same run are **windowed to a block range** and are
not lifetime totals, so none of them appear on the Overview and none are carried in the
snapshot at all. A test enforces that.

The chain is active. Launches were still being created as the run reached its head block, so the
real totals are already higher than what the page shows. Legacy and current were both producing
launches close to the head; the retired factory's most recent observed launch sits 130,596 blocks
below it.

---

## Known limitations

These belong to the upstream indexer and are inherited here, not introduced by the dashboard.

1. **Factory discovery is manual.** No on-chain registry listing factory deployments was
   identified, so the indexer works from a hand maintained list. A factory that is not
   configured is never scanned, and its launches would be missing from these totals with no
   error and no warning. The Overview never claims coverage beyond what the configured indexer
   observed.
2. **"Retired" is the operator's label, not an observed state.** The operator has dropped that
   factory from every list it publishes, yet it accounts for 14,799 launches and its most recent
   one sits 130,596 blocks below the run's head block. It produced none in the stretch between
   the two runs of that date. The interface reports the observed gap rather than calling the
   factory active or inactive.
3. **Fee economics differ per generation.** The retired generation runs 100 bps at a 50/50
   split while legacy and current run 125 bps at 75/25. There is deliberately no single
   platform-wide rate anywhere in this project.
4. **The legacy graduation target is unverified.** It was never read on chain, so it renders as
   "Not verified" rather than borrowing the current generation's 5 ETH.
5. **Verification dates differ by field, on purpose.** The adopted run re-read fee rates and
   splits across every curve, so those carry its date. It never read `NET_GRADUATION_TARGET`
   and never re-derived the address book, so those keep their earlier date. The interface
   shows both rather than one blended date.
6. **Point-in-time figures.** Every number is an observation stamped with a head block, not a
   standing property of the protocol.

Fuller detail lives in `docs/known-limitations.md` in the indexer repository.

### Interface limitations in this version

Known and accepted for v0.1, listed so nobody has to rediscover them.

- Name search matches one word at a time, so `pixel panda` finds nothing that `pixel` does not.
- Names and symbols shorter than two characters are not reachable by name search. Fifteen
  launches fall in that gap; all of them are reachable by `generation:launchId` or token address.
- Explore state does not live in the URL, so a filtered view or a search is not linkable.
- Factories and Methodology are reachable from the header above 640px and by scrolling below it.
- A search whose results are scattered across the id index fetches several shards to render one
  page. Correct, but heavier than a browse page.

---

## Security posture

- No private keys, seed phrases, or signing of any kind.
- No wallet connection and no Web3 libraries in the dependency tree.
- No transaction submission and no contract write calls.
- No database, no backend, no authentication.
- No analytics, telemetry, or tracking scripts.
- No API secrets and no credential-bearing RPC URLs. The only endpoint named anywhere is the
  public unkeyed one, and it is displayed as provenance rather than called.
- Fonts are self-hosted at build time, so the page makes no third-party requests at runtime.
- Three runtime dependencies: `next`, `react`, `react-dom`.

---

## Source

Indexer: [itstorvian/vibevibe-testnet-indexer](https://github.com/itstorvian/vibevibe-testnet-indexer)
at v0.1.0.

The indexer is treated as a read-only upstream dependency. Nothing in this repository modifies
it, and the dashboard follows its schema and naming rather than the other way around.
