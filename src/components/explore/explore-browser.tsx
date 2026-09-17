"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  decodeRow,
  GENERATION_IDS,
  GENERATION_VIEWS,
  STATUS_VIEWS,
  viewKey,
  type ExploreGenerationId,
  type ExploreLaunch,
  type ExploreManifest,
  type ExplorePage,
  type ExploreRow,
  type Candidate,
  type NameEntry,
  type StatusCode,
  type GenerationView,
  type StatusView,
} from "@/data/explore-types";
import { addressUrl, blockUrl } from "@/lib/explorer";
import { formatBlock, formatCount, formatUtcDayMonthYear, truncateAddress } from "@/lib/format";

const GENERATION_LABEL: Record<GenerationView, string> = {
  all: "All",
  retired: "Retired",
  legacy: "Legacy",
  current: "Current",
};

const STATUS_FILTER_LABEL: Record<StatusView, string> = {
  any: "Any status",
  trading: "Trading",
  awaiting: "Awaiting graduation",
  graduated: "Graduated",
};

/** Short cell labels. The exact upstream constant stays in the title. */
const STATUS_CELL: Record<number, { label: string; upstream: string }> = {
  0: { label: "Trading", upstream: "CURVE_TRADING" },
  1: { label: "Awaiting graduation", upstream: "CURVE_COMPLETE_AWAITING_GRADUATION" },
  2: { label: "Graduated", upstream: "GRADUATED" },
};

/** The status filter as a row code. null means the filter is off. */
const STATUS_FILTER_CODE: Record<StatusView, StatusCode | null> = {
  any: null,
  trading: 0,
  awaiting: 1,
  graduated: 2,
};

type SortOrder = "newest" | "oldest";

interface Props {
  manifest: ExploreManifest;
  headBlock: number;
  validationDate: string;
  explorerBase: string;
}

/** Small fetch cache so paging back and forth does not refetch. */
const cache = new Map<string, unknown>();
async function getJson<T>(path: string): Promise<T | null> {
  if (cache.has(path)) return cache.get(path) as T;
  const res = await fetch(path);
  if (!res.ok) return null;
  const data = (await res.json()) as T;
  cache.set(path, data);
  return data;
}

/**
 * Search results come in two shapes.
 *
 * An IDENTITY lookup (generation:launchId, or an exact token address) names
 * one launch, so the browse filters do not apply: hiding the very row you
 * asked for by id would be worse than useless.
 *
 * A LIST result (name, symbol, or a creator with several launches) is a set,
 * so it behaves like browsing: the generation filter, the status filter and
 * the sort order all apply, and it paginates at the same page size.
 */
type SearchOutcome =
  | { kind: "identity"; rows: ExploreLaunch[]; describe: string }
  | { kind: "list"; candidates: Candidate[]; describe: string }
  | { kind: "ambiguous"; launchId: number; candidates: ExploreLaunch[] }
  | { kind: "empty"; describe: string }
  | { kind: "hint"; message: string }
  | { kind: "failed" };

interface BrowseState {
  key: string;
  rows: ExploreLaunch[];
  failed: boolean;
}

export function ExploreBrowser({ manifest, headBlock, validationDate, explorerBase }: Props) {
  const [generation, setGeneration] = useState<GenerationView>("all");
  const [status, setStatus] = useState<StatusView>("any");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [page, setPage] = useState(0);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const [searchPage, setSearchPage] = useState(0);
  const [browse, setBrowse] = useState<BrowseState | null>(null);
  const [search, setSearch] = useState<{ q: string; outcome: SearchOutcome } | null>(null);
  const [searchRows, setSearchRows] = useState<{ key: string; rows: ExploreLaunch[] } | null>(null);

  const view = viewKey(generation, status);
  const stats = manifest.views[view] ?? { total: 0, pages: 0, firstPageRows: 0 };
  const searching = query.length > 0;
  const browseKey = `${view}|${page}|${sort}`;

  /**
   * Browse rows are only ever read through this gate.
   *
   * `browse` holds whatever the last completed fetch produced, which belongs to
   * whichever view was selected at the time. Reading it without checking its
   * key would render the previous view's rows whenever the current one has not
   * been fetched: during a filter change, and permanently for a view whose
   * total is zero, since that one never fetches at all. The counter would read
   * "0 of 0" above a full table of rows matching neither filter.
   *
   * null means "nothing valid to show for the current key", which is the same
   * answer for a pending fetch and for an empty view. The difference between
   * those two is `stats.pages`, and only the loading flag below cares.
   */
  const browseRows = browse?.key === browseKey ? browse.rows : null;

  // Loading is derived, never assigned from inside an effect.
  const browseLoading = !searching && stats.pages > 0 && browseRows === null;
  const searchLoading = searching && search?.q !== query;
  const baseLoading = browseLoading || searchLoading;

  /** Resolve {generation, launchId} pointers to full rows via the id index. */
  const resolveIds = useCallback(
    async (pointers: Array<[number, number]>): Promise<ExploreLaunch[]> => {
      const size = manifest.indexes.idBucketSize;
      const out: ExploreLaunch[] = [];
      const wanted = new Map<string, number[]>();
      for (const [g, id] of pointers) {
        const gen = GENERATION_IDS[g];
        if (!gen) continue;
        const bucket = `${gen}/${Math.floor(id / size)}`;
        if (!wanted.has(bucket)) wanted.set(bucket, []);
        wanted.get(bucket)!.push(id);
      }
      for (const [bucket, ids] of wanted) {
        const data = await getJson<Record<string, ExploreRow>>(`/explore/id/${bucket}.json`);
        if (!data) continue;
        for (const id of ids) {
          const row = data[String(id)];
          if (row) out.push(decodeRow(row));
        }
      }
      // Deliberately unsorted: every caller imposes its own order, and a
      // hidden sort here would silently override the chosen sort control.
      return out;
    },
    [manifest.indexes.idBucketSize]
  );

  // ---- Browse. State is only written inside the async continuation. -------
  useEffect(() => {
    if (searching || stats.pages === 0) return;
    let cancelled = false;
    const ascIndex = sort === "newest" ? stats.pages - 1 - page : page;
    getJson<ExplorePage>(`/explore/pages/${view}/${ascIndex}.json`)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setBrowse({ key: browseKey, rows: [], failed: true });
          return;
        }
        const decoded = data.rows.map(decodeRow);
        setBrowse({
          key: browseKey,
          rows: sort === "newest" ? decoded.reverse() : decoded,
          failed: false,
        });
      })
      .catch(() => {
        if (!cancelled) setBrowse({ key: browseKey, rows: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [browseKey, view, page, sort, stats.pages, searching]);

  /** Pure async resolver. Returns an outcome; never touches state itself. */
  const resolveSearch = useCallback(
    async (raw: string): Promise<SearchOutcome> => {
      const q = raw.trim();
      try {
        // 1. Canonical identity: generation:launchId
        //
        // The id accepts thousands separators because the table prints them
        // that way, so a launch id copied off a row pastes straight back in.
        // The generation half stays strict: only an explicit generation, or a
        // gen1/gen2/gen3 alias, ever names a launch.
        const keyed = /^(retired|legacy|current)\s*[:/]\s*(\d[\d,]*)$/i.exec(q);
        const alias = /^gen\s*([123])\s*[:/]\s*(\d[\d,]*)$/i.exec(q);
        if (keyed || alias) {
          const gen = keyed
            ? (keyed[1]!.toLowerCase() as ExploreGenerationId)
            : GENERATION_IDS[Number(alias![1]) - 1]!;
          const id = Number((keyed ?? alias)![2]!.replace(/,/g, ""));
          const found = await resolveIds([[GENERATION_IDS.indexOf(gen), id]]);
          // Direct identity lookup: exempt from the browse filters.
          return found.length
            ? { kind: "identity", rows: found, describe: `${gen}:${id}` }
            : { kind: "empty", describe: `${gen}:${id}` };
        }

        // 2. Address. Token and creator are both checked, and both reported.
        const addr = /^0x?([0-9a-fA-F]{40})$/.exec(q);
        if (addr) {
          const hex = addr[1]!.toLowerCase();
          const bucket = hex.slice(0, 2);
          const [tokens, creators] = await Promise.all([
            getJson<Record<string, [number, number]>>(`/explore/addr/token/${bucket}.json`),
            getJson<Record<string, Array<[number, number]>>>(
              `/explore/addr/creator/${bucket}.json`
            ),
          ]);
          const asToken = tokens?.[hex];
          const asCreator = creators?.[hex];
          if (!asToken && !asCreator) return { kind: "empty", describe: `address 0x${hex}` };

          // An exact token address names exactly one launch, so it is an
          // identity lookup and ignores the filters. A creator can own many,
          // so that set is filtered and sorted like any other list.
          if (asToken && !asCreator) {
            const found = await resolveIds([asToken]);
            return found.length
              ? { kind: "identity", rows: found, describe: `token 0x${hex}` }
              : { kind: "empty", describe: `address 0x${hex}` };
          }
          const pointers: Array<[number, number]> = [];
          if (asToken) pointers.push(asToken);
          if (asCreator) pointers.push(...asCreator);
          const rows = await resolveIds(pointers);
          if (!rows.length) return { kind: "empty", describe: `address 0x${hex}` };
          if (rows.length === 1) {
            const role = asToken ? "token" : "creator";
            return { kind: "identity", rows, describe: `${role} 0x${hex}` };
          }
          const role = asToken ? "token and creator" : "creator";
          return {
            kind: "list",
            describe: `${role} 0x${hex}`,
            candidates: rows.map((r) => ({
              generation: GENERATION_IDS.indexOf(r.generation) as 0 | 1 | 2,
              launchId: r.launchId,
              status: r.status,
              deploymentBlock: r.deploymentBlock,
            })),
          };
        }

        // 3. A bare integer is NOT a launch identity. Offer the candidates.
        if (/^\d[\d,]*$/.test(q)) {
          const id = Number(q.replace(/,/g, ""));
          const candidates = await resolveIds(
            GENERATION_IDS.map((_, g) => [g, id] as [number, number])
          );
          return { kind: "ambiguous", launchId: id, candidates };
        }

        // 4. Name or symbol, prefix match on any word.
        const norm = q.toLowerCase().replace(/[^a-z0-9]+/g, "");
        const min = manifest.indexes.nameSearchMinChars;
        if (norm.length < min) {
          return {
            kind: "hint",
            message: `Type at least ${min} characters to search names and symbols.`,
          };
        }
        const entries = await getJson<NameEntry[]>(`/explore/name/${norm.slice(0, 2)}.json`);
        // Every match is kept as a candidate. Nothing is truncated: the set is
        // filtered, sorted and paginated below, and only the visible page is
        // resolved to full rows.
        const matches = (entries ?? []).filter(([name, symbol]) =>
          `${name ?? ""} ${symbol ?? ""}`
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .some((w) => w.startsWith(norm))
        );
        if (!matches.length) return { kind: "empty", describe: `"${q}"` };
        return {
          kind: "list",
          describe: `"${q}"`,
          candidates: matches.map(([, , g, id, status, block]) => ({
            generation: g,
            launchId: id,
            status,
            deploymentBlock: block,
          })),
        };
      } catch {
        return { kind: "failed" };
      }
    },
    [manifest.indexes.nameSearchMinChars, resolveIds]
  );

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    resolveSearch(query).then((outcome) => {
      if (!cancelled) setSearch({ q: query, outcome });
    });
    return () => {
      cancelled = true;
    };
  }, [query, resolveSearch]);

  const outcome = searching && search?.q === query ? search.outcome : null;

  /**
   * A list result behaves like browsing: the same generation filter, status
   * filter and sort order apply. Filtering runs over candidates, which carry
   * status and block, so narrowing a result set fetches nothing. Only the
   * visible page is then resolved to full rows.
   */
  const listCandidates = useMemo(() => {
    if (outcome?.kind !== "list") return null;
    const genCode = generation === "all" ? null : GENERATION_IDS.indexOf(generation);
    const statusCode = STATUS_FILTER_CODE[status];
    const kept = outcome.candidates.filter(
      (c) =>
        (genCode === null || c.generation === genCode) &&
        (statusCode === null || c.status === statusCode)
    );
    const dir = sort === "newest" ? -1 : 1;
    return kept.sort(
      (a, b) =>
        dir * (a.deploymentBlock - b.deploymentBlock) ||
        dir * (a.generation - b.generation) ||
        dir * (a.launchId - b.launchId)
    );
  }, [outcome, generation, status, sort]);

  const searchTotal = listCandidates?.length ?? 0;
  const searchPages = Math.ceil(searchTotal / manifest.pageSize);
  const searchSlice = useMemo(
    () =>
      listCandidates?.slice(
        searchPage * manifest.pageSize,
        searchPage * manifest.pageSize + manifest.pageSize
      ) ?? [],
    [listCandidates, searchPage, manifest.pageSize]
  );
  const sliceKey = `${query}|${generation}|${status}|${sort}|${searchPage}`;

  // Resolve only the visible page of a list result.
  useEffect(() => {
    if (searchSlice.length === 0) return;
    let cancelled = false;
    resolveIds(searchSlice.map((c) => [c.generation, c.launchId] as [number, number]))
      .then((rows) => {
        if (cancelled) return;
        const byKey = new Map(rows.map((r) => [r.key, r]));
        const ordered = searchSlice
          .map((c) => byKey.get(`${GENERATION_IDS[c.generation]}:${c.launchId}`))
          .filter((r): r is ExploreLaunch => Boolean(r));
        setSearchRows({ key: sliceKey, rows: ordered });
      })
      .catch(() => {
        if (!cancelled) setSearchRows({ key: sliceKey, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [sliceKey, searchSlice, resolveIds]);

  const sliceLoading = searchSlice.length > 0 && searchRows?.key !== sliceKey;
  const loading = baseLoading || sliceLoading;

  const shown = searching
    ? outcome?.kind === "identity"
      ? outcome.rows
      : outcome?.kind === "list"
        ? searchRows?.key === sliceKey
          ? searchRows.rows
          : []
        : []
    : (browseRows ?? []);
  const failed = searching
    ? outcome?.kind === "failed"
    : browse?.key === browseKey && browse.failed;

  /** Any filter change invalidates the page number, so reset it here. */
  function changeFilter(fn: () => void) {
    fn();
    setPage(0);
    setSearchPage(0);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSearchPage(0);
    setQuery(input.trim());
  }

  function clearSearch() {
    setInput("");
    setQuery("");
    setSearchPage(0);
  }

  /**
   * Browse offsets differ by sort order, because the remainder lives in
   * ascending page 0. Newest-first shows that short page last, so a flat
   * page*size works; oldest-first shows it first, and every later page is
   * offset by it. Search pages are uniform, so they need no such correction.
   */
  const isList = outcome?.kind === "list";
  const total = searching ? (isList ? searchTotal : shown.length) : stats.total;
  const rowsOnPage = searching
    ? shown.length
    : (browseRows?.length || manifest.pageSize);
  const from =
    total === 0
      ? 0
      : searching
        ? isList
          ? searchPage * manifest.pageSize + 1
          : 1
        : sort === "oldest"
          ? page === 0
            ? 1
            : stats.firstPageRows + (page - 1) * manifest.pageSize + 1
          : page * manifest.pageSize + 1;
  /*
   * With no rows there is no range to state. Computing it anyway gave
   * `from + 0 - 1`, which rendered as "0--1" for a search whose filters
   * removed every match. `to` now collapses to zero in that case and can
   * never fall below `from`, so no render path can produce a negative or
   * backwards range. The zero-result summary states a count, not a range.
   */
  const to =
    total === 0 ? 0 : Math.max(from, Math.min(total, from + rowsOnPage - 1));

  /** One pager drives both modes so the controls behave identically. */
  const pager = searching
    ? isList && searchPages > 1
      ? { page: searchPage, pages: searchPages, go: setSearchPage }
      : null
    : stats.pages > 1
      ? { page, pages: stats.pages, go: setPage }
      : null;

  /** True when the browse filters actually narrowed a search result. */
  const filtersNarrowedSearch =
    isList && outcome.candidates.length !== searchTotal
      ? outcome.candidates.length
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-4 border border-line bg-surface px-5 py-5">
        <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
          <label htmlFor="explore-search" className="sr-only">
            Search by token address, creator address, generation and launch id, name, or symbol
          </label>
          <input
            id="explore-search"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Token or creator address, generation:launchId, name, or symbol"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 border border-control bg-canvas px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-control-strong"
          />
          <button
            type="submit"
            className="cursor-pointer border border-control px-3 py-2 text-sm text-ink transition-colors hover:border-accent"
          >
            Search
          </button>
          {searching ? (
            <button
              type="button"
              onClick={clearSearch}
              className="cursor-pointer border border-control px-3 py-2 text-sm text-ink-muted transition-colors hover:border-control-strong hover:text-ink"
            >
              Clear
            </button>
          ) : null}
        </form>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Selector
            id="gen"
            label="Generation"
            value={generation}
            options={GENERATION_VIEWS.map((g) => [g, GENERATION_LABEL[g]] as const)}
            onChange={(v) => changeFilter(() => setGeneration(v as GenerationView))}
          />
          <Selector
            id="status"
            label="Status"
            value={status}
            options={STATUS_VIEWS.map((s) => [s, STATUS_FILTER_LABEL[s]] as const)}
            onChange={(v) => changeFilter(() => setStatus(v as StatusView))}
          />
          <Selector
            id="sort"
            label="Sort"
            value={sort}
            options={[
              ["newest", "Newest first"],
              ["oldest", "Oldest first"],
            ]}
            onChange={(v) => changeFilter(() => setSort(v as SortOrder))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        {/*
         * The single announced region. Every result change, whether from a
         * filter, a search or a page turn, lands here as one short sentence,
         * so a screen reader hears the new count once rather than hearing the
         * table read itself out. The page counter beside it is deliberately
         * not live: it would announce the same event a second time.
         */}
        <p role="status" aria-live="polite" className="text-sm text-ink-muted">
          {searching ? (
            outcome?.kind === "identity" ? (
              <>
                <span className="font-mono tabular-nums text-ink">
                  {formatCount(shown.length)}
                </span>{" "}
                {shown.length === 1 ? "launch" : "launches"} matching{" "}
                <span className="text-ink">{outcome.describe}</span>
                <span className="text-ink-faint"> (exact lookup, filters not applied)</span>
              </>
            ) : isList ? (
              /*
               * A search whose filters removed every match states a count
               * rather than a range. "Showing 0-0" is not wrong so much as
               * meaningless, and the range arithmetic behind it is what
               * produced "0--1".
               */
              searchTotal === 0 ? (
                <>
                  <span className="font-mono tabular-nums text-ink">0</span> launches matching{" "}
                  <span className="text-ink">{outcome.describe}</span>
                  {filtersNarrowedSearch !== null ? (
                    <span className="text-ink-faint">
                      {" "}
                      (filtered from {formatCount(filtersNarrowedSearch)})
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  Showing{" "}
                  <span className="font-mono tabular-nums text-ink">
                    {formatCount(from)}-{formatCount(to)}
                  </span>{" "}
                  of{" "}
                  <span className="font-mono tabular-nums text-ink">
                    {formatCount(searchTotal)}
                  </span>{" "}
                  matching <span className="text-ink">{outcome.describe}</span>
                  {filtersNarrowedSearch !== null ? (
                    <span className="text-ink-faint">
                      {" "}
                      (filtered from {formatCount(filtersNarrowedSearch)})
                    </span>
                  ) : null}
                </>
              )
            ) : (
              "Search results"
            )
          ) : (
            <>
              Showing{" "}
              <span className="font-mono tabular-nums text-ink">
                {formatCount(from)}-{formatCount(to)}
              </span>{" "}
              of{" "}
              <span className="font-mono tabular-nums text-ink">{formatCount(stats.total)}</span>{" "}
              launches
            </>
          )}
        </p>
        {pager ? (
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
            Page {formatCount(pager.page + 1)} of {formatCount(pager.pages)}
          </p>
        ) : null}
      </div>

      {/*
       * aria-busy marks the whole results region rather than the placeholder
       * inside it, so assistive tech knows the region is mid-update instead of
       * being told the results are now the word "Loading".
       */}
      <div aria-busy={loading}>
        {failed ? (
          <Notice>
            Could not load this slice of the snapshot. Reload the page and try again.
          </Notice>
        ) : loading ? (
          <Notice>Loading…</Notice>
        ) : outcome?.kind === "hint" ? (
          <Notice>{outcome.message}</Notice>
        ) : outcome?.kind === "ambiguous" ? (
          <AmbiguousLaunchId
            launchId={outcome.launchId}
            candidates={outcome.candidates}
            onPick={(k) => {
              setInput(k);
              setQuery(k);
            }}
          />
        ) : shown.length === 0 ? (
          <Notice>
            No launch matching{" "}
            <span className="text-ink">
              {outcome?.kind === "empty" ? outcome.describe : "those filters"}
            </span>{" "}
            is present in this snapshot. It covers launches indexed through block{" "}
            <span className="font-mono tabular-nums text-ink">{formatBlock(headBlock)}</span> on{" "}
            {validationDate}, so anything created after that block will not appear here.
          </Notice>
        ) : (
          <ResultsTable rows={shown} explorerBase={explorerBase} />
        )}
      </div>

      {pager && !loading && !failed ? (
        <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2">
          <PageButton disabled={pager.page === 0} onClick={() => pager.go(0)}>
            First
          </PageButton>
          <PageButton
            disabled={pager.page === 0}
            onClick={() => pager.go((p) => Math.max(0, p - 1))}
          >
            Previous
          </PageButton>
          <span className="px-2 font-mono text-xs tabular-nums text-ink-muted">
            {formatCount(pager.page + 1)} / {formatCount(pager.pages)}
          </span>
          <PageButton
            disabled={pager.page >= pager.pages - 1}
            onClick={() => pager.go((p) => Math.min(pager.pages - 1, p + 1))}
          >
            Next
          </PageButton>
          <PageButton
            disabled={pager.page >= pager.pages - 1}
            onClick={() => pager.go(pager.pages - 1)}
          >
            Last
          </PageButton>
        </nav>
      ) : null}
    </div>
  );
}

function Selector({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[10px] uppercase tracking-widest text-ink-faint"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 cursor-pointer border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-control-strong"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-line bg-surface px-5 py-6 text-sm leading-relaxed text-ink-muted">
      {children}
    </p>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer border border-control px-3 py-1.5 text-sm text-ink transition-colors hover:border-control-strong disabled:cursor-default disabled:border-line disabled:text-ink-faint disabled:hover:border-line"
    >
      {children}
    </button>
  );
}

function AmbiguousLaunchId({
  launchId,
  candidates,
  onPick,
}: {
  launchId: number;
  candidates: ExploreLaunch[];
  onPick: (key: string) => void;
}) {
  return (
    <div className="space-y-4 border border-line bg-surface px-5 py-5">
      <p className="text-sm leading-relaxed text-ink-muted">
        Launch ids are scoped to a factory generation, not global. Every generation numbers its
        launches from zero, so <span className="font-mono text-ink">{formatCount(launchId)}</span>{" "}
        on its own does not identify a launch. Pick a generation:
      </p>
      {candidates.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No generation in this snapshot has a launch with that id.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {candidates.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => onPick(c.key)}
                className="cursor-pointer border border-control px-3 py-1.5 font-mono text-sm text-ink transition-colors hover:border-accent"
              >
                {c.key}
                {c.symbol ? (
                  <>
                    <span className="sr-only">, symbol </span>
                    <span className="ml-2 text-ink-faint">{c.symbol}</span>
                  </>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Names and symbols are creator-controlled. They render as ordinary text
 * children so React escapes them; nothing linkifies them, and no request is
 * ever made from their contents.
 */
function ResultsTable({ rows, explorerBase }: { rows: ExploreLaunch[]; explorerBase: string }) {
  return (
    /*
     * The table is wider than a phone viewport, so this wrapper scrolls. A
     * scroll container that only responds to a pointer strands keyboard users:
     * at 360px the last three columns sit outside the viewport with no way to
     * reach them. Making it a focusable region puts it in the tab order, where
     * the arrow keys scroll it.
     */
    <div
      role="region"
      aria-label="Indexed launches, scrollable"
      tabIndex={0}
      className="overflow-x-auto border border-line"
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Indexed launches. Generation and launch id together form the launch identity.
        </caption>
        <thead>
          <tr className="border-b border-line bg-surface text-left">
            <Th>Generation</Th>
            <Th>Launch id</Th>
            <Th>Token</Th>
            <Th>Name / symbol</Th>
            <Th>Status</Th>
            <Th align="right">Block</Th>
            <Th>Date</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = r.status === null ? null : STATUS_CELL[r.status];
            return (
              <tr key={r.key} className="group border-b border-line last:border-b-0">
                <Td>
                  <span className="whitespace-nowrap text-ink-muted">{r.generation}</span>
                </Td>
                <Td>
                  <span className="font-mono tabular-nums text-ink">{formatCount(r.launchId)}</span>
                </Td>
                <Td>
                  <CellAddress
                    address={r.token}
                    href={addressUrl(explorerBase, r.token)}
                    label={`token address for ${r.key}`}
                  />
                </Td>
                <Td>
                  <span className="text-ink">{r.name ?? "not recorded"}</span>
                  {r.symbol ? (
                    <>
                      {/*
                       * Name and symbol are separated visually by margin
                       * alone, which flattens to "BUY BACKBB" when read
                       * aloud. This restores the boundary for assistive tech
                       * without putting a character on screen.
                       */}
                      <span className="sr-only">, symbol </span>
                      <span className="ml-2 font-mono text-xs text-ink-faint">{r.symbol}</span>
                    </>
                  ) : null}
                </Td>
                <Td>
                  {s ? (
                    <span className="whitespace-nowrap text-ink-muted" title={s.upstream}>
                      {s.label}
                    </span>
                  ) : (
                    <span className="text-ink-faint">Unknown</span>
                  )}
                </Td>
                <Td align="right">
                  <a
                    href={blockUrl(explorerBase, r.deploymentBlock)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono tabular-nums text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
                  >
                    {formatBlock(r.deploymentBlock)}
                  </a>
                </Td>
                <Td>
                  <span className="whitespace-nowrap font-mono text-xs text-ink-muted">
                    {r.launchTimestamp ? formatUtcDayMonthYear(r.launchTimestamp) : "not recorded"}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3 py-2.5 font-mono text-[10px] font-normal uppercase tracking-widest text-ink-faint ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <td className={`px-3 py-2.5 align-top ${align === "right" ? "text-right" : ""}`}>{children}</td>
  );
}

/** Compact address cell: truncated, linked, copyable without crowding the row. */
function CellAddress({ address, href, label }: { address: string; href: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be refused. The full value stays in the title and link.
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={address}
        className="font-mono text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
      >
        {truncateAddress(address, 8, 6)}
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy full ${label}`}
        className="cursor-pointer border border-control px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100"
      >
        {copied ? "ok" : "copy"}
      </button>
      {/* Same confirmation pattern as the Overview address control. */}
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
    </span>
  );
}
