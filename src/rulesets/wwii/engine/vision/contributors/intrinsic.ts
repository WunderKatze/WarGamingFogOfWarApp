import type { Contributor } from "../../../../../core/vision/index.js";

/**
 * WWII's intrinsic-stealth contributor.
 *
 * Every unit has a base stealth multiplier (Infantry's 4/3, Tank's 1)
 * plus any always-on modifier multipliers (Recon's ×1 currently — but
 * could change per rule edit). `Unit.getIntrinsicStealth()` rolls these
 * into one number; this contributor surfaces it as a reading the WWII
 * composition rule recognizes by id and **always multiplies in**,
 * regardless of whether the target is concealed by terrain.
 *
 * Returns an empty array when the intrinsic value is exactly 1 (no
 * contribution) so the breakdown stays uncluttered for plain Tanks.
 */
export const intrinsicContributor: Contributor = {
  id: "intrinsic",
  contribute(target) {
    const value = target.getIntrinsicStealth();
    if (value === 1) return [];
    return [
      {
        contributorId: "intrinsic",
        modifier: value,
        label: "intrinsic",
      },
    ];
  },
};
