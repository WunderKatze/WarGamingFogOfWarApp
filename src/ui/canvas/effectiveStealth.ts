import type { GameMap } from "../../core/map/GameMap.js";
import { polygonTerrainCatalog } from "../../core/map/terrainCatalog.js";
import { getRules } from "../../core/rules.js";
import type { Point } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";

export interface StealthAtPosition {
  /** The single applied multiplier (1 means no modifier). */
  value: number;
  /** Human label of the modifier source (e.g. "Tall Woods", "dug in", "none"). */
  source: string;
}

export interface StealthAtPositionOptions {
  /**
   * Skip the unit's inherent modifier (i.e. Infantry dug-in). Used during a
   * move preview where the unit's would-be state is "just moved" — moving
   * clears dug-in (vision-rules-tweaks §2.1).
   */
  skipInherent?: boolean;
}

/**
 * Highest concealment multiplier applying to a stationary unit at `position`.
 * Pools the unit's inherent modifier (e.g. dug-in) with the area-terrain
 * modifiers of any polygon containing the position. Per VisionCalculator only
 * the single highest modifier is used — they don't stack.
 *
 * Walls aren't considered: their modifier is ray-based, not position-based.
 *
 * Shared by the InfoMenu's status row and the Discovery Visualizer overlay so
 * the two surfaces never disagree about a unit's effective stealth at a spot.
 */
export function getStealthAtPosition(
  unit: Unit,
  position: Point,
  map: GameMap,
  options: StealthAtPositionOptions = {},
): StealthAtPosition {
  const candidates: { mod: number; label: string }[] = [];

  if (!options.skipInherent) {
    const inherent = unit.getInherentConcealmentModifier();
    if (inherent > 1) {
      candidates.push({
        mod: inherent,
        label: inherent === getRules().dugInStealthModifier ? "dug in" : "inherent",
      });
    }
  }

  for (const poly of map.polygons) {
    if (!poly.containsPoint(position)) continue;
    const entry = polygonTerrainCatalog[poly.terrainType];
    candidates.push({ mod: entry.stealthMultiplier, label: entry.displayName });
  }

  if (candidates.length === 0) return { value: 1, source: "none" };
  let best = candidates[0]!;
  for (const c of candidates) if (c.mod > best.mod) best = c;
  return { value: best.mod, source: best.label };
}
