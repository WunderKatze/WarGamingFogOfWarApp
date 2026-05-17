import type { Modifier, PolygonTerrainType, UnitType } from "./types.js";

export interface UnitTypeStats {
  baseVision: number;
  baseStealth: number;
}

export const unitTypeStats: Record<UnitType, UnitTypeStats> = {
  Infantry: { baseVision: 48, baseStealth: 4 / 3 },
  Tank: { baseVision: 48, baseStealth: 1 },
};

export interface ModifierEffects {
  visionMultiplier: number;
  stealthMultiplier: number;
}

export const modifierEffects: Record<Modifier, ModifierEffects> = {
  Recon: { visionMultiplier: 4 / 3, stealthMultiplier: 4 / 3 },
};

export const dugInStealthModifier = 2;

export const polygonStealthModifier: Record<PolygonTerrainType, number> = {
  Building: 3,
  TallWoods: 3,
  ShortTerrain: 2,
};

export const shortWallStealthModifier = 2;

export const tallWoodsRayThroughLimit = 4;

/**
 * For Tall Woods and Short Terrain only: the portion of a ray inside the
 * polygon must EXCEED this many inches before the polygon contributes its
 * stealth multiplier. Lets a unit hugging the inside of a treeline see out
 * at full vision while leaving the woods penalty in place for targets deeper
 * inside. See docs/features/vision-rules-tweaks.md §2.2.
 */
export const terrainEdgeGraceDistance = 2;

/**
 * Stealth multiplier applied on top of any other source when a unit is in
 * cover-providing terrain AND hasn't moved or fired during the previous
 * turn. Stacks multiplicatively with terrain / dug-in / etc. See
 * docs/features/vision-rules-tweaks.md §2.3.
 */
export const goneToGroundStealthModifier = 2;
