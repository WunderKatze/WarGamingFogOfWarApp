import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef, useState } from "react";
import { Layer, Rect, Stage } from "react-konva";
import type { GameMap } from "../../core/map/GameMap.js";
import type { Point, TeamId, UnitId } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { theme } from "../theme.js";
import { ScaleIndicator } from "./ScaleIndicator.js";
import { TerrainPolygonShape } from "./TerrainPolygonShape.js";
import { TerrainWallShape } from "./TerrainWallShape.js";
import { UnitToken } from "./UnitToken.js";

const ZOOM_STEP = 1.1;
const MIN_SCALE = 0.25;
const MAX_SCALE = 6;

interface Props {
  map: GameMap;
  units: readonly Unit[];
  perspectiveTeamId: TeamId;
  selectedUnitId?: UnitId | undefined;
  firedUnitIds?: ReadonlySet<UnitId> | undefined;
  revealedUnitIds?: ReadonlySet<UnitId> | undefined;
  onUnitClick?: ((unit: Unit) => void) | undefined;
  /** Called with map-space (inch) position when the user clicks empty space or terrain. */
  onMapClick?: ((position: Point) => void) | undefined;
}

/**
 * Top-level Konva canvas. Three layers, painted bottom→top:
 *   - background: map rect + terrain polygons + walls
 *   - units: unit tokens
 *   - effects: reserved for future visual effects (range circles, animations…)
 *
 * Pan = drag the stage. Zoom = wheel (centered on cursor). Click on empty
 * space or terrain → onMapClick with map-inch coordinates. Click on a unit
 * → onUnitClick (terrain shapes have listening disabled so they pass clicks
 * through to the map background).
 */
export function MapCanvas({
  map,
  units,
  perspectiveTeamId,
  selectedUnitId,
  firedUnitIds,
  revealedUnitIds,
  onUnitClick,
  onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = scale;
    const worldPoint = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const proposed = direction > 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, proposed));
    setScale(newScale);
    setPosition({
      x: pointer.x - worldPoint.x * newScale,
      y: pointer.y - worldPoint.y * newScale,
    });
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!onMapClick) return;
    // Only fire when the click hit the map-background Rect — terrain has
    // listening disabled, so terrain clicks fall through to the background.
    if (e.target.name() !== "map-background") return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const stageX = (pointer.x - position.x) / scale;
    const stageY = (pointer.y - position.y) / scale;
    onMapClick({ x: stageX / theme.pixelsPerInch, y: stageY / theme.pixelsPerInch });
  };

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {size.width > 0 && (
        <>
          <Stage
            width={size.width}
            height={size.height}
            x={position.x}
            y={position.y}
            scaleX={scale}
            scaleY={scale}
            draggable
            onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
            onWheel={handleWheel}
            onClick={handleStageClick}
            onTap={handleStageClick}
          >
            <Layer listening>
              <Rect
                name="map-background"
                x={0}
                y={0}
                width={map.width * theme.pixelsPerInch}
                height={map.height * theme.pixelsPerInch}
                fill={theme.colors.mapBg}
                stroke={theme.colors.mapBorder}
                strokeWidth={1}
              />
              {map.polygons.map((p) => (
                <TerrainPolygonShape key={p.id} polygon={p} pixelsPerInch={theme.pixelsPerInch} />
              ))}
              {map.walls.map((w) => (
                <TerrainWallShape key={w.id} wall={w} pixelsPerInch={theme.pixelsPerInch} />
              ))}
            </Layer>
            <Layer listening>
              {units.map((u) => (
                <UnitToken
                  key={u.id}
                  unit={u}
                  pixelsPerInch={theme.pixelsPerInch}
                  perspectiveTeamId={perspectiveTeamId}
                  selected={u.id === selectedUnitId}
                  fired={firedUnitIds?.has(u.id) ?? false}
                  revealed={revealedUnitIds?.has(u.id) ?? false}
                  onClick={() => onUnitClick?.(u)}
                />
              ))}
            </Layer>
            {/* effects layer: reserved for future visual effects */}
            <Layer listening={false} />
          </Stage>
          <ScaleIndicator scale={scale} pixelsPerInch={theme.pixelsPerInch} />
        </>
      )}
    </div>
  );
}
