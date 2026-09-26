# Vibe/Vibe Testnet Dashboard

A public, read-only view of Vibe/Vibe launch activity on Robinhood Chain testnet, built on
output from the [vibevibe-testnet-indexer](https://github.com/itstorvian/vibevibe-testnet-indexer).

**Unofficial and community built.** Not affiliated with Vibe/Vibe, Seedify, Robinhood, or
Robinhood Chain. Testnet only, chain ID `46630`. All values are test values.

This is a research interface, not a product. There is no trading, no wallet connection, no
portfolio tracking, no rankings, and no write path of any kind.

The Overview headline figures are **160,851 launches**, **3,431,107 indexed transactions**,
and **118,251 Indexed actor addresses** at pinned head `124,399,779` on September 26, 2026.
The validated September 18 prefix was replayed offline and extended with only the new
block range. Explore retains its separate September 17 enriched source.

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

`src/data/snapshots/2026-09-26-124399779.ts` selects the Overview aggregates, including
the generated `participants-2026-09-26-124399779.json` artifact. The original September 18
snapshot is preserved. A separate source file pins exact source identity, counts and hashes. Snapshots are named by
date and head block, because two validated runs can land on one day. The schema-3
TypeScript literal is checked with `satisfies IndexerSnapshot`; participant data also
passes a runtime validator before it reaches React.
`src/data/index.ts` picks the active one.

Rules the data layer enforces:

- **`totalLaunches` is derived, not stored.** It is summed from the generations in
  `src/data/derive.ts`, so the headline total can never disagree with the three numbers
  printed below it.
- **There is no global launch identifier.** Every factory numbers its launches from zero
  independently, so `launchId` collides across generations. A launch is only identifiable as
  `{generation}:{launchId}` or by its token address. The contract has no field that would let
  a component treat `launchId` as unique, and a test fails if one is ever added.
- **The transaction count is stored, never derived.** It cannot be reconstructed from anything
  else in the contract, so `activity.uniqueTransactionCount` is carried verbatim from the run's
  `output/activity.json` and rendered. A test asserts that no component does arithmetic on it
  and that `src/data/derive.ts` never mentions transactions at all. `activity.isFullHistory` is
  the literal `true`, so a snapshot from a windowed curve scan is a compile error rather than a
  review catch.
- **Address unions are produced by the indexer.** The runtime participant validator pins
  chain, source timestamps, start/head blocks, complete coverage, every authoritative
  reconciliation count, diagnostics and set-count consistency. Components only render
  these values. The snapshot test pins the exact adopted artifact's SHA-256 digest.

To connect a newer Overview run, add a validated snapshot beside the existing one and repoint
`activeSnapshot`. Explore keeps its separately declared source in `src/data/explore-source.ts`.
Only rebuild its shards when a suitable fully enriched run is available, then update that
declaration. Tests check Explore's totals and block bounds against its own source and require
the page to disclose the difference when Overview is newer.

---

## Indexed transactions

The Overview's transaction headline is **3,431,107** on the adopted snapshot.

> **Definition.** The number of distinct transaction hashes observed across the launch and
> curve event surfaces the upstream indexer covers, deduplicated globally.

**It is not an event count and not a trade count.** One transaction routinely emits several
indexed events, so summing rows overstates it, and so does summing the three category counts:

| Category | Distinct transactions |
|---|---|
| Launch (`TokenLaunched`, `TokenLaunchedQuoted`) | 160,851 |
| Curve trades (`Bought`, `Sold`) | 3,318,631 |
| Curve lifecycle (`CurveCompleted`, `Graduated`, `CreatorFeesForwarded`) | 65,932 |
| Sum of the above | 3,545,414 |
| **Union, which is the published figure** | **3,431,107** |
| Counted in more than one category | 114,307 |

Graduation is the clearest case: `CurveCompleted`, `Graduated` and `CreatorFeesForwarded`
land in the same transaction as the buy that triggered them. The combined history contains 78,779 lifecycle
events from 65,932 distinct transactions for that reason.

**It is a lifetime total for the configured surfaces**, because the preserved prefix and
adjacent delta provide continuous launch and curve coverage from the earliest deployment to head. A windowed curve scan cannot produce one, and the snapshot
type makes such a snapshot unrepresentable.

**What it excludes.** The Overview lists these verbatim from the run rather than paraphrasing:

| Excluded | Why |
|---|---|
| Post-graduation DEX trading | Graduated tokens trade on Uniswap v4, which this project does not index at all |
| Buyback and burn transfers | Plain ERC-20 `Transfer` logs, found by a separate scan with its own block window |
| `LaunchFeesClaimed` | The operator's treasury sweep: neither launch nor curve activity |
| Transactions emitting none of the included events | An approval, a plain transfer, a failed call, a read |
| Launches from an unconfigured factory | Outside metric scope; incremental discovery stops on an unknown published factory or known launch-event emitter |

So the label is **"Indexed transactions"**, never "total transactions". Nothing in either
repository could substantiate the second claim.

**Source.** The indexer's `sample-output/current-124399779/overview.json`, with
`incremental-proof.json` and the hashed input manifest. Reproduce with the indexer's offline
`advance:snapshot` command after the delta is frozen. `--fetch` is explicit network opt-in;
it scans only the adjacent delta. A full-history RPC run is unnecessary.

---

## Indexed address participation

The primary Overview metric is **Indexed actor addresses**: the global union of launch
creators, Bought buyers and Sold sellers. Supporting detail shows **Indexed participant
addresses**, which adds Bought recipients. Both are **118,251** in this snapshot: every
buy recipient already appears in an actor role somewhere in the indexed history. Their
definitions remain separate. A recipient-only address would affect only the broader count.

The supporting panel includes creator, buyer/seller, recipient and trade-participant
counts, both creator overlaps, and separate multi-project actor/participant counts.
Categories overlap. More than one distinct factory-scoped project is required for a
multi-project address; repeated events within one project do not qualify.

These are cumulative event-role address counts. Contracts and intermediaries remain
included. They do not measure distinct people or transaction senders. Lifecycle initiators,
post-graduation DEX activity and unconfigured factories remain outside scope. No name,
social or identity enrichment is performed. Time-windowed activity is not implemented.

The current artifact combines the unchanged historical prefix through 121,309,670 with
the complete delta 121,309,671–124,399,779. The prefix still reproduces 97,733 launches,
2,098,026 transactions, 75,459 lifecycle events and 88,781 actor/participant addresses.
The new artifact carries its pinned head hash, source timestamps, separate `derivedAt`,
input-manifest hash and incremental proof hash. Full manifests remain in the indexer.

Both participant and Overview aggregates pass runtime validation against fixed publication
pins before reaching React. The adopted JSON copies are hash-tested against the indexer.
Never adopt failed or unreconciled output. No Explore regeneration is needed.

## Two runs, named separately

Overview and Explore are built from **different runs**, and each says which.

| Surface | Run | Head block | Launches |
|---|---|---|---|
| Overview `/` | 2026-09-26 | `124,399,779` | 160,851 |
| Explore `/explore` | 2026-09-17 | `120,753,391` | 96,490 |

They shared a run until 2026-09-18. Rebuilding the Explore shards needs head state read for
every launch, because the table shows name, symbol and lifecycle status per row. The run that
established the transaction count deliberately sampled head state instead: those fields are
irrelevant to counting transactions, and reading them for 97,733 launches is tens of thousands
of extra RPC calls against a shared public endpoint. Rebuilding from it would have emptied a
column on every row.

So Explore keeps the shards from the run that can populate them. A stale but complete and
correctly labelled table beats a current one full of nulls, and beats either page silently
claiming a head block it was not built at.

`src/data/explore-source.ts` declares Explore's run, and tests cross-check it against the
generated manifest so the declaration cannot drift from the shards. Explore renders its own
head block and date, and says so on the page whenever the Overview is newer. Rebuilding the
shards from a fully enriched run and repointing `activeSnapshot` at that same run collapses
the two back into one.

---

## Data freshness

**Nothing here is live, and the interface says so in several places.**

Overview is fixed at block `124,399,779`, observed on September 26, 2026. The scan
finished at `2026-09-26T03:52:52.510Z`; interruption/resume and the earlier pinned target
are preserved in the proof. The head hash was checked before and after scanning.
There is no polling, background refresh or finality claim.

Launch, transaction and participation totals cover the configured event surfaces through
that head. The validated historical prefix remains unchanged. No burn scan, market
aggregates or project-state enrichment were added. Fee models retain September 18
verification; graduation targets retain September 13 verification.

**Explore is on a different, older run.** See [Two runs, named separately](#two-runs-named-separately).

---

## Known limitations

These belong to the upstream indexer and are inherited here, not introduced by the dashboard.

1. **Factory discovery is manual.** No on-chain registry listing factory deployments was
   identified, so the indexer works from a hand maintained list. A factory that is not
   configured is outside metric scope. Incremental advancement stops on an unknown published
   factory or known launch-event emitter. Unpublished deployments using different signatures
   remain outside this discovery method. The Overview keeps that limit explicit.
2. **"Retired" is the operator's label, not an observed state.** The operator has dropped that
   factory from every list it publishes, yet it accounts for 14,806 launches and added six
   in this delta. Its most recent launch sits 723 blocks below the pinned head, against four
   for the current factory. The
   interface reports the observed gap rather than calling the factory active or inactive.
3. **Fee economics differ per generation.** The retired generation runs 100 bps at a 50/50
   split while legacy and current run 125 bps at 75/25. There is deliberately no single
   platform-wide rate anywhere in this project.
4. **The legacy graduation target is unverified.** It was never read on chain, so it renders as
   "Not verified" rather than borrowing the current generation's 5 ETH.
5. **Verification dates differ by field, on purpose.** The September 18 run re-read fee rates and
   splits across its 800 sampled curves and checked event fee arithmetic, so those carry its date. It never read `NET_GRADUATION_TARGET`
   and never re-derived the address book, so those keep their earlier date. The interface
   shows both rather than one blended date.
6. **"Indexed transactions" is scoped, not total.** It counts distinct transaction hashes on the
   launch and curve event surfaces the indexer reads. Post-graduation trading on Uniswap v4, burn
   transfers, the operator's `LaunchFeesClaimed` sweeps, and any transaction emitting none of
   those events are all outside it. The Overview lists the exclusions verbatim from the run.
7. **Overview and Explore are on different runs.** See
   [Two runs, named separately](#two-runs-named-separately).
8. **Point-in-time figures.** Every number is an observation stamped with a head block, not a
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
