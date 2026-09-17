import { snapshot20260917head120753391 } from "@/data/snapshots/2026-09-17-120753391";
import type { IndexerSnapshot } from "@/data/types";

/**
 * The snapshot the interface renders.
 *
 * Snapshots are named by date AND head block, because two validated runs can
 * land on the same day. Adopting a newer run means adding a file beside the
 * current one and repointing this export; Overview and Explore both read from
 * here, so they can never drift onto different runs.
 */
export const activeSnapshot: IndexerSnapshot = snapshot20260917head120753391;

export * from "@/data/derive";
export type * from "@/data/types";
