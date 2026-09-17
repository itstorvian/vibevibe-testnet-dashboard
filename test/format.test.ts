import { describe, expect, it } from "vitest";
import {
  formatBps,
  formatCount,
  formatFeeSplit,
  formatPercent,
  formatUtcDate,
  formatUtcDateTime,
  truncateAddress,
} from "@/lib/format";

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(96_398)).toBe("96,398");
    expect(formatCount(120_708_793)).toBe("120,708,793");
  });

  it("leaves short numbers alone", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(3)).toBe("3");
    expect(formatCount(999)).toBe("999");
  });
});

describe("formatPercent", () => {
  it("renders one decimal by default", () => {
    expect(formatPercent(40.0973)).toBe("40.1%");
  });
});

describe("fee formatting", () => {
  it("labels basis points", () => {
    expect(formatBps(125)).toBe("125 bps");
    expect(formatBps(100)).toBe("100 bps");
  });

  it("turns a basis point split into whole percentages", () => {
    expect(formatFeeSplit(7_500, 2_500)).toBe("75 / 25");
    expect(formatFeeSplit(5_000, 5_000)).toBe("50 / 50");
  });
});

describe("date formatting", () => {
  it("formats a date in UTC regardless of the host timezone", () => {
    expect(formatUtcDate("2026-09-17")).toBe("September 17, 2026");
  });

  it("formats an instant in UTC", () => {
    expect(formatUtcDateTime("2026-09-17T08:08:35.197Z")).toBe(
      "September 17, 2026 at 08:08 UTC"
    );
  });
});

describe("truncateAddress", () => {
  const address = "0x4FEbC267e0C24440bcDEF72B5DBC5FE7BED091dF";

  it("keeps the leading and trailing characters that identify an address", () => {
    expect(truncateAddress(address)).toBe("0x4FEbC267...BED091dF");
  });

  it("preserves case, because these are checksummed addresses", () => {
    expect(truncateAddress(address)).toContain("FEbC");
  });

  it("leaves a short string untouched", () => {
    expect(truncateAddress("0x1234")).toBe("0x1234");
  });
});
