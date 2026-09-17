import { activeSnapshot, generationById, totalLaunches } from "@/data";
import { formatBlock, formatCount } from "@/lib/format";

interface Tile {
  label: string;
  value: string;
  note: string;
  /**
   * The headline figure. Lifted one surface step and one type step above the
   * others, using tokens the rest of the page already uses. No new colour.
   */
  primary?: boolean;
}

export function MetricTiles() {
  const snapshot = activeSnapshot;
  const current = generationById(snapshot, "current");

  const tiles: Tile[] = [
    {
      label: "Total launches",
      value: formatCount(totalLaunches(snapshot)),
      note: "Full history across all three configured factories",
      primary: true,
    },
    {
      label: "Current generation",
      value: current ? formatCount(current.launchCount) : "Not available",
      note: current
        ? `Launches indexed from ${current.label}, the current factory generation.`
        : "No current generation in this snapshot",
    },
    {
      label: "Factory generations",
      value: formatCount(snapshot.coverage.factoriesConfigured),
      note: "Three factory generations currently tracked by the indexer.",
    },
    {
      label: "Indexed through block",
      value: formatBlock(snapshot.run.headBlock),
      note: "Head block at the time of the validation run",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={`px-5 py-5 ${tile.primary ? "bg-surface" : "bg-canvas"}`}
        >
          <p
            className={`font-mono text-[10px] uppercase tracking-widest ${
              tile.primary ? "text-ink-muted" : "text-ink-faint"
            }`}
          >
            {tile.label}
          </p>
          <p
            className={`mt-2.5 font-mono tracking-tight text-ink tabular-nums ${
              tile.primary ? "text-3xl" : "text-2xl"
            }`}
          >
            {tile.value}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">{tile.note}</p>
        </div>
      ))}
    </div>
  );
}
