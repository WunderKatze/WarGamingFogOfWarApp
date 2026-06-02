import { Line } from "react-konva";
import type { TerrainWall } from "../../core/map/TerrainWall.js";
import { useGameContext } from "../hooks/useGameContext.js";

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
 *
 * Visual metadata comes from the active ruleset's terrain catalog
 * (`game.ruleset.terrain.walls[...]`). Renders nothing if the wall's
 * wallType isn't registered by the active ruleset.
 */
export function TerrainWallShape({ wall, pixelsPerInch, onHoverEnter, onHoverLeave }: Props) {
  const { game } = useGameContext();
  const entry = game.ruleset.terrain.walls[wall.wallType];
  if (!entry) return null;
  const { visual } = entry;
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
