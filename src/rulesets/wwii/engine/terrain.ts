import { getRules } from "../../../core/rules.js";
import type { TerrainCatalog } from "../../../core/map/terrainCatalog.js";
import {
  blocksRayOnCrossing,
  blocksRayOnNEdgeCrossings,
  blocksRayPastDepthXInside,
  concealsAlongRayInsideSegment,
  concealsTargetInside,
  concealsWhenRayCrosses,
} from "../../../core/map/terrainPrimitives.js";

/**
 * The WWII 1/100 ruleset's terrain catalog.
 *
 * Phase B 2d follow-up: this used to live in src/core/map/terrainCatalog.ts
 * as a module-level const. Per [§13.1] R3 it moves into the WWII
 * bundle alongside the unit subclasses; engine-core consults it via
 * `ruleset.terrain` lookups.
 *
 * Entry behavior is unchanged — same primitives, same parameters,
 * same getters that read from the live rules singleton (so a runtime
 * rule edit takes effect on the next call). Visual + display
 * metadata follows V1's choices verbatim.
 */
export const wwiiTerrainCatalog: TerrainCatalog = {
  polygons: {
    Building: {
      kind: "Building",
      displayName: "Building",
      get stealthMultiplier() { return getRules().polygonStealthModifier.Building; },
      get ruleDescription() {
        return `Multiplies stealth ×${getRules().polygonStealthModifier.Building} for units inside; blocks LOS that crosses two edges.`;
      },
      visual: { fill: "#9a9a9a", stroke: "#333", opacity: 0.7 },
      appliesAsConcealment: concealsTargetInside,
      blocksRay: (poly, from, to) => blocksRayOnNEdgeCrossings(poly, from, to, 2),
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
      appliesAsConcealment: (poly, from, to) =>
        concealsAlongRayInsideSegment(poly, from, to, getRules().terrainEdgeGraceDistance),
      blocksRay: (poly, from, to) =>
        blocksRayPastDepthXInside(poly, from, to, getRules().tallWoodsRayThroughLimit),
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
      appliesAsConcealment: (poly, from, to) =>
        concealsAlongRayInsideSegment(poly, from, to, getRules().terrainEdgeGraceDistance),
      blocksRay: () => false,
    },
  },
  walls: {
    Short: {
      kind: "Short",
      displayName: "Short Wall",
      get stealthMultiplier() { return getRules().shortWallStealthModifier; },
      get ruleDescription() {
        return `Multiplies stealth ×${getRules().shortWallStealthModifier} when LOS crosses it; doesn't block sight.`;
      },
      visual: { stroke: "#777", strokeWidth: 3 },
      appliesAsConcealment: concealsWhenRayCrosses,
      blocksRay: () => false,
    },
    Tall: {
      kind: "Tall",
      displayName: "Tall Wall",
      // Tall walls block sight outright; they don't add a separate stealth
      // multiplier on top, so a multiplier of 1 (no effect) is correct.
      stealthMultiplier: 1,
      ruleDescription: "Blocks line of sight outright.",
      visual: { stroke: "#000", strokeWidth: 5 },
      appliesAsConcealment: () => false,
      blocksRay: blocksRayOnCrossing,
    },
  },
};
