import {
  polygonTerrainCatalog,
  wallTerrainCatalog,
} from "./terrainCatalog.js";
import type { TerrainPolygon } from "./TerrainPolygon.js";
import type { TerrainWall } from "./TerrainWall.js";
import type { Point } from "../types.js";

export interface MapBackdrop {
  /** Photo bytes, typically a base64 data URL embedded in the map file. */
  imageDataUrl: string;
  /** Calibration: how many inches one pixel of the backdrop represents. */
  inchesPerPixel: number;
}

export interface GameMapInit {
  width: number;
  height: number;
  polygons?: readonly TerrainPolygon[];
  walls?: readonly TerrainWall[];
  backdrop?: MapBackdrop;
}

export class GameMap {
  readonly width: number;
  readonly height: number;
  readonly polygons: readonly TerrainPolygon[];
  readonly walls: readonly TerrainWall[];
  readonly backdrop: MapBackdrop | undefined;

  constructor(init: GameMapInit) {
    if (init.width <= 0 || init.height <= 0) {
      throw new Error(
        `GameMap dimensions must be positive, got ${init.width}x${init.height}`,
      );
    }
    this.width = init.width;
    this.height = init.height;
    this.polygons = init.polygons ?? [];
    this.walls = init.walls ?? [];
    this.backdrop = init.backdrop;
  }

  /**
   * True if any terrain blocks the ray from `from` to `to`. Per-kind rules
   * (Tall walls, Buildings with ≥ 2 edge intersections, Tall Woods with > N″
   * inside) live in the terrain catalog — see `terrainCatalog.ts`.
   */
  isRayBlocked(from: Point, to: Point): boolean {
    for (const wall of this.walls) {
      if (wallTerrainCatalog[wall.wallType].blocksRay(wall, from, to)) return true;
    }
    for (const poly of this.polygons) {
      if (polygonTerrainCatalog[poly.terrainType].blocksRay(poly, from, to)) return true;
    }
    return false;
  }

  /**
   * Stealth modifiers from terrain that apply to a target along a ray.
   * Caller pools these with the target unit's getInherentConcealmentModifier()
   * and takes the single highest — modifiers do not stack. Per-kind rules
   * live in the terrain catalog.
   */
  getConcealmentModifiersAlongRay(from: Point, targetPosition: Point): number[] {
    const mods: number[] = [];
    for (const wall of this.walls) {
      const entry = wallTerrainCatalog[wall.wallType];
      if (entry.appliesAsConcealment(wall, from, targetPosition)) {
        mods.push(entry.stealthMultiplier);
      }
    }
    for (const poly of this.polygons) {
      const entry = polygonTerrainCatalog[poly.terrainType];
      if (entry.appliesAsConcealment(poly, from, targetPosition)) {
        mods.push(entry.stealthMultiplier);
      }
    }
    return mods;
  }
}
