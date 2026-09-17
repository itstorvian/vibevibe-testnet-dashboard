import { activeSnapshot } from "@/data";
import { formatUtcDate } from "@/lib/format";

export function LimitationsNote() {
  const { coverage, run, source } = activeSnapshot;

  const points = [
    {
      title: "Factory discovery is manual",
      body:
        "No on-chain registry of factories was found, so the indexer works from a hand maintained list. A factory missing from it is never scanned, and its launches would be absent here with no error or warning. Counts cover what the indexer saw, not the whole chain.",
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
      <ul className="grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-3">
        {points.map((point) => (
          <li key={point.title} className="bg-canvas px-5 py-5">
            <h3 className="text-sm font-medium text-ink">{point.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{point.body}</p>
          </li>
        ))}
      </ul>

      <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
        The run found{" "}
        <span className="font-mono tabular-nums text-ink">
          {coverage.unrecognizedCurveEventContracts}
        </span>{" "}
        unrecognized contracts emitting launch curve events. That is a weak hint that nothing
        is missing, not proof of it. A fuller writeup lives in{" "}
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
