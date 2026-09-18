import { describe, it, expect } from "vitest";
import { parseGen, formatGen, formatGenFixed, GEN_UNIT } from "@/lib/genlayer/gen";

describe("parseGen", () => {
  it("parses whole GEN", () => {
    expect(parseGen("1")).toBe(GEN_UNIT);
  });

  it("parses fractional GEN", () => {
    expect(parseGen("1.5")).toBe(1_500_000_000_000_000_000n);
  });

  it("parses 2.5 GEN", () => {
    expect(parseGen("2.5")).toBe(2_500_000_000_000_000_000n);
  });

  it("parses small fraction", () => {
    expect(parseGen("0.001")).toBe(1_000_000_000_000_000n);
  });

  it("parses with trailing zeros", () => {
    expect(parseGen("10.000")).toBe(10_000_000_000_000_000_000n);
  });
});

describe("formatGen", () => {
  it("formats 1 GEN", () => {
    expect(formatGen(GEN_UNIT)).toBe("1");
  });

  it("formats fractional", () => {
    expect(formatGen(1_500_000_000_000_000_000n)).toBe("1.5");
  });

  it("formats zero", () => {
    expect(formatGen(0n)).toBe("0");
  });

  it("does not include trailing zeros", () => {
    const result = formatGen(2_000_000_000_000_000_000n);
    expect(result).toBe("2");
  });
});

describe("formatGenFixed", () => {
  it("formats with 4 decimal places", () => {
    const result = formatGenFixed(1_500_000_000_000_000_000n, 4);
    expect(result).toBe("1.5000");
  });
});
