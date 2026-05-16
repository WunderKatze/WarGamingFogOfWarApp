import { GameMap } from "./GameMap.js";
import { TerrainPolygon, type TerrainPolygonInit } from "./TerrainPolygon.js";
import { TerrainWall, type TerrainWallInit } from "./TerrainWall.js";

/**
 * Plain-data shape of a map. Mirrors `GameMap`'s fields but holds them as
 * raw serializable values (no class instances), so it can be:
 *   - mutated freely in the editor's working draft,
 *   - serialized to / parsed from a JSON file,
 *   - converted to a full `GameMap` when a game is ready to use it.
 *
 * Polygons and walls are stored using the existing `*Init` types so the
 * field names match what the constructors accept.
 *
 * See `docs/features/map-editor.md` §7.2.
 */
export interface WorkingMap {
  width: number;
  height: number;
  polygons: TerrainPolygonInit[];
  walls: TerrainWallInit[];
}

/** Snapshot a live `GameMap` into a plain `WorkingMap`. Deep-copies arrays. */
export function fromGameMap(map: GameMap): WorkingMap {
  return {
    width: map.width,
    height: map.height,
    polygons: map.polygons.map((p) => ({
      id: p.id,
      terrainType: p.terrainType,
      vertices: p.vertices.map((v) => ({ x: v.x, y: v.y })),
    })),
    walls: map.walls.map((w) => ({
      id: w.id,
      from: { x: w.from.x, y: w.from.y },
      to: { x: w.to.x, y: w.to.y },
      wallType: w.wallType,
    })),
  };
}

/** Construct a `GameMap` from a `WorkingMap`. */
export function toGameMap(wm: WorkingMap): GameMap {
  return new GameMap({
    width: wm.width,
    height: wm.height,
    polygons: wm.polygons.map((p) => new TerrainPolygon(p)),
    walls: wm.walls.map((w) => new TerrainWall(w)),
  });
}

/** Empty WorkingMap with the given dimensions. */
export function emptyWorkingMap(width: number, height: number): WorkingMap {
  return { width, height, polygons: [], walls: [] };
}

/**
 * Serialize a WorkingMap to a JSON string suitable for writing to a file.
 * Pretty-printed (2-space indent) for human inspection.
 */
export function serializeWorkingMap(wm: WorkingMap): string {
  return JSON.stringify(wm, null, 2);
}

/**
 * Parse a JSON text into a WorkingMap. Returns null when the input is
 * malformed or missing required top-level fields (width, height,
 * polygons, walls). Per `map-editor.md` §3, unknown extra keys are
 * ignored — forward-compat with future schema additions like a backdrop
 * or version field.
 *
 * Deep validation of polygon vertex shapes and wall endpoints is
 * intentionally shallow: a malformed nested value will surface as an
 * error when the resulting GameMap is constructed, not here.
 */
export function parseWorkingMap(text: string): WorkingMap | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.width !== "number" || o.width <= 0) return null;
  if (typeof o.height !== "number" || o.height <= 0) return null;
  if (!Array.isArray(o.polygons)) return null;
  if (!Array.isArray(o.walls)) return null;
  return {
    width: o.width,
    height: o.height,
    polygons: o.polygons as TerrainPolygonInit[],
    walls: o.walls as TerrainWallInit[],
  };
}
