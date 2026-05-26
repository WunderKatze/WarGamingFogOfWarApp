import { getRules } from "../rules.js";
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
 * needs to switch on its name. Numeric tuning values live in `rules.ts`;
 * the catalog reads them at call time (via getters and inside predicates)
 * so a runtime rule change takes effect on the next read.
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

/**
 * Asymmetric edge-grace check for Tall Woods / Short Terrain. The grace
 * rewards an observer hugging the inside of the polygon trying to see OUT,
 * not an observer outside trying to see in or through. So:
 *   - observer outside the polygon → any non-zero inside-portion contributes
 *     concealment (a target inside the polygon is always concealed from
 *     outside; a sliver-through always contributes too).
 *   - observer inside the polygon → grace applies to the inside-portion;
 *     ≤ grace = no concealment (observer can see out / across cleanly).
 * See docs/features/v1/vision-rules-tweaks.md §2.2 "Asymmetric by design".
 */
function graceAsymmetricApplies(poly: TerrainPolygon, from: Point, to: Point): boolean {
  const insideLength = segmentLengthInsidePolygon(from, to, poly.vertices);
  if (insideLength === 0) return false;
  if (poly.containsPoint(from)) {
    return insideLength > getRules().terrainEdgeGraceDistance;
  }
  return true;
}

export const polygonTerrainCatalog: Record<PolygonTerrainType, PolygonTerrainEntry> = {
  Building: {
    kind: "Building",
    displayName: "Building",
    get stealthMultiplier() { return getRules().polygonStealthModifier.Building; },
    get ruleDescription() {
      return `Multiplies stealth ×${getRules().polygonStealthModifier.Building} for units inside; blocks LOS that crosses two edges.`;
    },
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
    get stealthMultiplier() { return getRules().polygonStealthModifier.TallWoods; },
    get ruleDescription() {
      const rules = getRules();
      return `Multiplies stealth ×${rules.polygonStealthModifier.TallWoods} for rays into / through the woods. Observer inside hugging the edge (≤${rules.terrainEdgeGraceDistance}″ deep) can see out at full vision. Blocks LOS past ${rules.tallWoodsRayThroughLimit}″ inside.`;
    },
    visual: { fill: "#2d5e2d", stroke: "#333", opacity: 0.7 },
    appliesAsConcealment: graceAsymmetricApplies,
    blocksRay(poly, from, to) {
      return segmentLengthInsidePolygon(from, to, poly.vertices) > getRules().tallWoodsRayThroughLimit;
    },
  },
  ShortTerrain: {
    kind: "ShortTerrain",
    displayName: "Short Terrain",
    get stealthMultiplier() { return getRules().polygonStealthModifier.ShortTerrain; },
    get ruleDescription() {
      const rules = getRules();
      return `Multiplies stealth ×${rules.polygonStealthModifier.ShortTerrain} for rays into / through it. Observer inside hugging the edge (≤${rules.terrainEdgeGraceDistance}″ deep) can see out at full vision.`;
    },
    visual: { fill: "#a8c870", stroke: "#333", opacity: 0.7 },
    appliesAsConcealment: graceAsymmetricApplies,
    blocksRay() {
      return false;
    },
  },
};

export const wallTerrainCatalog: Record<WallType, WallTerrainEntry> = {
  Short: {
    kind: "Short",
    displayName: "Short Wall",
    get stealthMultiplier() { return getRules().shortWallStealthModifier; },
    get ruleDescription() {
      return `Multiplies stealth ×${getRules().shortWallStealthModifier} when LOS crosses it; doesn't block sight.`;
    },
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
