import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { fromGameMap, toGameMap, type WorkingMap } from "../../core/map/WorkingMap.js";
import type { PolygonTerrainType, WallType } from "../../core/types.js";
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

  // Derived GameMap for rendering — rebuilt whenever the working draft
  // changes. Cheap (just constructs class instances from plain data).
  const renderMap = useMemo(() => toGameMap(workingMap), [workingMap]);

  const setWidth = (w: number) => setWorkingMap((wm) => ({ ...wm, width: w }));
  const setHeight = (h: number) => setWorkingMap((wm) => ({ ...wm, height: h }));

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
