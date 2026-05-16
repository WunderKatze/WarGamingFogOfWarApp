import { describe, expect, it } from "vitest";
import { nextCloneName } from "../../../src/ui/components/nextCloneName.js";

describe("nextCloneName", () => {
  it("appends ' 2' to a name with no trailing number", () => {
    expect(nextCloneName("Alpha", [])).toBe("Alpha 2");
  });

  it("increments a trailing space-separated number", () => {
    expect(nextCloneName("Alpha 2", [])).toBe("Alpha 3");
    expect(nextCloneName("M4 Tank Platoon 7", [])).toBe("M4 Tank Platoon 8");
  });

  it("increments a trailing hyphen-separated number, preserving the hyphen", () => {
    expect(nextCloneName("I-3", [])).toBe("I-4");
  });

  it("treats an internal number as part of the prefix when there's no trailing digit", () => {
    expect(nextCloneName("X-1A", [])).toBe("X-1A 2");
  });

  it("skips collisions by continuing to increment", () => {
    expect(nextCloneName("Alpha 2", ["Alpha 3", "Alpha 4"])).toBe("Alpha 5");
  });

  it("skips collisions when starting from a no-number base", () => {
    expect(nextCloneName("Bravo", ["Bravo 2", "Bravo 3"])).toBe("Bravo 4");
  });

  it("handles a name that is just digits as a number to increment", () => {
    // "42" has no separator; the regex requires one, so this falls through
    // to append-' 2'.
    expect(nextCloneName("42", [])).toBe("42 2");
  });

  it("preserves all whitespace in the prefix", () => {
    expect(nextCloneName("  Alpha  2", [])).toBe("  Alpha  3");
  });
});
