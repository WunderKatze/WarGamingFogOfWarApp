import type { CompositionRule } from "./compositionRule.js";
import type { Contributor } from "./contributors/Contributor.js";

/**
 * The Axis 2 slot on `Ruleset`: a ruleset's vision pipeline
 * configuration. Phase B step 2 wires VisionCalculator to drive its
 * discover() and the new R4 read API from these two pieces; for now
 * they exist as the parallel data structure step 2 migrates to.
 *
 * `contributors` is the ordered list of contributors the pipeline
 * runs for every observation. Order is irrelevant for the canonical
 * composition rules (single-highest / sum / product) but UI breakdown
 * displays preserve it, so put "most important to the player" first.
 *
 * `compositionRule` pools the contributor readings into the
 * effective_stealth value the §4 formula consumes.
 */
export interface VisionConfig {
  readonly contributors: readonly Contributor[];
  readonly compositionRule: CompositionRule;
}
