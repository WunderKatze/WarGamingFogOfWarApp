import type {
  Contributor,
  ContributorReading,
} from "../../../../../core/vision/index.js";
import { wwiiTerrainCatalog } from "../../terrain.js";

// Local destructure for readability — the contributor lives inside the
// WWII bundle so importing the WWII catalog directly is fine (no R3
// violation: rulesets may import from their own folder).
const { polygons: polygonTerrainCatalog, walls: wallTerrainCatalog } = wwiiTerrainCatalog;

/**
 * WWII's terrain contributor: emits a reading per applicable polygon
 * (Buildings, Tall Woods, Short Terrain) and per crossed wall (Short
 * Wall). Tall Walls block sight outright and don't contribute a
 * concealment reading — they're handled by the see() check upstream.
 *
 * This is the contributor that justifies the array-return shape on
 * `Contributor` — a single observation can hit multiple terrain
 * features, and each is a distinct source for the breakdown (the UI
 * needs to attribute a stealth modifier to the specific terrain that
 * created it). The WWII composition rule then pools these by
 * single-highest with the inherent reading.
 *
 * Two modes:
 *   - **Ray-based** (observer given) — used by `discover` and by UI
 *     calls that DO have an observer (e.g. Discovery Visualizer's
 *     incoming ring). Walls and ray-direction-sensitive polygon rules
 *     (asymmetric edge grace, Tall Woods depth limit) apply.
 *   - **Position-only** (no observer) — used by UI surfaces asking
 *     "what's this unit's stealth at this point?" without an
 *     observer in mind (InfoMenu's unit panel, Discovery Visualizer's
 *     outgoing ring). Returns readings for polygons containing the
 *     position; walls are ray-based and have nothing meaningful to
 *     contribute without a ray.
 */
export const terrainContributor: Contributor = {
  id: "terrain",
  contribute(_target, position, map, observer) {
    const readings: ContributorReading[] = [];

    if (observer) {
      const observerPos = observer.getPosition();
      for (const wall of map.walls) {
        const entry = wallTerrainCatalog[wall.wallType];
        if (entry && entry.appliesAsConcealment(wall, observerPos, position)) {
          readings.push({
            contributorId: "terrain",
            modifier: entry.stealthMultiplier,
            label: entry.displayName,
          });
        }
      }
      for (const poly of map.polygons) {
        const entry = polygonTerrainCatalog[poly.terrainType];
        if (entry && entry.appliesAsConcealment(poly, observerPos, position)) {
          readings.push({
            contributorId: "terrain",
            modifier: entry.stealthMultiplier,
            label: entry.displayName,
          });
        }
      }
      return readings;
    }

    // Position-only mode: containing polygons contribute their
    // stealthMultiplier; walls don't.
    for (const poly of map.polygons) {
      if (poly.containsPoint(position)) {
        const entry = polygonTerrainCatalog[poly.terrainType];
        if (entry) {
          readings.push({
            contributorId: "terrain",
            modifier: entry.stealthMultiplier,
            label: entry.displayName,
          });
        }
      }
    }
    return readings;
  },
};
