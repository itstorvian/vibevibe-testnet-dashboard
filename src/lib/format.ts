/**
 * Formatting helpers.
 *
 * Deliberately not using Intl. Every value here renders on the server and the
 * numbers are the point of the page, so a deterministic formatter that cannot
 * vary with locale or ICU build is worth more than Intl's flexibility.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** 96398 -> "96,398" */
export function formatCount(value: number): string {
  return Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Block heights read as numbers, so they get separators too. */
export const formatBlock = formatCount;

/** 15.351... -> "15.4%" */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** 125 -> "125 bps" */
export function formatBps(bps: number): string {
  return `${formatCount(bps)} bps`;
}

/**
 * 7500, 2500 -> "75 / 25"
 *
 * Basis points of the total fee, shown as whole percentages because that is
 * how the split is usually discussed.
 */
export function formatFeeSplit(
  creatorShareBps: number,
  protocolShareBps: number
): string {
  return `${creatorShareBps / 100} / ${protocolShareBps / 100}`;
}

/** "2026-09-17" -> "September 17, 2026" */
export function formatUtcDate(iso: string): string {
  const date = new Date(iso);
  const month = MONTHS[date.getUTCMonth()];
  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** "2026-09-17T08:08:35.197Z" -> "September 17, 2026 at 08:08 UTC" */
export function formatUtcDateTime(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${formatUtcDate(iso)} at ${hours}:${minutes} UTC`;
}

/**
 * 0x4FEbC267e0C24440bcDEF72B5DBC5FE7BED091dF -> 0x4FEbC267...BED091dF
 *
 * The full value is always reachable: every truncated address in the interface
 * carries the complete string in its title and a copy control beside it.
 */
export function truncateAddress(address: string, lead = 10, tail = 8): string {
  if (address.length <= lead + tail + 3) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Unix seconds -> "17 Sep 2026", always UTC. */
export function formatUtcDayMonthYear(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const month = MONTHS_SHORT[d.getUTCMonth()];
  return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}
