import { Line } from "react-konva";
import type { TerrainPolygon } from "../../core/map/TerrainPolygon.js";
import { useGameContext } from "../hooks/useGameContext.js";

interface Props {
  polygon: TerrainPolygon;
  pixelsPerInch: number;
  onHoverEnter?: (() => void) | undefined;
  onHoverLeave?: (() => void) | undefined;
}

/**
 * Terrain polygon. Listens for mouse enter/leave so the info menu can react
 * — the shape's rendered geometry IS the hit zone, so no JS hit-testing is
 * needed. Clicks are not consumed: Konva fires the click event with
 * `e.target = this shape`, but the parent stage handler treats clicks on
 * named terrain targets the same as clicks on the map background.
 *
 * Visual metadata comes from the active ruleset's terrain catalog
 * (`game.ruleset.terrain.polygons[...]`). Renders nothing if the
 * polygon's terrainType isn't registered by the active ruleset —
 * shouldn't happen in normal play but degrades gracefully.
 */
export function TerrainPolygonShape({ polygon, pixelsPerInch, onHoverEnter, onHoverLeave }: Props) {
  const { game } = useGameContext();
  const entry = game.ruleset.terrain.polygons[polygon.terrainType];
  if (!entry) return null;
  const { visual } = entry;
  const points = polygon.vertices.flatMap((v) => [
    v.x * pixelsPerInch,
    v.y * pixelsPerInch,
  ]);
  const hoverHandlers = {
    ...(onHoverEnter && { onMouseEnter: () => onHoverEnter() }),
    ...(onHoverLeave && { onMouseLeave: () => onHoverLeave() }),
  };
  return (
    <Line
      name="terrain-polygon"
      points={points}
      closed
      fill={visual.fill}
      stroke={visual.stroke}
      strokeWidth={1}
      opacity={visual.opacity}
      {...hoverHandlers}
    />
  );
}
