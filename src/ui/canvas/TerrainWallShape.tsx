import { Line } from "react-konva";
import type { TerrainWall } from "../../core/map/TerrainWall.js";

interface Props {
  wall: TerrainWall;
  pixelsPerInch: number;
}

export function TerrainWallShape({ wall, pixelsPerInch }: Props) {
  const isTall = wall.wallType === "Tall";
  return (
    <Line
      points={[
        wall.from.x * pixelsPerInch,
        wall.from.y * pixelsPerInch,
        wall.to.x * pixelsPerInch,
        wall.to.y * pixelsPerInch,
      ]}
      stroke={isTall ? "#000" : "#777"}
      strokeWidth={isTall ? 5 : 3}
      lineCap="round"
      listening={false}
    />
  );
}
