import type { UnitTypeEntry } from "../../../../core/ruleset/index.js";
import { Infantry } from "./Infantry.js";
import { Tank } from "./Tank.js";

/**
 * WWII unit-type registry. Each entry knows how to instantiate its
 * concrete Unit subclass from Game-resolved init params; engine-core
 * looks these up by id on `wwiiRuleset.unitTypes` and never imports
 * Infantry / Tank directly (closes the Phase B step 4a R3 violation).
 *
 * The Infantry entry forwards Game's optional `dugIn` hint into the
 * Infantry constructor (defaulting to false if not supplied). Tank
 * ignores the hint — Tanks don't dig in.
 */
export const wwiiUnitTypes: Record<string, UnitTypeEntry> = {
  Infantry: {
    id: "Infantry",
    displayName: "Infantry",
    construct: (p) => new Infantry({ ...p, dugIn: p.dugIn ?? false }),
  },
  Tank: {
    id: "Tank",
    displayName: "Tank",
    construct: (p) => new Tank(p),
  },
};

export { Infantry } from "./Infantry.js";
export { Tank } from "./Tank.js";
