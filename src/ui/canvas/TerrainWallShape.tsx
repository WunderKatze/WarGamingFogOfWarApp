import { Line } from "react-konva";
import type { TerrainWall } from "../../core/map/TerrainWall.js";
import { wallTerrainCatalog } from "../../core/map/terrainCatalog.js";

interface Props {
  wall: TerrainWall;
  pixelsPerInch: number;
  onHoverEnter?: (() => void) | undefined;
  onHoverLeave?: (() => void) | undefined;
}

/**
 * Terrain wall. Same hover-listens-but-clicks-pass-through model as
 * TerrainPolygonShape: the rendered stroke is the hit zone, no JS
 * proximity test needed. Konva's hit-test on a stroked Line uses the
 * actual stroke width.
 */
export function TerrainWallShape({ wall, pixelsPerInch, onHoverEnter, onHoverLeave }: Props) {
  const { visual } = wallTerrainCatalog[wall.wallType];
  const hoverHandlers = {
    ...(onHoverEnter && { onMouseEnter: () => onHoverEnter() }),
    ...(onHoverLeave && { onMouseLeave: () => onHoverLeave() }),
  };
  return (
    <Line
      name="terrain-wall"
      points={[
        wall.from.x * pixelsPerInch,
        wall.from.y * pixelsPerInch,
        wall.to.x * pixelsPerInch,
        wall.to.y * pixelsPerInch,
      ]}
      stroke={visual.stroke}
      strokeWidth={visual.strokeWidth}
      lineCap="round"
      {...hoverHandlers}
    />
  );
}
