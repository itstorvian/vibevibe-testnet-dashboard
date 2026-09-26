import { Field } from "@/components/field";
import { activeSnapshot } from "@/data";
import type { IndexerSnapshot } from "@/data/types";
import { blockUrl } from "@/lib/explorer";
import { formatBlock, formatCount, formatUtcDate, formatUtcDateTime } from "@/lib/format";

export function ProvenancePanel({ snapshot = activeSnapshot }: { snapshot?: IndexerSnapshot } = {}) {
  const { activity, network, participants, run, source, verification } = snapshot;
  const incremental = participants.validation.incremental;

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
        {participants.sourceRun.headBlockHash && (
          <Field term="Pinned head hash" detail="Canonical hash checked before and after the delta scan" wide>
            <span className="font-mono break-all">{participants.sourceRun.headBlockHash}</span>
          </Field>
        )}
        <Field term="Sanity checks">
          <span className="font-mono tabular-nums">
            {formatCount(run.sanityChecks.passed)} of {formatCount(run.sanityChecks.total)}
          </span>{" "}
          <span className="text-ink-muted">passed</span>
        </Field>

        <Field
          term="Launch reconstruction"
          detail="Complete event coverage from the earliest configured factory deployment through the head block above, including any reconciled historical prefix"
          wide
        >
          Full history
        </Field>
        <Field
          term="Curve reconstruction"
          detail="Trades, curve completions, graduations and creator-fee forwards cover the same complete range; the transaction count is globally deduplicated across that history"
          wide
        >
          Full history
        </Field>
        {incremental && (
          <Field
            term="Incremental coverage"
            detail={`The historical prefix through block ${formatBlock(incremental.prefixHeadBlock)} was preserved and reconciled. Only blocks ${formatBlock(incremental.deltaFromBlock)}–${formatBlock(incremental.deltaToBlock)} were scanned to advance this snapshot. The indexer re-derived global counts from the combined event history.`}
            wide
          >
            <span className="block">Preserved prefix + validated delta</span>
            <span className="mt-1 block break-all font-mono text-[11px] text-ink-muted">
              {incremental.proofFile} · SHA-256 {incremental.proofSha256}
            </span>
          </Field>
        )}
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
          Nothing here is live. Event counts are fixed at the head block shown above and stay
          fixed until a newer validated snapshot is connected. Fee models, graduation targets
          and address-book evidence retain their own verification dates. Advancing event
          history does not imply that this other metadata was read again.
        </p>
      </div>
    </div>
  );
}
