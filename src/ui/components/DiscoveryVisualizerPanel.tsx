import { useEffect, useMemo, type CSSProperties } from "react";
import type { UnitType } from "../../core/types.js";
import {
  availableArchetypes,
  availablePostureModifiers,
  type ArchetypeChoice,
} from "../canvas/discoveryRings.js";
import { useDiscoveryVisualizerContext, type DiscoveryScope } from "../hooks/useDiscoveryVisualizerContext.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useMapEditorContext } from "../hooks/useMapEditorContext.js";
import { useRulesContext } from "../hooks/useRulesContext.js";
import { theme } from "../theme.js";

/**
 * Upper-right floating panel — Discovery Visualizer controls.
 *
 * Visible during the gameplay phases that draw the map (Move, FireDeclare,
 * AddRemoveUnits). Hidden during Deploy (no enemy info yet), Transition
 * (full-takeover view), and while the map editor is open.
 *
 * Per docs/features/discovery-visualizer.md §2.1.
 */
export function DiscoveryVisualizerPanel() {
  const { game } = useGameContext();
  const { rules } = useRulesContext();
  const { isOpen: isMapEditorOpen } = useMapEditorContext();
  const {
    settings,
    setScope,
    setArchetype,
    setPostureModifier,
    setGoneToGround,
    setCopyFromHover,
  } = useDiscoveryVisualizerContext();

  const phase = game.state.phase;
  const isGameplayPhase =
    phase === "Move" || phase === "FireDeclare" || phase === "AddRemoveUnits";
  const visible = isGameplayPhase && !isMapEditorOpen;

  // Re-derive dropdown options whenever rules change.
  const postureOptions = useMemo(() => availablePostureModifiers(rules), [rules]);
  const archetypeOptions = useMemo(() => availableArchetypes(rules), [rules]);

  // Auto-reset posture if the selected modifier is no longer available
  // (rule edit removed a cover tier). See §4 edge cases.
  useEffect(() => {
    if (!postureOptions.find((o) => o.modifier === settings.postureModifier)) {
      setPostureModifier(1);
    }
  }, [postureOptions, settings.postureModifier, setPostureModifier]);

  if (!visible) return null;

  const isAbstract = settings.archetype.kind === "none";

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>Discovery Visualizer</div>

      <Row label="Show on">
        <select
          value={settings.scope}
          onChange={(e) => setScope(e.target.value as DiscoveryScope)}
          style={selectStyle}
        >
          <option value="off">Off</option>
          <option value="selected">Selected unit</option>
          <option value="all">All my units</option>
        </select>
      </Row>

      <Row label="Threat">
        <select
          value={archetypeKey(settings.archetype)}
          onChange={(e) => setArchetype(parseArchetypeKey(e.target.value))}
          style={selectStyle}
        >
          {archetypeOptions.map((a) => (
            <option key={archetypeKey({ kind: "unit", unitType: a.unitType, recon: a.recon })}
                    value={archetypeKey({ kind: "unit", unitType: a.unitType, recon: a.recon })}>
              {a.label}
            </option>
          ))}
          <option value="none">None — abstract divisors</option>
        </select>
      </Row>

      {!isAbstract && (
        <>
          <Row label="Posture">
            <select
              value={String(settings.postureModifier)}
              onChange={(e) => setPostureModifier(Number(e.target.value))}
              style={selectStyle}
            >
              {postureOptions.map((o) => (
                <option key={o.modifier} value={String(o.modifier)}>
                  {o.label}
                </option>
              ))}
            </select>
          </Row>

          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={settings.goneToGround}
              onChange={(e) => setGoneToGround(e.target.checked)}
            />
            Gone to Ground
          </label>

          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={settings.copyFromHover}
              onChange={(e) => setCopyFromHover(e.target.checked)}
            />
            Copy unit info from hovered enemy
          </label>
        </>
      )}

      <div style={tipStyle}>
        {isAbstract
          ? "Abstract mode — outgoing rings at every reachable stealth divisor."
          : "Red = enemy sees me. Green = I see them. Select a unit."}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={rowStyle}>
      <span style={rowLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

function archetypeKey(a: ArchetypeChoice): string {
  if (a.kind === "none") return "none";
  return `${a.unitType}${a.recon ? "-recon" : ""}`;
}

function parseArchetypeKey(key: string): ArchetypeChoice {
  if (key === "none") return { kind: "none" };
  const recon = key.endsWith("-recon");
  const unitType = (recon ? key.slice(0, -"-recon".length) : key) as UnitType;
  return { kind: "unit", unitType, recon };
}

const PANEL_WIDTH = 280;

const panelStyle: CSSProperties = {
  position: "fixed",
  top: theme.spacing.lg + 56, // clear of the header
  right: theme.spacing.lg,
  width: PANEL_WIDTH,
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.sidebarBorder}`,
  borderRadius: theme.radius.md,
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
  padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
  fontSize: theme.fontSize.md,
  color: theme.colors.text,
  zIndex: 900,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.sm + 2,
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: theme.fontSize.base,
  marginBottom: theme.spacing.xs,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  justifyContent: "space-between",
};

const rowLabelStyle: CSSProperties = {
  color: theme.colors.textMuted,
  fontSize: theme.fontSize.sm,
};

const selectStyle: CSSProperties = {
  flex: 1,
  maxWidth: 180,
  fontSize: theme.fontSize.sm,
  padding: "2px 4px",
};

const checkRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: theme.fontSize.sm,
  cursor: "pointer",
  userSelect: "none",
};

const tipStyle: CSSProperties = {
  marginTop: theme.spacing.xs,
  fontSize: theme.fontSize.xs,
  color: theme.colors.textMuted,
  fontStyle: "italic",
};
