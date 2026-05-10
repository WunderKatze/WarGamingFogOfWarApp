import { useState } from "react";
import { GameMap } from "../core/map/GameMap.js";
import { TerrainPolygon } from "../core/map/TerrainPolygon.js";
import { TerrainWall } from "../core/map/TerrainWall.js";
import type { TeamId } from "../core/types.js";
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
    new Tank({
      id: "t1", name: "M4 Co", teamId: "A",
      position: { x: 12, y: 8 }, size: "Company",
    }),
    new Infantry({
      id: "i1", name: "1st Pl", teamId: "A",
      position: { x: 18, y: 20 }, dugIn: true,
    }),
    new Tank({
      id: "t2", name: "Recon Sec", teamId: "A",
      position: { x: 8, y: 28 }, size: "Squad", modifiers: ["Recon"],
    }),
    new Tank({
      id: "t3", name: "Panther Bn", teamId: "B",
      position: { x: 84, y: 12 }, size: "Battalion",
    }),
    new Infantry({
      id: "i2", name: "Grenadier", teamId: "B",
      position: { x: 70, y: 38 },
    }),
    new Infantry({
      id: "i3", name: "Recon Sqd", teamId: "B",
      position: { x: 88, y: 50 }, size: "Squad", modifiers: ["Recon"],
    }),
  ];
}

export function App() {
  const [perspectiveTeamId, setPerspectiveTeamId] = useState<TeamId>("A");
  const map = buildDemoMap();
  const units = buildDemoUnits();

  const togglePerspective = () =>
    setPerspectiveTeamId((p) => (p === "A" ? "B" : "A"));

  return (
    <>
      <header
        style={{
          padding: "8px 16px",
          background: "#222",
          color: "#eee",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <strong>WarGaming Fog of War</strong>
        <span style={{ opacity: 0.7, fontSize: 13 }}>
          UI scaffold — drag to pan, scroll to zoom. Fog of war not yet applied.
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>
            Viewing as Team <strong>{perspectiveTeamId}</strong>
          </span>
          <button
            type="button"
            onClick={togglePerspective}
            style={{
              padding: "4px 10px",
              background: "#444",
              color: "#eee",
              border: "1px solid #666",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Flip perspective
          </button>
        </span>
      </header>
      <main style={{ flex: 1, minHeight: 0, background: "#f6f3ee" }}>
        <MapCanvas map={map} units={units} perspectiveTeamId={perspectiveTeamId} />
      </main>
    </>
  );
}
