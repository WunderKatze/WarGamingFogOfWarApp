import {
  polygonStealthModifier,
  shortWallStealthModifier,
  tallWoodsRayThroughLimit,
} from "../config.js";
import {
  segmentEdgeIntersectionCount,
  segmentIntersection,
  segmentLengthInsidePolygon,
} from "./geometry.js";
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
   * True if any sight-blocking rule interrupts a finite ray from `from` to `to`:
   *   - the ray crosses a Tall wall
   *   - the ray intersects ≥ 2 edges of any single Building polygon
   *   - the ray spends more than tallWoodsRayThroughLimit inches inside any TallWoods polygon
   */
  isRayBlocked(from: Point, to: Point): boolean {
    for (const wall of this.walls) {
      if (wall.wallType !== "Tall") continue;
      if (segmentIntersection(from, to, wall.from, wall.to) !== null) return true;
    }
    for (const poly of this.polygons) {
      if (poly.terrainType === "Building") {
        if (segmentEdgeIntersectionCount(from, to, poly.vertices) >= 2) return true;
      } else if (poly.terrainType === "TallWoods") {
        if (segmentLengthInsidePolygon(from, to, poly.vertices) > tallWoodsRayThroughLimit) return true;
      }
    }
    return false;
  }

  /**
   * Stealth modifiers from terrain that apply to a target along a ray.
   * Caller pools these with the target unit's getInherentConcealmentModifier()
   * and takes the single highest — modifiers do not stack.
   *
   * Building stealth applies only when the target is INSIDE the building.
   * Tall woods and short terrain apply when the ray passes through any portion of them.
   * Short walls apply when the ray crosses them. (Tall walls block instead.)
   */
  getConcealmentModifiersAlongRay(from: Point, targetPosition: Point): number[] {
    const mods: number[] = [];

    for (const wall of this.walls) {
      if (wall.wallType !== "Short") continue;
      if (segmentIntersection(from, targetPosition, wall.from, wall.to) !== null) {
        mods.push(shortWallStealthModifier);
      }
    }

    for (const poly of this.polygons) {
      if (poly.terrainType === "Building") {
        if (poly.containsPoint(targetPosition)) {
          mods.push(polygonStealthModifier.Building);
        }
      } else if (poly.terrainType === "TallWoods") {
        if (segmentLengthInsidePolygon(from, targetPosition, poly.vertices) > 0) {
          mods.push(polygonStealthModifier.TallWoods);
        }
      } else if (poly.terrainType === "ShortTerrain") {
        if (segmentLengthInsidePolygon(from, targetPosition, poly.vertices) > 0) {
          mods.push(polygonStealthModifier.ShortTerrain);
        }
      }
    }

    return mods;
  }
}
