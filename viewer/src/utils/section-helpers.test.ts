import { describe, expect, it } from "vitest";
import { inferContextType } from "./section-helpers";

describe("inferContextType", () => {
  it("classifies null and empty as always", () => {
    expect(inferContextType(null)).toBe("always");
    expect(inferContextType("")).toBe("always");
    expect(inferContextType("   ")).toBe("always");
  });

  it("classifies bare %context as always", () => {
    expect(inferContextType("%context")).toBe("always");
    expect(inferContextType("  %context  ")).toBe("always");
  });

  it("classifies %context.where(...) as conditional", () => {
    expect(
      inferContextType("%context.where(%resource.item.where(linkId='x').answer.exists())")
    ).toBe("conditional");
  });

  it("classifies %resource.where(...) as conditional", () => {
    expect(
      inferContextType("%resource.where(item.where(linkId='x').answer.exists())")
    ).toBe("conditional");
  });

  it("classifies repeating-group path as repeating", () => {
    expect(
      inferContextType("%resource.item.where(linkId='medications').item.where(linkId='medication')")
    ).toBe("repeating");
  });

  it("classifies multi-answer .answer path as repeating", () => {
    expect(
      inferContextType("%resource.item.where(linkId='bloedverdunners').answer")
    ).toBe("repeating");
  });

  it("classifies repeat(item) path as repeating", () => {
    expect(
      inferContextType("%context.repeat(item).where(linkId='medications')")
    ).toBe("repeating");
  });

  it("classifies arbitrary custom expression as repeating", () => {
    expect(inferContextType("%resource.item.something.else")).toBe("repeating");
  });
});
