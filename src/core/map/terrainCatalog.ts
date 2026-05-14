import {
  polygonStealthModifier,
  shortWallStealthModifier,
  tallWoodsRayThroughLimit,
} from "../config.js";
import type { Point, PolygonTerrainType, WallType } from "../types.js";
import {
  segmentEdgeIntersectionCount,
  segmentIntersection,
  segmentLengthInsidePolygon,
} from "./geometry.js";
import type { TerrainPolygon } from "./TerrainPolygon.js";
import type { TerrainWall } from "./TerrainWall.js";

/**
 * Single source of truth for terrain. Each kind contributes one entry that
 * carries:
 *   - the display metadata the info menu reads (name, rule description),
 *   - the rendering metadata canvas shapes read (fill / stroke / etc),
 *   - and the geometric predicates the model layer uses for sight and
 *     concealment.
 *
 * Adding a new terrain kind means writing one new entry — no other file
 * needs to switch on its name. Numeric tuning values live in `config.ts`;
 * the catalog references them so balance changes still happen in one spot.
 *
 * The catalog is split into two halves (polygons, walls) because the
 * underlying geometric primitives differ: a polygon answers "ray length
 * inside" and "edge intersection count," a wall answers "segment
 * intersection." Each half is a flat `Record<…, Entry>` lookup.
 */

interface PolygonVisual {
  fill: string;
  stroke: string;
  opacity: number;
}

interface WallVisual {
  stroke: string;
  strokeWidth: number;
}

interface BasePolygonEntry {
  displayName: string;
  /** Stealth ×N applied if `appliesAsConcealment` returns true. 1 = no effect. */
  stealthMultiplier: number;
  /** Short, info-menu-ready sentence — keep it short (see info-menu §5 dec. 3). */
  ruleDescription: string;
  visual: PolygonVisual;
  /** Does this polygon contribute its stealthMultiplier given a ray from→to? */
  appliesAsConcealment(poly: TerrainPolygon, from: Point, to: Point): boolean;
  /** Does this polygon block sight along a ray from→to? */
  blocksRay(poly: TerrainPolygon, from: Point, to: Point): boolean;
}

interface BaseWallEntry {
  displayName: string;
  stealthMultiplier: number;
  ruleDescription: string;
  visual: WallVisual;
  appliesAsConcealment(wall: TerrainWall, from: Point, to: Point): boolean;
  blocksRay(wall: TerrainWall, from: Point, to: Point): boolean;
}

export type PolygonTerrainEntry = BasePolygonEntry & { kind: PolygonTerrainType };
export type WallTerrainEntry = BaseWallEntry & { kind: WallType };

export const polygonTerrainCatalog: Record<PolygonTerrainType, PolygonTerrainEntry> = {
  Building: {
    kind: "Building",
    displayName: "Building",
    stealthMultiplier: polygonStealthModifier.Building,
    ruleDescription: `Multiplies stealth ×${polygonStealthModifier.Building} for units inside.`,
    visual: { fill: "#9a9a9a", stroke: "#333", opacity: 0.7 },
    appliesAsConcealment(poly, _from, to) {
      return poly.containsPoint(to);
    },
    blocksRay(poly, from, to) {
      return segmentEdgeIntersectionCount(from, to, poly.vertices) >= 2;
    },
  },
  TallWoods: {
    kind: "TallWoods",
    displayName: "Tall Woods",
    stealthMultiplier: polygonStealthModifier.TallWoods,
    ruleDescription: `Multiplies stealth ×${polygonStealthModifier.TallWoods} when LOS passes through; blocks LOS past ${tallWoodsRayThroughLimit}″ inside.`,
    visual: { fill: "#2d5e2d", stroke: "#333", opacity: 0.7 },
    appliesAsConcealment(poly, from, to) {
      return segmentLengthInsidePolygon(from, to, poly.vertices) > 0;
    },
    blocksRay(poly, from, to) {
      return segmentLengthInsidePolygon(from, to, poly.vertices) > tallWoodsRayThroughLimit;
    },
  },
  ShortTerrain: {
    kind: "ShortTerrain",
    displayName: "Short Terrain",
    stealthMultiplier: polygonStealthModifier.ShortTerrain,
    ruleDescription: `Multiplies stealth ×${polygonStealthModifier.ShortTerrain} when LOS passes through.`,
    visual: { fill: "#a8c870", stroke: "#333", opacity: 0.7 },
    appliesAsConcealment(poly, from, to) {
      return segmentLengthInsidePolygon(from, to, poly.vertices) > 0;
    },
    blocksRay() {
      return false;
    },
  },
};

export const wallTerrainCatalog: Record<WallType, WallTerrainEntry> = {
  Short: {
    kind: "Short",
    displayName: "Short Wall",
    stealthMultiplier: shortWallStealthModifier,
    ruleDescription: `Multiplies stealth ×${shortWallStealthModifier} when LOS crosses it; doesn't block sight.`,
    visual: { stroke: "#777", strokeWidth: 3 },
    appliesAsConcealment(wall, from, to) {
      return segmentIntersection(from, to, wall.from, wall.to) !== null;
    },
    blocksRay() {
      return false;
    },
  },
  Tall: {
    kind: "Tall",
    displayName: "Tall Wall",
    // Tall walls block sight outright; they don't add a separate stealth
    // multiplier on top, so a multiplier of 1 (no effect) is correct.
    stealthMultiplier: 1,
    ruleDescription: "Blocks line of sight outright.",
    visual: { stroke: "#000", strokeWidth: 5 },
    appliesAsConcealment() {
      return false;
    },
    blocksRay(wall, from, to) {
      return segmentIntersection(from, to, wall.from, wall.to) !== null;
    },
  },
};
