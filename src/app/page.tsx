import { FactorySummary } from "@/components/factory-summary";
import { GenerationDistribution } from "@/components/generation-distribution";
import { LimitationsNote } from "@/components/limitations-note";
import { MetricTiles } from "@/components/metric-tiles";
import { ProvenancePanel } from "@/components/provenance-panel";
import { Section } from "@/components/section";
import { SnapshotBadge } from "@/components/snapshot-badge";
import { activeSnapshot } from "@/data";

export default function OverviewPage() {
  const { network } = activeSnapshot;

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Vibe/Vibe on {network.name}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
          An unofficial, community-built view into Vibe/Vibe activity on {network.name}.
        </p>

        <div className="mt-6">
          <SnapshotBadge />
        </div>
      </div>

      <div className="mt-12">
        <Section
          id="indexed-activity"
          title="Indexed activity"
          description="Launch and transaction activity reconstructed from full-history onchain data. Transactions are counted by distinct hash, so one transaction emitting several events counts once."
        >
          <MetricTiles />
        </Section>

        <Section
          id="generation-distribution"
          title="Launches by factory generation"
          description="Three factory generations have produced launches on this testnet, and they are not evenly sized."
        >
          <GenerationDistribution />
        </Section>

        <Section
          id="factory-generations"
          anchorId="factories"
          title="Factory generations"
          description="Each generation is a separate factory with its own launch id counter, so a launch is only identifiable by generation and id together. Their trading economics differ, which means a single platform-wide fee rate would be wrong."
        >
          <FactorySummary />
        </Section>

        <Section
          id="indexer-status"
          anchorId="methodology"
          title="Indexer status"
          description="Where the data came from and how fresh it is."
        >
          <ProvenancePanel />
        </Section>

        <Section
          id="limitations"
          title="What this does not cover"
          description="Worth reading before quoting any number on this page."
        >
          <LimitationsNote />
        </Section>
      </div>
    </main>
  );
}
