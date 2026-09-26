import { snapshot20260926head124399779 } from "@/data/snapshots/2026-09-26-124399779";
import type { IndexerSnapshot } from "@/data/types";

/**
 * The snapshot the interface renders.
 *
 * Snapshots are named by date AND head block, because two validated runs can
 * land on the same day. Adopting a newer run means adding a file beside the
 * current one and repointing this export. Overview uses this run; Explore
 * retains its separately declared, fully enriched run in explore-source.ts.
 */
export const activeSnapshot: IndexerSnapshot = snapshot20260926head124399779;

export * from "@/data/derive";
export type * from "@/data/types";
