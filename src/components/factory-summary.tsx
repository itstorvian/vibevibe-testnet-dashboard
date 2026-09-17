import { Address } from "@/components/address";
import { Field } from "@/components/field";
import { activeSnapshot, blocksBehindHead } from "@/data";
import type { GenerationSummary } from "@/data/types";
import { addressUrl } from "@/lib/explorer";
import {
  formatBlock,
  formatBps,
  formatCount,
  formatFeeSplit,
  formatUtcDate,
} from "@/lib/format";

function GenerationPanel({ generation }: { generation: GenerationSummary }) {
  const { explorerBase } = activeSnapshot.network;
  const { headBlock } = activeSnapshot.run;
  const { graduationTarget: target, launchIdAudit: audit, feeModel: fee } = generation;

  /*
   * How far the generation's most recent launch sits below the run's head
   * block. This replaced a "Producing launches" badge, which was present tense
   * on a point-in-time snapshot, read as live, and was set on all three
   * generations anyway, so it distinguished nothing while implying the retired
   * factory was active. The gap is an observation rather than a claim, and it
   * separates a generation that launched 223 blocks ago from one that last
   * launched 130,596 blocks ago.
   */
  const behind = blocksBehindHead(generation, headBlock);

  return (
    <article className="border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3.5">
        <h3 className="text-sm font-semibold text-ink">{generation.displayName}</h3>
        <span className="border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {generation.label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          Last launch {formatCount(behind)} blocks below head
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5 lg:grid-cols-4">
        <Field term="Factory" wide>
          <Address
            address={generation.factory}
            href={addressUrl(explorerBase, generation.factory)}
            label={`${generation.displayName} factory address`}
          />
        </Field>

        <Field term="Deployed at block">
          <span className="font-mono tabular-nums">
            {formatBlock(generation.deploymentBlock)}
          </span>
        </Field>

        <Field term="Last launch seen">
          <span className="font-mono tabular-nums">
            {formatBlock(generation.lastObservedLaunchBlock)}
          </span>
        </Field>

        <Field term="Launches">
          <span className="font-mono tabular-nums">
            {formatCount(generation.launchCount)}
          </span>
        </Field>

        <Field
          term="Launch id range"
          detail={
            audit.dense && audit.duplicateIds === 0
              ? "Dense, no gaps, no duplicates"
              : `${formatCount(audit.duplicateIds)} duplicate ids`
          }
        >
          <span className="font-mono tabular-nums">
            {formatCount(audit.min)} to {formatCount(audit.max)}
          </span>
        </Field>

        {/*
         * Each economics field carries the date it was actually read. The two
         * were established by different runs, and undated side by side they
         * would both look as fresh as the snapshot badge at the top of the
         * page. One short sentence each, not a provenance panel per card.
         */}
        <Field
          term="Fee model"
          detail={`Split ${formatFeeSplit(
            fee.creatorShareOfFeeBps,
            fee.protocolShareOfFeeBps
          )} between creator and protocol. Read on chain ${formatUtcDate(fee.verifiedAt)}.`}
        >
          <span className="font-mono tabular-nums">{formatBps(fee.totalFeeBps)}</span>
        </Field>

        <Field
          term="Graduation target"
          detail={
            target.status === "not-verified"
              ? "Not read on chain, and deliberately not assumed from another generation"
              : target.verifiedAt
                ? `Read on chain ${formatUtcDate(target.verifiedAt)}, not re-read since.`
                : undefined
          }
        >
          {target.status === "verified-onchain" && target.display ? (
            <span className="font-mono tabular-nums">{target.display}</span>
          ) : (
            <span className="text-ink-muted">Not verified</span>
          )}
        </Field>
      </dl>

      <p className="border-t border-line px-5 py-4 text-sm leading-relaxed text-ink-muted">
        {generation.note}
      </p>
    </article>
  );
}

export function FactorySummary() {
  return (
    <div className="space-y-4">
      {activeSnapshot.generations.map((generation) => (
        <GenerationPanel key={generation.id} generation={generation} />
      ))}
    </div>
  );
}
