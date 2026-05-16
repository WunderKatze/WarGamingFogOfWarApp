import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import { polygonTerrainCatalog, wallTerrainCatalog } from "../../core/map/terrainCatalog.js";
import { fromGameMap, toGameMap, type WorkingMap } from "../../core/map/WorkingMap.js";
import type { Point, PolygonTerrainType, WallType } from "../../core/types.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useMapEditorContext } from "../hooks/useMapEditorContext.js";
import { theme } from "../theme.js";

/**
 * Map editor view. Takes over the main view area while open
 * (see `MapEditorProvider`). Stage 1 — draw-direct polygons / walls
 * on a blank rectangle, save / load JSON, Apply restarts the game.
 *
 * This checkpoint ships the shell: sidebar with width/height inputs,
 * tool / terrain-type / wall-type selectors, snap toggle, and
 * Save / Load / Apply / Cancel buttons. The map canvas renders the
 * working draft. Tool behavior (drawing polygons, walls, deletion),
 * snap rendering, file I/O, and Apply land in subsequent commits.
 *
 * See `docs/features/map-editor.md`.
 */
export function MapEditor() {
  const { game } = useGameContext();
  const { close } = useMapEditorContext();

  // Seed the working draft from the current game's map on mount. Local
  // to the editor — discarded on unmount (Cancel / close path).
  const [workingMap, setWorkingMap] = useState<WorkingMap>(() => fromGameMap(game.state.map));

  const [tool, setTool] = useState<EditorTool>("polygon");
  const [polygonType, setPolygonType] = useState<PolygonTerrainType>("Building");
  const [wallType, setWallType] = useState<WallType>("Short");
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Polygon tool draft — accumulated vertices for the in-progress shape.
  // Empty array means no draft is active.
  const [polygonDraft, setPolygonDraft] = useState<Point[]>([]);
  // Wall tool draft — the start point after the first click. Undefined
  // means no wall is in progress; the second click commits and clears.
  const [wallDraft, setWallDraft] = useState<Point | undefined>(undefined);
  // Last cursor position over the map, in inches. Used to draw the
  // preview segment from the last placed vertex to the cursor.
  const [cursorPos, setCursorPos] = useState<Point | undefined>(undefined);
  // Monotonic counter for generating unique terrain ids when we commit
  // a new shape from the editor.
  const nextIdRef = useRef(1);

  // Derived GameMap for rendering — rebuilt whenever the working draft
  // changes. Cheap (just constructs class instances from plain data).
  const renderMap = useMemo(() => toGameMap(workingMap), [workingMap]);

  const setWidth = (w: number) => setWorkingMap((wm) => ({ ...wm, width: w }));
  const setHeight = (h: number) => setWorkingMap((wm) => ({ ...wm, height: h }));

  const snap = (p: Point): Point =>
    snapToGrid ? { x: Math.round(p.x), y: Math.round(p.y) } : p;

  // Switching tools mid-draft cancels in-progress shapes so we don't
  // accidentally commit them with the new tool's settings later.
  useEffect(() => {
    if (tool !== "polygon") setPolygonDraft([]);
    if (tool !== "wall") setWallDraft(undefined);
  }, [tool]);

  const commitPolygon = () => {
    if (polygonDraft.length < 3) return;
    const id = `editor-poly-${nextIdRef.current++}`;
    setWorkingMap((wm) => ({
      ...wm,
      polygons: [
        ...wm.polygons,
        { id, terrainType: polygonType, vertices: [...polygonDraft] },
      ],
    }));
    setPolygonDraft([]);
  };

  const commitWall = (from: Point, to: Point) => {
    // Degenerate (zero-length) walls would be a snap-on artifact: two
    // clicks on the same grid intersection. Silently drop so the user
    // isn't left with an invisible wall they need to delete.
    if (from.x === to.x && from.y === to.y) {
      setWallDraft(undefined);
      return;
    }
    const id = `editor-wall-${nextIdRef.current++}`;
    setWorkingMap((wm) => ({
      ...wm,
      walls: [...wm.walls, { id, from, to, wallType }],
    }));
    setWallDraft(undefined);
  };

  const handleMapClick = (position: Point) => {
    const snapped = snap(position);
    if (tool === "polygon") {
      setPolygonDraft((draft) => [...draft, snapped]);
    } else if (tool === "wall") {
      if (wallDraft === undefined) {
        setWallDraft(snapped);
      } else {
        commitWall(wallDraft, snapped);
      }
    }
  };

  // Snap the cursor at the source so every downstream consumer (preview
  // segment, future tool previews) sees the same point the click would
  // commit to. Without this the dashed preview chases the raw cursor and
  // it looks like snap is off even though placement is rounding.
  const handleMapPointerMove = (position: Point) => {
    setCursorPos(snap(position));
  };

  // Keyboard: Enter commits the in-progress polygon, Escape cancels.
  // Ignored while focus is in a text input so the dimension fields
  // remain editable.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commitPolygon();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPolygonDraft([]);
        setWallDraft(undefined);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygonDraft, polygonType, snapToGrid]);

  const handleCancel = () => {
    // TODO (Ctrl+Z + Apply / Save / Load checkpoints): if the draft has
    // unsaved edits, confirm-before-discard. For now Close is silent.
    close();
  };

  const handleSave = () => {
    window.alert("Save lands in a follow-up commit.");
  };
  const handleLoad = () => {
    window.alert("Load lands in a follow-up commit.");
  };
  const handleApply = () => {
    window.alert("Apply lands in a follow-up commit.");
  };

  return (
    <div style={layoutStyle}>
      <aside style={sidebarStyle}>
        <Section title="Dimensions">
          <Row label="Width">
            <NumberInput value={workingMap.width} onChange={setWidth} suffix={'"'} />
          </Row>
          <Row label="Height">
            <NumberInput value={workingMap.height} onChange={setHeight} suffix={'"'} />
          </Row>
        </Section>

        <Section title="Tool">
          <RadioRow name="tool" value="polygon" current={tool} onChange={setTool}>Polygon</RadioRow>
          <RadioRow name="tool" value="wall" current={tool} onChange={setTool}>Wall</RadioRow>
          <RadioRow name="tool" value="delete" current={tool} onChange={setTool}>Delete</RadioRow>
        </Section>

        <Section title="Terrain type">
          <RadioRow name="poly" value="Building" current={polygonType} onChange={setPolygonType}>Building</RadioRow>
          <RadioRow name="poly" value="TallWoods" current={polygonType} onChange={setPolygonType}>Tall Woods</RadioRow>
          <RadioRow name="poly" value="ShortTerrain" current={polygonType} onChange={setPolygonType}>Short Terrain</RadioRow>
        </Section>

        <Section title="Wall type">
          <RadioRow name="wall" value="Short" current={wallType} onChange={setWallType}>Short</RadioRow>
          <RadioRow name="wall" value="Tall" current={wallType} onChange={setWallType}>Tall</RadioRow>
        </Section>

        <Section title="Snap">
          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
            />
            <span>Snap to 1.0″ grid</span>
          </label>
        </Section>

        <div style={buttonColumnStyle}>
          <button type="button" onClick={handleSave} style={secondaryButtonStyle}>Save…</button>
          <button type="button" onClick={handleLoad} style={secondaryButtonStyle}>Load…</button>
          <button type="button" onClick={handleApply} style={primaryButtonStyle}>Apply</button>
          <button type="button" onClick={handleCancel} style={secondaryButtonStyle}>Cancel</button>
        </div>
      </aside>

      <main style={mainStyle}>
        <MapCanvas
          map={renderMap}
          units={[]}
          perspectiveTeamId={game.state.getActivePlayer()}
          onMapClick={handleMapClick}
          onMapPointerMove={handleMapPointerMove}
          overlay={
            <>
              {snapToGrid && (
                <GridOverlay width={workingMap.width} height={workingMap.height} />
              )}
              {tool === "polygon" && polygonDraft.length > 0 && (
                <PolygonDraftOverlay
                  vertices={polygonDraft}
                  cursor={cursorPos}
                  terrainType={polygonType}
                />
              )}
              {tool === "wall" && wallDraft && (
                <WallDraftOverlay
                  from={wallDraft}
                  cursor={cursorPos}
                  wallType={wallType}
                />
              )}
            </>
          }
        />
      </main>
    </div>
  );
}

type EditorTool = "polygon" | "wall" | "delete";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 style={sectionTitleStyle}>{title}</h3>
      <div style={sectionBodyStyle}>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={rowStyle}>
      <span>{label}</span>
      {children}
    </label>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (next: number) => void;
  suffix?: string;
}

function NumberInput({ value, onChange, suffix }: NumberInputProps) {
  const [draft, setDraft] = useState(value.toString());
  // Resync the draft if the value changes from outside (e.g., a Load).
  useEffect(() => {
    setDraft(value.toString());
  }, [value]);
  const commit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setDraft(next);
    const parsed = parseFloat(next);
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== value) {
      onChange(parsed);
    }
  };
  return (
    <span style={inputWrapStyle}>
      <input
        type="number"
        value={draft}
        onChange={commit}
        step="any"
        min="0"
        style={inputStyle}
      />
      {suffix && <span style={suffixStyle}>{suffix}</span>}
    </span>
  );
}

interface RadioRowProps<T extends string> {
  name: string;
  value: T;
  current: T;
  onChange: (v: T) => void;
  children: ReactNode;
}

/**
 * Faint dotted 1.0″ grid drawn over the map rect. Rendered in the
 * effects layer so it stays under the polygon-draft preview but on top
 * of placed terrain. Listening is disabled (the effects layer already
 * sets that) so it never swallows clicks.
 */
function GridOverlay({ width, height }: { width: number; height: number }) {
  const px = theme.pixelsPerInch;
  const stroke = "rgba(0,0,0,0.18)";
  const lines: ReactNode[] = [];
  for (let x = 0; x <= width; x++) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[x * px, 0, x * px, height * px]}
        stroke={stroke}
        strokeWidth={0.5}
        dash={[1, 3]}
      />,
    );
  }
  for (let y = 0; y <= height; y++) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[0, y * px, width * px, y * px]}
        stroke={stroke}
        strokeWidth={0.5}
        dash={[1, 3]}
      />,
    );
  }
  return <Group listening={false}>{lines}</Group>;
}

interface PolygonDraftOverlayProps {
  vertices: readonly Point[];
  cursor: Point | undefined;
  terrainType: PolygonTerrainType;
}

/**
 * Renders the in-progress polygon: a dashed line through the placed
 * vertices, a small filled dot at each vertex, and a preview segment
 * from the last vertex to the cursor (so the player can see where the
 * next click will land). Color matches the terrain catalog's fill so
 * the previewed shape reads as the same kind it will commit to.
 */
function PolygonDraftOverlay({ vertices, cursor, terrainType }: PolygonDraftOverlayProps) {
  if (vertices.length === 0) return null;
  const px = theme.pixelsPerInch;
  const stroke = polygonTerrainCatalog[terrainType].visual.stroke;
  const points = vertices.flatMap((v) => [v.x * px, v.y * px]);
  const lastVertex = vertices[vertices.length - 1]!;
  return (
    <Group listening={false}>
      {/* Placed segments — a polyline through every vertex placed so far. */}
      {vertices.length >= 2 && (
        <Line
          points={points}
          stroke={stroke}
          strokeWidth={1.5}
          dash={[6, 4]}
        />
      )}
      {/* Preview segment from the last vertex to the cursor. */}
      {cursor && (
        <Line
          points={[lastVertex.x * px, lastVertex.y * px, cursor.x * px, cursor.y * px]}
          stroke={stroke}
          strokeWidth={1.5}
          dash={[3, 3]}
          opacity={0.6}
        />
      )}
      {/* Distance labels at each segment midpoint — placed segments and
          the preview segment alike, so the player can compare lengths
          against the physical table without counting grid squares. */}
      {vertices.slice(1).map((v, i) => (
        <SegmentLabel key={`p${i}`} from={vertices[i]!} to={v} />
      ))}
      {cursor && <SegmentLabel from={lastVertex} to={cursor} />}
      {/* Vertex dots. */}
      {vertices.map((v, i) => (
        <Circle
          key={i}
          x={v.x * px}
          y={v.y * px}
          radius={3}
          fill={stroke}
        />
      ))}
    </Group>
  );
}

interface WallDraftOverlayProps {
  from: Point;
  cursor: Point | undefined;
  wallType: WallType;
}

/**
 * Renders the in-progress wall: a dot at the placed start point and a
 * dashed preview segment from that point to the cursor, drawn in the
 * wall-catalog stroke color and width so the previewed wall matches
 * what will commit. Distance label sits at the midpoint.
 */
function WallDraftOverlay({ from, cursor, wallType }: WallDraftOverlayProps) {
  const px = theme.pixelsPerInch;
  const { stroke, strokeWidth } = wallTerrainCatalog[wallType].visual;
  return (
    <Group listening={false}>
      <Circle x={from.x * px} y={from.y * px} radius={3} fill={stroke} />
      {cursor && (
        <>
          <Line
            points={[from.x * px, from.y * px, cursor.x * px, cursor.y * px]}
            stroke={stroke}
            strokeWidth={strokeWidth}
            dash={[6, 4]}
            opacity={0.7}
          />
          <SegmentLabel from={from} to={cursor} />
        </>
      )}
    </Group>
  );
}

/**
 * Small inch-distance label sitting at the midpoint of a segment. White
 * background pill so it remains readable over any terrain color. Hidden
 * for segments shorter than ~0.5″ to avoid label clutter when the player
 * is fine-tuning a vertex.
 */
function SegmentLabel({ from, to }: { from: Point; to: Point }) {
  const px = theme.pixelsPerInch;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.5) return null;
  const label = `${dist.toFixed(1).replace(/\.0$/, "")}″`;
  const width = label.length * 6.5 + 8;
  const height = 14;
  const midX = ((from.x + to.x) / 2) * px;
  const midY = ((from.y + to.y) / 2) * px;
  return (
    <Group x={midX - width / 2} y={midY - height / 2} listening={false}>
      <Rect
        width={width}
        height={height}
        fill="rgba(255,255,255,0.9)"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={0.5}
        cornerRadius={3}
      />
      <Text
        text={label}
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
        fontSize={10}
        fontStyle="600"
        fill="#222"
      />
    </Group>
  );
}

function RadioRow<T extends string>({ name, value, current, onChange, children }: RadioRowProps<T>) {
  return (
    <label style={radioRowStyle}>
      <input
        type="radio"
        name={name}
        checked={current === value}
        onChange={() => onChange(value)}
      />
      <span>{children}</span>
    </label>
  );
}

const layoutStyle: CSSProperties = {
  display: "flex",
  flex: 1,
  minHeight: 0,
};

const sidebarStyle: CSSProperties = {
  width: 220,
  minWidth: 220,
  background: theme.colors.sidebarBg,
  borderRight: `1px solid ${theme.colors.sidebarBorder}`,
  padding: theme.spacing.lg,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.lg,
  overflowY: "auto",
};

const mainStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: "relative",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: theme.fontSize.xs,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: `0 0 ${theme.spacing.xs}px 0`,
  color: theme.colors.textMuted,
};

const sectionBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.xs,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: theme.fontSize.sm,
  gap: theme.spacing.md,
};

const radioRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  fontSize: theme.fontSize.sm,
  cursor: "pointer",
  userSelect: "none",
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  fontSize: theme.fontSize.sm,
  cursor: "pointer",
  userSelect: "none",
};

const inputWrapStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing.xs,
};

const inputStyle: CSSProperties = {
  width: 60,
  padding: "2px 6px",
  fontSize: theme.fontSize.sm,
  border: `1px solid ${theme.colors.sidebarBorder}`,
  borderRadius: theme.radius.sm,
  textAlign: "right",
};

const suffixStyle: CSSProperties = {
  color: theme.colors.textMuted,
  fontSize: theme.fontSize.sm,
};

const buttonColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.xs,
  marginTop: theme.spacing.md,
};

const primaryButtonStyle: CSSProperties = {
  padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
  background: theme.colors.primary,
  color: "#fff",
  border: "none",
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.sm,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: theme.colors.secondary,
};
