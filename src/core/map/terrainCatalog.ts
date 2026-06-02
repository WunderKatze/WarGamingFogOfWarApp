import type { Point, PolygonTerrainType, WallType } from "../types.js";
import type { TerrainPolygon } from "./TerrainPolygon.js";
import type { TerrainWall } from "./TerrainWall.js";

/**
 * Terrain catalog **interfaces** — the shape every ruleset's terrain
 * bundle conforms to. Concrete catalog entries (the WWII building /
 * tall-woods / etc.) live in their ruleset folder
 * (`src/rulesets/wwii/engine/terrain.ts`) per [§13.1] R3.
 *
 * Phase B 2d-follow-up: this file used to also export
 * polygonTerrainCatalog + wallTerrainCatalog as module-level constants;
 * those moved to the WWII bundle and are now reached via
 * `ruleset.terrain` so engine-core no longer imports WWII-specific
 * catalog data.
 *
 * Each entry carries:
 *   - display metadata the info menu reads (name, rule description),
 *   - rendering metadata canvas shapes read (fill / stroke / etc.),
 *   - geometric predicates the model layer uses for sight and
 *     concealment — assembled from named primitives in
 *     `terrainPrimitives.ts`, never inlined.
 *
 * Adding a new terrain kind to an existing ruleset means writing one
 * new entry in that ruleset's catalog — no engine-core edits, no
 * other-file switches. Numeric tuning values live in `rules.ts`; the
 * catalog reads them at call time so a runtime rule change takes
 * effect on the next read.
 */

export interface PolygonVisual {
  fill: string;
  stroke: string;
  opacity: number;
}

export interface WallVisual {
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
 * The slot on `Ruleset` that holds the ruleset's terrain bundle:
 * polygon entries keyed by `PolygonTerrainType`, wall entries keyed
 * by `WallType`. Engine-core consults this through
 * `ruleset.terrain[...]` lookups instead of importing a specific
 * ruleset's catalog file directly.
 *
 * `Partial<Record<...>>` because a ruleset can register a subset of
 * terrain kinds (the test ruleset registers none, for example).
 * Callers handle the undefined branch — typically "no entry → no
 * contribution / no block."
 */
export interface TerrainCatalog {
  readonly polygons: Partial<Record<PolygonTerrainType, PolygonTerrainEntry>>;
  readonly walls: Partial<Record<WallType, WallTerrainEntry>>;
}
