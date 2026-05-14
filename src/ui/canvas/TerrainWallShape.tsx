import { Line } from "react-konva";
import type { TerrainWall } from "../../core/map/TerrainWall.js";
import { wallTerrainCatalog } from "../../core/map/terrainCatalog.js";

interface Props {
  wall: TerrainWall;
  pixelsPerInch: number;
}

export function TerrainWallShape({ wall, pixelsPerInch }: Props) {
  const { visual } = wallTerrainCatalog[wall.wallType];
  return (
    <Line
      points={[
        wall.from.x * pixelsPerInch,
        wall.from.y * pixelsPerInch,
        wall.to.x * pixelsPerInch,
        wall.to.y * pixelsPerInch,
      ]}
      stroke={visual.stroke}
      strokeWidth={visual.strokeWidth}
      lineCap="round"
      listening={false}
    />
  );
}
