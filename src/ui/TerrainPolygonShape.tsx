import { Line } from "react-konva";
import type { TerrainPolygon } from "../core/map/TerrainPolygon.js";
import type { PolygonTerrainType } from "../core/types.js";

const TERRAIN_FILL: Record<PolygonTerrainType, string> = {
  Building: "#9a9a9a",
  TallWoods: "#2d5e2d",
  ShortTerrain: "#a8c870",
};

interface Props {
  polygon: TerrainPolygon;
  pixelsPerInch: number;
}

export function TerrainPolygonShape({ polygon, pixelsPerInch }: Props) {
  const points = polygon.vertices.flatMap((v) => [
    v.x * pixelsPerInch,
    v.y * pixelsPerInch,
  ]);
  return (
    <Line
      points={points}
      closed
      fill={TERRAIN_FILL[polygon.terrainType]}
      stroke="#333"
      strokeWidth={1}
      opacity={0.7}
    />
  );
}
