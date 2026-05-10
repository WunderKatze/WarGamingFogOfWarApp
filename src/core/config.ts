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
