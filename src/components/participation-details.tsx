import type { ParticipantSnapshot } from "@/data/participants";
import { formatBlock, formatCount, formatUtcDateTime } from "@/lib/format";

/** Every count is carried from the validated indexer artifact. */
export function ParticipationDetails({ participants: p }: { participants: ParticipantSnapshot }) {
  const breakdown = [
    ["Creator addresses", p.distinctCreatorAddressCount],
    ["Buyer/seller actor addresses", p.distinctBuyerSellerAddressCount],
    ["Buy recipient addresses", p.distinctBuyRecipientAddressCount],
    ["Trade participant addresses", p.distinctTradeParticipantAddressCount],
    ["Creator / buyer-seller overlap", p.creatorBuyerSellerOverlap],
    ["Creator / trade-participant overlap", p.creatorTradeParticipantOverlap],
    ["Multi-project actor addresses", p.multiProjectActorAddressCount],
    ["Multi-project participant addresses", p.multiProjectParticipantAddressCount],
    ["Recipient-only addresses", p.recipientOnlyAddressCount],
  ] as const;

  return (
    <div className="border border-line bg-surface">
      <div className="space-y-4 px-5 py-5">
        <p className="text-sm leading-relaxed text-ink-muted">
          Indexed actor addresses are distinct creator, buyer and seller addresses observed across
          indexed Vibe/Vibe launch and curve activity. Addresses are globally deduplicated across
          all configured projects and event roles.
        </p>
        <div>
          <h3 className="font-mono text-xs text-ink-muted">Indexed participant addresses</h3>
          <p className="mt-2 font-mono text-2xl tabular-nums text-ink">
            {formatCount(p.indexedParticipantAddressCount)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            The broader union also includes Bought.recipient. It can differ from Bought.buyer,
            so receiving tokens alone does not make an address an actor.
          </p>
        </div>
        <p className="text-sm leading-relaxed text-ink-muted">
          Addresses can represent people, contracts or intermediaries. Event roles are not
          necessarily transaction senders, and address counts do not measure people. Valid
          contract addresses remain included; no identity enrichment or EOA/contract
          classification is performed.
        </p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Cumulative for configured factories and their known curves from block{" "}
          <span className="font-mono tabular-nums">{formatBlock(p.sourceRunStartBlock)}</span>{" "}
          through <span className="font-mono tabular-nums">{formatBlock(p.sourceRunHeadBlock)}</span>.
          Lifecycle initiators cannot be measured from the current event data. Post-graduation
          DEX activity and unconfigured factories remain outside this scope.
        </p>
      </div>

      <details className="border-t border-line">
        <summary className="cursor-pointer px-5 py-4 text-sm text-ink underline decoration-line-strong underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Participation breakdown and methodology
        </summary>
        <div className="space-y-5 px-5 pb-5 [overflow-wrap:anywhere]">
          <p className="text-sm leading-relaxed text-ink-muted">
            Category totals overlap and must not be added to produce a global count.
            Multi-project means more than one distinct factory-scoped launch identity.
            Repeated events and roles within one project count as one project for an address.
            Actor project membership uses creator, buyer and seller roles; participant
            membership also includes buy recipients.
          </p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {breakdown.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="mt-1 font-mono text-lg tabular-nums text-ink">{formatCount(value)}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2 text-sm leading-relaxed text-ink-muted">
            <p>{p.definitions.actor}</p>
            <p>{p.definitions.participant}</p>
            <p>{p.normalization}</p>
            <p>{p.contractInclusionPolicy}</p>
            <p>
              Included actor roles: <span className="font-mono">{p.includedRoles.actors.join(", ")}</span>.
              Additional participant role:{" "}
              <span className="font-mono">{p.includedRoles.additionalParticipants.join(", ")}</span>.
            </p>
            <p>
              Excluded roles: <span className="font-mono">{p.excludedRoles.join(", ")}</span>.
              An address in an excluded role can still count if it independently appears in an
              included role.
            </p>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
            {[...p.exclusions, ...p.limitations].map((note) => <li key={note}>{note}</li>)}
          </ul>
          <p className="text-xs leading-relaxed text-ink-muted">
            Source run finished {formatUtcDateTime(p.sourceRun.finishedAt)}. Aggregate derived{" "}
            {formatUtcDateTime(p.derivedAt)} from the reconciled source data. The derivation date
            does not advance the source head. Full-history coverage and source counts passed
            validation, with {formatCount(p.integrity.unusableAddressValues)} unusable address
            values and {formatCount(p.integrity.unmappedTradeEvents)} unmapped trade events.
          </p>
        </div>
      </details>
    </div>
  );
}
