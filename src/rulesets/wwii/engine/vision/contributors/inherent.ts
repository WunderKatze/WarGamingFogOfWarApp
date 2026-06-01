import { getRules } from "../../../../../core/rules.js";
import type { Contributor } from "../../../../../core/vision/index.js";

/**
 * WWII's inherent-concealment contributor — currently only fires for
 * dug-in Infantry, but framed generically so other unit types could
 * contribute inherent concealment in the future without rewriting the
 * contributor.
 *
 * Delegates to `Unit.getInherentConcealmentModifier()` (which Infantry
 * overrides to return `dugInStealthModifier` when dug-in; the base
 * returns 1). Returns an empty array when the modifier is 1 (the unit
 * has no inherent concealment right now). Labels "dug in" when the
 * value matches the configured dugInStealthModifier — same label the
 * existing UI helper uses, so InfoMenu breakdowns stay readable.
 */
export const inherentContributor: Contributor = {
  id: "inherent",
  contribute(target) {
    const value = target.getInherentConcealmentModifier();
    if (value === 1) return [];
    return [
      {
        contributorId: "inherent",
        modifier: value,
        label: value === getRules().dugInStealthModifier ? "dug in" : "inherent",
      },
    ];
  },
};
