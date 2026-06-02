import ms from "milsymbol";
import { useMemo, type CSSProperties } from "react";
import type { Game } from "../../core/Game.js";
import type { TerrainCatalog } from "../../core/map/terrainCatalog.js";
import { getRules } from "../../core/rules.js";
import type { Point, TeamId } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { buildSidc } from "../canvas/sidc.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useMapEditorContext } from "../hooks/useMapEditorContext.js";
import { useRulesContext } from "../hooks/useRulesContext.js";
import { useSelectionContext, type TerrainHit } from "../hooks/useSelectionContext.js";
import type { Dispatch } from "../hooks/useGame.js";
import { theme } from "../theme.js";

const PANEL_WIDTH = 380;
const PANEL_MIN_HEIGHT = 88;
const SYMBOL_SIZE = 26;

/**
 * Bottom-center contextual info panel. Always visible; content priority is:
 *   1. The unit locked by selection (info-menu owns the lock indicator).
 *   2. The unit currently hovered.
 *   3. A hint string when the cursor is over the map with no unit under it.
 *   4. An out-of-map idle string when the cursor is off the canvas entirely.
 *
 * See docs/features/v1/info-menu.md.
 */
export function InfoMenu() {
  const { game, dispatch } = useGameContext();
  const {
    selectedUnitId,
    hoveredUnitId,
    hoveredTerrainHit,
    cursorOnMap,
    previewPositionOverride,
  } = useSelectionContext();
  // Subscribe to rule changes so terrain-stealth and unit-stealth displays
  // refresh live when the player tweaks values in the Adjust Vision Rules
  // editor. We don't need the returned value directly here — the read sites
  // (terrainCatalog getters, getStealthAtPosition) pull from getRules() on
  // each render.
  useRulesContext();
  const { isOpen: isMapEditorOpen } = useMapEditorContext();
  const active = game.state.getActivePlayer();

  // The Transition screen and the map editor are full-takeover views that
  // own their own UI; the info menu doesn't belong on either.
  if (game.state.phase === "Transition") return null;
  if (isMapEditorOpen) return null;

  const lockedUnit = selectedUnitId ? game.state.getUnitById(selectedUnitId) : undefined;
  const hoveredUnit = hoveredUnitId ? game.state.getUnitById(hoveredUnitId) : undefined;
  const displayUnit = lockedUnit ?? hoveredUnit;
  const isLocked = lockedUnit !== undefined;

  // During an active move the panel-locked unit's *previewed* position
  // (live cursor) is used in place of its committed position, so the
  // stealth modifier line tracks the preview.
  const displayPosition =
    displayUnit && previewPositionOverride?.unitId === displayUnit.id
      ? previewPositionOverride.position
      : displayUnit?.getPosition();

  // Priority: locked-unit > hovered-unit > terrain at cursor > out-of-map idle.
  let body: React.ReactNode;
  if (displayUnit && displayPosition) {
    body = (
      <UnitDisplay
        unit={displayUnit}
        position={displayPosition}
        isLocked={isLocked}
        perspectiveTeamId={active}
        game={game}
        dispatch={dispatch}
      />
    );
  } else if (cursorOnMap) {
    body = <TerrainDisplay hit={hoveredTerrainHit} terrain={game.ruleset.terrain} />;
  } else {
    body = <p style={idleStyle}>Location is out of the map area</p>;
  }

  return <div style={panelStyle}>{body}</div>;
}

interface UnitDisplayProps {
  unit: Unit;
  /** Position to display and to use for position-derived fields like terrain stealth. */
  position: Point;
  isLocked: boolean;
  perspectiveTeamId: TeamId;
  game: Game;
  dispatch: Dispatch;
}

function UnitDisplay({ unit, position, isLocked, perspectiveTeamId, game, dispatch }: UnitDisplayProps) {
  const isFriendly = unit.teamId === perspectiveTeamId;
  const teamColor = isFriendly ? theme.colors.friendly : theme.colors.hostile;
  const revealed = game.state.visionState.revealed.has(unit.id);

  const visionLabel = isFriendly
    ? revealed ? "Revealed" : "Not revealed"
    : revealed ? "Revealed" : "Detected";

  // Engine read API (R4): the vision pipeline computes the value and
  // the per-source breakdown; the UI just renders. No re-derivation
  // of intrinsic × pool × gtg here — that's all engine-side.
  const stealthResult = game.visionCalculator.effectiveStealth(unit, position);
  const totalStealth = stealthResult.value;
  // Build "×A intrinsic × ×B Tall Woods × ×C GtG" from the engine's
  // breakdown. Each entry's label is whatever the contributing
  // contributor declared.
  const factors = stealthResult.breakdown.map(
    (reading) => `×${formatMultiplier(reading.modifier)} ${reading.label}`,
  );
  // GtG informational row (the "Gone to Ground · ×N stealth if concealed
  // by terrain" line below) shows whenever the unit is GtG, regardless
  // of whether it's stacking right now. This is a player-affordance
  // separate from the stealth math — kept reading getRules() directly
  // for the displayed multiplier rather than going through the engine.
  const isGtg = game.isGoneToGround(unit);
  const gtgMultiplier = getRules().goneToGroundStealthModifier;
  const pos = position;

  return (
    <div style={unitDisplayStyle}>
      <div style={headerRowStyle}>
        <MiniSymbol unit={unit} perspectiveTeamId={perspectiveTeamId} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...nameStyle, color: teamColor }}>{unit.name}</div>
          <div style={subRowStyle}>
            {unit.type} · {unit.size}
            {unit.hasModifier("Recon") ? " · Recon" : ""}
          </div>
        </div>
        {isLocked && <span style={lockTagStyle}>SELECTED</span>}
      </div>
      <div style={detailRowStyle}>
        <span>Pos ({pos.x.toFixed(1)}, {pos.y.toFixed(1)})</span>
        <span>·</span>
        <span>{visionLabel}</span>
        <span>·</span>
        <span>Vision {formatInches(unit.getVision())}″</span>
        <span>·</span>
        <span>
          Stealth ×{formatMultiplier(totalStealth)}
          {factors.length >= 2 ? ` (${factors.join(" × ")})` : ""}
        </span>
      </div>
      {isGtg && (
        <div style={detailRowStyle}>
          <span style={gtgInfoStyle}>
            Gone to Ground · ×{gtgMultiplier} stealth if concealed by terrain
          </span>
        </div>
      )}
      {unit.supportsToggleable("dugIn") && (
        <div style={detailRowStyle}>
          {isFriendly ? (
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={unit.getToggleableState("dugIn")}
                onChange={() => dispatch((g) => g.toggleToggleable(unit.id, "dugIn"))}
              />
              Dug-In
            </label>
          ) : (
            <label style={{ ...checkboxLabelStyle, cursor: "default" }}>
              <input type="checkbox" checked={unit.getToggleableState("dugIn")} disabled readOnly />
              Dug-In
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Terrain info — the cursor is over a polygon, a wall, or open ground.
 * All display fields come from the active ruleset's terrain catalog
 * (`game.ruleset.terrain`), so adding a new terrain kind to the
 * ruleset never needs to touch this component. Renders nothing-found
 * messaging when the terrain type isn't registered.
 */
function TerrainDisplay({ hit, terrain }: { hit: TerrainHit | undefined; terrain: TerrainCatalog }) {
  if (!hit) {
    return (
      <div style={unitDisplayStyle}>
        <div style={headerRowStyle}>
          <div style={{ flex: 1 }}>
            <div style={nameStyle}>Open</div>
            <div style={subRowStyle}>Terrain Type: Open (none)</div>
          </div>
        </div>
      </div>
    );
  }
  const entry = hit.kind === "polygon"
    ? terrain.polygons[hit.polygon.terrainType]
    : terrain.walls[hit.wall.wallType];
  if (!entry) {
    return (
      <div style={unitDisplayStyle}>
        <div style={headerRowStyle}>
          <div style={{ flex: 1 }}>
            <div style={nameStyle}>Unknown terrain</div>
            <div style={subRowStyle}>
              {hit.kind === "polygon" ? hit.polygon.terrainType : hit.wall.wallType}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={unitDisplayStyle}>
      <div style={headerRowStyle}>
        <div style={{ flex: 1 }}>
          <div style={nameStyle}>{entry.displayName}</div>
          <div style={subRowStyle}>Stealth ×{entry.stealthMultiplier}</div>
        </div>
      </div>
      <div style={detailRowStyle}>{entry.ruleDescription}</div>
    </div>
  );
}

function MiniSymbol({ unit, perspectiveTeamId }: { unit: Unit; perspectiveTeamId: TeamId }) {
  const sidc = buildSidc(unit, perspectiveTeamId);
  const dataUrl = useMemo(() => {
    const symbol = new ms.Symbol(sidc, { size: SYMBOL_SIZE });
    return symbol.asCanvas().toDataURL();
  }, [sidc]);
  return (
    <img
      src={dataUrl}
      alt=""
      style={{ display: "block", width: SYMBOL_SIZE * 1.6, height: "auto", flex: "0 0 auto" }}
    />
  );
}

/** "85.3" not "85.30"; "64" not "64.0". */
function formatInches(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

/** Render a stealth multiplier compactly: 1.33 → "1.33", 2 → "2". */
function formatMultiplier(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? r.toString() : r.toFixed(2).replace(/\.?0+$/, "");
}

const panelStyle: CSSProperties = {
  position: "fixed",
  bottom: theme.spacing.lg,
  left: "50%",
  transform: "translateX(-50%)",
  width: PANEL_WIDTH,
  minHeight: PANEL_MIN_HEIGHT,
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.sidebarBorder}`,
  borderRadius: theme.radius.md,
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
  padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
  fontSize: theme.fontSize.md,
  color: theme.colors.text,
  zIndex: 900,
  display: "flex",
  alignItems: "center",
};

const idleStyle: CSSProperties = {
  margin: 0,
  width: "100%",
  textAlign: "center",
  color: theme.colors.textMuted,
  fontSize: theme.fontSize.sm,
};

const unitDisplayStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.xs + 2,
  width: "100%",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.md,
};

const nameStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: theme.fontSize.base,
  whiteSpace: "nowrap",
  overflow: "visible",
};

const subRowStyle: CSSProperties = {
  fontSize: theme.fontSize.sm,
  color: theme.colors.textMuted,
};

const detailRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing.sm + 2,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text,
};

const lockTagStyle: CSSProperties = {
  fontSize: theme.fontSize.xs,
  letterSpacing: "0.08em",
  padding: "2px 6px",
  background: theme.colors.headerBg,
  color: theme.colors.headerText,
  borderRadius: theme.radius.sm,
  flex: "0 0 auto",
};

const checkboxLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: theme.fontSize.sm,
  cursor: "pointer",
  userSelect: "none",
};

const gtgInfoStyle: CSSProperties = {
  fontSize: theme.fontSize.sm,
  color: "#2d5e2d",
  fontStyle: "italic",
};
