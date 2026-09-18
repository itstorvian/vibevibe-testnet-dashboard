import { activeSnapshot } from "@/data";
import { formatBlock, formatCount, formatUtcDate } from "@/lib/format";

export function LimitationsNote() {
  const { activity, coverage, run, source } = activeSnapshot;

  const points = [
    {
      title: "Factory discovery is manual",
      body:
        "No on-chain registry of factories was found, so the indexer works from a hand maintained list. A factory missing from it is never scanned, and its launches would be absent here with no error or warning. Counts cover what the indexer saw, not the whole chain.",
    },
    {
      title: "Transactions are indexed, not total",
      body:
        "The transaction figure counts distinct transaction hashes on the launch and curve event surfaces this indexer reads. It is not every Vibe/Vibe transaction, and nothing here could establish that it was. What falls outside it is listed below.",
    },
    {
      title: "This is one run, not a feed",
      body: `Every number comes from the validation run of ${formatUtcDate(
        run.validationDate
      )}. Launches were still being created as that run reached its head block, so the real totals are already higher.`,
    },
    {
      title: "Testnet research data",
      body:
        "Robinhood Chain testnet only. Values are test values and the testnet can reset. Community research, not an operator product.",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Two columns rather than three: four points at three across leaves an
          empty cell, and the grid's gap trick fills it with the line colour. */}
      <ul className="grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-2">
        {points.map((point) => (
          <li key={point.title} className="bg-canvas px-5 py-5">
            <h3 className="text-sm font-medium text-ink">{point.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{point.body}</p>
          </li>
        ))}
      </ul>

      <div className="max-w-3xl space-y-2">
        <p className="text-sm leading-relaxed text-ink-muted">
          What counts as a transaction:{" "}
          <span className="text-ink">
            {formatCount(activity.uniqueTransactionCount)} distinct transaction hashes
          </span>{" "}
          emitting{" "}
          <span className="font-mono text-ink-faint">
            {activity.includedEventSurfaces.join(", ")}
          </span>
          , from the earliest factory deployment through block{" "}
          <span className="font-mono tabular-nums text-ink">
            {formatBlock(run.headBlock)}
          </span>
          . A transaction that emits several of those events counts once, so the per
          category figures shown under Indexer status do not add up to the total. Not
          counted:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-muted">
          {activity.exclusions.map((exclusion) => (
            <li key={exclusion}>{exclusion}</li>
          ))}
        </ul>
      </div>

      <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
        Across full history the run saw{" "}
        <span className="font-mono tabular-nums text-ink">
          {formatCount(coverage.unrecognizedCurveEventLogs)}
        </span>{" "}
        log events carrying a curve event signature from contracts outside the configured
        factories, from at least{" "}
        <span className="font-mono tabular-nums text-ink">
          {formatCount(coverage.unrecognizedContractsSampled)}
        </span>{" "}
        distinct addresses
        {coverage.unrecognizedContractSampleIsCapped
          ? " (the indexer stops recording addresses at twenty, so that is a floor)"
          : ""}
        . A shared event signature is not evidence of a Vibe/Vibe deployment: an unrelated
        contract, a fork or another launchpad produces identical evidence, and the indexer
        cannot tell them apart. Every contract behind those logs was reviewed by hand after
        the run, not just the sampled ones: none matched a Vibe curve&apos;s bytecode, none
        answered the Vibe-specific curve functions, none named a known Vibe launch token, and
        a signature-wide search of the blocks where they were active found only the three
        configured factories launching tokens. That is a negative result for the range
        examined, not proof that no other factory exists. A fuller writeup lives in{" "}
        <span className="font-mono text-ink-faint">docs/known-limitations.md</span> in the{" "}
        <a
          href={source.repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
        >
          indexer repository
        </a>
        , and a Known Limitations section is planned here.
      </p>
    </div>
  );
}
