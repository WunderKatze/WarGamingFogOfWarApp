import { GameMap } from "../core/map/GameMap.js";
import { TerrainPolygon } from "../core/map/TerrainPolygon.js";
import { TerrainWall } from "../core/map/TerrainWall.js";
import { Infantry } from "../core/units/Infantry.js";
import { Tank } from "../core/units/Tank.js";
import type { Unit } from "../core/units/Unit.js";
import { MapCanvas } from "./MapCanvas.js";

function buildDemoMap(): GameMap {
  return new GameMap({
    width: 96,
    height: 60,
    polygons: [
      new TerrainPolygon({
        id: "b1",
        terrainType: "Building",
        vertices: [
          { x: 30, y: 12 }, { x: 42, y: 12 }, { x: 42, y: 22 }, { x: 30, y: 22 },
        ],
      }),
      new TerrainPolygon({
        id: "tw1",
        terrainType: "TallWoods",
        vertices: [
          { x: 55, y: 30 }, { x: 75, y: 28 }, { x: 78, y: 45 }, { x: 60, y: 48 },
        ],
      }),
      new TerrainPolygon({
        id: "st1",
        terrainType: "ShortTerrain",
        vertices: [
          { x: 6, y: 38 }, { x: 28, y: 36 }, { x: 30, y: 52 }, { x: 8, y: 54 },
        ],
      }),
    ],
    walls: [
      new TerrainWall({
        id: "wt1",
        from: { x: 48, y: 4 }, to: { x: 48, y: 18 },
        wallType: "Tall",
      }),
      new TerrainWall({
        id: "ws1",
        from: { x: 14, y: 14 }, to: { x: 26, y: 14 },
        wallType: "Short",
      }),
    ],
  });
}

function buildDemoUnits(): Unit[] {
  return [
    new Tank({ id: "t1", name: "M4", teamId: "A", position: { x: 12, y: 8 } }),
    new Infantry({
      id: "i1", name: "1st Pl", teamId: "A",
      position: { x: 18, y: 20 }, dugIn: true,
    }),
    new Tank({
      id: "t2", name: "M4 Recon", teamId: "A",
      position: { x: 8, y: 28 }, modifiers: ["Recon"],
    }),
    new Tank({ id: "t3", name: "Panther", teamId: "B", position: { x: 84, y: 12 } }),
    new Infantry({
      id: "i2", name: "Grenadier", teamId: "B",
      position: { x: 70, y: 38 },
    }),
    new Infantry({
      id: "i3", name: "Recon Sqd", teamId: "B",
      position: { x: 88, y: 50 }, modifiers: ["Recon"],
    }),
  ];
}

export function App() {
  const map = buildDemoMap();
  const units = buildDemoUnits();

  return (
    <>
      <header style={{ padding: "8px 16px", background: "#222", color: "#eee" }}>
        <strong>WarGaming Fog of War</strong>
        <span style={{ marginLeft: 16, opacity: 0.7, fontSize: 13 }}>
          UI scaffold — drag to pan, scroll to zoom. Engine is live; fog of war is not yet applied.
        </span>
      </header>
      <main style={{ flex: 1, minHeight: 0, background: "#f6f3ee" }}>
        <MapCanvas map={map} units={units} />
      </main>
    </>
  );
}
