import { Line } from "react-konva";
import type { TerrainPolygon } from "../../core/map/TerrainPolygon.js";
import { polygonTerrainCatalog } from "../../core/map/terrainCatalog.js";

interface Props {
  polygon: TerrainPolygon;
  pixelsPerInch: number;
}

export function TerrainPolygonShape({ polygon, pixelsPerInch }: Props) {
  const { visual } = polygonTerrainCatalog[polygon.terrainType];
  const points = polygon.vertices.flatMap((v) => [
    v.x * pixelsPerInch,
    v.y * pixelsPerInch,
  ]);
  return (
    <Line
      points={points}
      closed
      fill={visual.fill}
      stroke={visual.stroke}
      strokeWidth={1}
      opacity={visual.opacity}
      listening={false}
    />
  );
}
