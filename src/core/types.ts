export type UnitId = string;
export type TeamId = string;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Segment {
  readonly from: Point;
  readonly to: Point;
}

/**
 * Identifier of a registered unit type. The closed string union was
 * Phase A's shape (only WWII's "Infantry" and "Tank"); Phase B step 4a
 * opens this to any string because rulesets register their own unit
 * types via `Ruleset.unitTypes`. Validation that a given id is known
 * happens at lookup time (Game.buildUnit throws on unknown).
 */
export type UnitType = string;

export type UnitSize = "Squad" | "Platoon" | "Company" | "Battalion";

export type Modifier = "Recon";

export type WallType = "Short" | "Tall";

export type PolygonTerrainType = "Building" | "TallWoods" | "ShortTerrain";
