import {
  polygonTerrainCatalog,
  wallTerrainCatalog,
} from "../../../../../core/map/terrainCatalog.js";
import type {
  Contributor,
  ContributorReading,
} from "../../../../../core/vision/index.js";

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
 * Returns empty when there's no observer (position-only computations
 * can't ask about ray-direction-sensitive terrain — that's by design;
 * the caller should ask about specific polygons via the UI's existing
 * `getStealthAtPosition` helper instead).
 */
export const terrainContributor: Contributor = {
  id: "terrain",
  contribute(_target, position, map, observer) {
    if (!observer) return [];
    const observerPos = observer.getPosition();
    const readings: ContributorReading[] = [];

    for (const wall of map.walls) {
      const entry = wallTerrainCatalog[wall.wallType];
      if (entry.appliesAsConcealment(wall, observerPos, position)) {
        readings.push({
          contributorId: "terrain",
          modifier: entry.stealthMultiplier,
          label: entry.displayName,
        });
      }
    }

    for (const poly of map.polygons) {
      const entry = polygonTerrainCatalog[poly.terrainType];
      if (entry.appliesAsConcealment(poly, observerPos, position)) {
        readings.push({
          contributorId: "terrain",
          modifier: entry.stealthMultiplier,
          label: entry.displayName,
        });
      }
    }

    return readings;
  },
};
