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

export type UnitType = "Infantry" | "Tank";

export type Modifier = "Recon";

export type WallType = "Short" | "Tall";

export type PolygonTerrainType = "Building" | "TallWoods" | "ShortTerrain";
