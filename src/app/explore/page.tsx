import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { ExploreBrowser } from "@/components/explore/explore-browser";
import { SnapshotBadge } from "@/components/snapshot-badge";
import { activeSnapshot } from "@/data";
import type { ExploreManifest } from "@/data/explore-types";
import { formatBlock, formatCount, formatUtcDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Explore launches",
  description:
    "Browse and search Vibe/Vibe launches indexed from Robinhood Chain testnet, scoped to a single validated run.",
};

/**
 * The manifest is read from disk at build time and handed to the client as
 * props, so the first paint already carries correct totals and page counts.
 * Every other shard is fetched on demand. The manifest is the sole authority
 * for pagination; nothing here hardcodes a count.
 */
function readManifest(): ExploreManifest {
  const p = path.join(process.cwd(), "public", "explore", "manifest.json");
  return JSON.parse(fs.readFileSync(p, "utf8")) as ExploreManifest;
}

export default function ExplorePage() {
  const manifest = readManifest();
  const { run, network } = activeSnapshot;

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Explore launches
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
          Every launch the indexer reconstructed from {network.name} chain logs, searchable by
          token address, creator, generation and launch id, or name. Nothing on this page is a
          ranking or a market view.
        </p>
        <div className="mt-6">
          <SnapshotBadge />
        </div>
      </div>

      <div className="mt-10">
        <ExploreBrowser
          manifest={manifest}
          headBlock={run.headBlock}
          validationDate={formatUtcDate(run.validationDate)}
          explorerBase={network.explorerBase}
        />
      </div>

      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-ink-muted">
        This view covers the{" "}
        <span className="font-mono tabular-nums text-ink">
          {formatCount(manifest.totals.all)}
        </span>{" "}
        launches indexed through block{" "}
        <span className="font-mono tabular-nums text-ink">{formatBlock(run.headBlock)}</span> on{" "}
        {formatUtcDate(run.validationDate)}. It is a point in time snapshot, so launches created
        after that block are not here. Names and symbols are chosen by whoever created the launch
        and are shown exactly as they appear on chain.
      </p>
    </main>
  );
}
