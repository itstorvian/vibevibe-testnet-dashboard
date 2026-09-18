import { Field } from "@/components/field";
import { activeSnapshot } from "@/data";
import { blockUrl } from "@/lib/explorer";
import { formatBlock, formatCount, formatUtcDate, formatUtcDateTime } from "@/lib/format";

export function ProvenancePanel() {
  const { activity, network, run, source, verification } = activeSnapshot;

  return (
    <div className="border border-line bg-surface">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5 lg:grid-cols-4">
        <Field term="Environment">Testnet</Field>
        <Field term="Chain">{network.name}</Field>
        <Field term="Chain id">
          <span className="font-mono tabular-nums">{network.chainId}</span>
        </Field>
        <Field term="Access">Read only</Field>

        <Field term="Indexed through block">
          <a
            href={blockUrl(network.explorerBase, run.headBlock)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono tabular-nums underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent"
          >
            <span className="sr-only">Head block </span>
            {formatBlock(run.headBlock)}
          </a>
        </Field>
        <Field term="Validation date">{formatUtcDate(run.validationDate)}</Field>
        <Field term="Run finished">{formatUtcDateTime(run.finishedAt)}</Field>
        <Field term="Sanity checks">
          <span className="font-mono tabular-nums">
            {formatCount(run.sanityChecks.passed)} of {formatCount(run.sanityChecks.total)}
          </span>{" "}
          <span className="text-ink-muted">passed</span>
        </Field>

        <Field
          term="Launch reconstruction"
          detail="Scanned from the earliest factory deployment to the head block above, which is why launch counts are lifetime totals"
          wide
        >
          Full history
        </Field>
        <Field
          term="Curve reconstruction"
          detail="Trades, curve completions, graduations and creator-fee forwards were scanned over the same full range, which is what makes the transaction count a lifetime figure rather than a window's worth"
          wide
        >
          Full history
        </Field>
        <Field
          term="What counts as a transaction"
          detail={`Distinct transaction hashes across ${activity.includedEventSurfaces.join(
            ", "
          )}. A transaction that emits several of these counts once, which is why the three category figures beside the total do not add up to it. Post-graduation trading on Uniswap v4 is not indexed at all and is not included.`}
          wide
        >
          <span className="font-mono tabular-nums">
            {formatCount(activity.uniqueTransactionCount)}
          </span>{" "}
          <span className="text-ink-muted">
            unique tx hashes ({formatCount(activity.components.launch)} launch,{" "}
            {formatCount(activity.components.trade)} trade,{" "}
            {formatCount(activity.components.lifecycle)} lifecycle, minus{" "}
            {formatCount(activity.sharedAcrossCategories)} counted in more than one)
          </span>
        </Field>
        <Field
          term="Rpc endpoint"
          detail="Public endpoint, no key, read only"
          wide
        >
          <span className="font-mono break-all">{network.rpcEndpoint}</span>
        </Field>

        <Field term="Source" wide>
          <span className="text-ink">On-chain indexer, </span>
          <a
            href={source.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent"
          >
            {source.indexerName}
          </a>{" "}
          <span className="font-mono text-ink-muted">v{source.indexerVersion}</span>
        </Field>
        <Field
          term="Fee models verified"
          detail={verification.feeModels.evidence}
          wide
        >
          {formatUtcDate(verification.feeModels.date)}
        </Field>
        {/*
         * Graduation targets and the address book were established by the same
         * earlier run but are separate claims, and each carries its own
         * evidence string upstream. Collapsing them into one field meant the
         * address book's evidence was never shown at all.
         */}
        <Field
          term="Graduation targets verified"
          detail={verification.graduationTargets.evidence}
          wide
        >
          {formatUtcDate(verification.graduationTargets.date)}
        </Field>
        <Field term="Address book verified" detail={verification.addressBook.evidence} wide>
          {formatUtcDate(verification.addressBook.date)}
        </Field>
      </dl>

      <div className="space-y-3 border-t border-line px-5 py-4">
        <p className="text-sm leading-relaxed text-ink-muted">
          These figures come from an open source indexer that rebuilds every launch from chain
          logs, reading events straight from {network.name} rather than from any operator API.
          That is why the numbers on this page can be checked against the chain instead of
          taken on trust.
        </p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Nothing here is live. Everything on this page comes from that single run and stays
          fixed until a newer one is connected. It is a point in time observation of a chain
          that keeps moving, not a standing total, and nothing updates by itself. Re-running
          the indexer produces a newer snapshot to swap in.
        </p>
      </div>
    </div>
  );
}
