import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef, useState } from "react";
import { Layer, Rect, Stage } from "react-konva";
import type { GameMap } from "../core/map/GameMap.js";
import type { Unit } from "../core/units/Unit.js";
import { TerrainPolygonShape } from "./TerrainPolygonShape.js";
import { TerrainWallShape } from "./TerrainWallShape.js";
import { UnitToken } from "./UnitToken.js";

const PIXELS_PER_INCH = 8;
const ZOOM_STEP = 1.1;
const MIN_SCALE = 0.25;
const MAX_SCALE = 6;

interface Props {
  map: GameMap;
  units: readonly Unit[];
}

export function MapCanvas({ map, units }: Props) {
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

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      {size.width > 0 && (
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
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={map.width * PIXELS_PER_INCH}
              height={map.height * PIXELS_PER_INCH}
              fill="#fff"
              stroke="#444"
              strokeWidth={1}
            />
            {map.polygons.map((p) => (
              <TerrainPolygonShape key={p.id} polygon={p} pixelsPerInch={PIXELS_PER_INCH} />
            ))}
            {map.walls.map((w) => (
              <TerrainWallShape key={w.id} wall={w} pixelsPerInch={PIXELS_PER_INCH} />
            ))}
            {units.map((u) => (
              <UnitToken key={u.id} unit={u} pixelsPerInch={PIXELS_PER_INCH} />
            ))}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
