import type { TeamId, UnitSize, UnitType } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";

const ECHELON_CODE: Record<UnitSize, string> = {
  Squad: "B",
  Platoon: "D",
  Company: "E",
  Battalion: "F",
};

const FUNCTION_CODE: Record<UnitType, string> = {
  Infantry: "UCI",
  Tank: "UCA",
};

/**
 * Builds a NATO APP-6 / MIL-STD-2525B SIDC string for milsymbol.
 *
 * Layout (15 chars, 1-indexed):
 *   1  Scheme       — `S` (warfighting)
 *   2  Affiliation  — `F` (friend) or `H` (hostile) per perspective
 *   3  Dimension    — `G` (ground)
 *   4  Status       — `P` (present)
 *   5-10 Function   — `UCI---` (infantry) / `UCA---` (armor)
 *   11   Mobility   — `-`
 *   12   Echelon    — `B`/`D`/`E`/`F` from size
 *   13-15 Country/OB — `---`
 */
export function buildSidc(unit: Unit, perspectiveTeamId: TeamId): string {
  const affiliation = unit.teamId === perspectiveTeamId ? "F" : "H";
  return `S${affiliation}GP${FUNCTION_CODE[unit.type]}----${ECHELON_CODE[unit.size]}---`;
}
