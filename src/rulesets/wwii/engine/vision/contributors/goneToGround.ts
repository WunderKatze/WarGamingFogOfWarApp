import { getRules } from "../../../../../core/rules.js";
import type { Contributor } from "../../../../../core/vision/index.js";

/**
 * WWII's Gone-to-Ground contributor.
 *
 * GtG is a conditional stacker — it multiplies on top of any other
 * concealment but only when the target is *already concealed by
 * something else*. That conditionality is enforced by the WWII
 * composition rule, not here: this contributor just emits a reading
 * whenever the target's `goneToGround` flag is true, and the rule
 * decides whether to apply it based on what other contributors
 * returned.
 *
 * Splitting "emit" from "apply" lets the composition rule see the
 * full set of readings and reason about cross-source dependencies
 * cleanly; alternative designs that try to make the GtG contributor
 * decide-and-include-or-not entangle it with the rest of the pipeline.
 *
 * See [docs/features/v1/vision-rules-tweaks.md §2.3] for the rule's
 * "only stacks when concealed" origin.
 */
export const goneToGroundContributor: Contributor = {
  id: "gone-to-ground",
  contribute(target) {
    if (!target.goneToGround) return [];
    return [
      {
        contributorId: "gone-to-ground",
        modifier: getRules().goneToGroundStealthModifier,
        label: "GtG",
      },
    ];
  },
};
