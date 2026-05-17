import { useEffect, useState } from "react";
import type { Game } from "../../core/Game.js";
import type { Point, UnitId, UnitSize, UnitType } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { MovePreviewOverlay } from "../canvas/MovePreviewOverlay.js";
import { Sidebar, SidebarButton, SidebarSection } from "../components/Sidebar.js";
import { useDebugContext } from "../hooks/useDebugContext.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useSelectionContext } from "../hooks/useSelectionContext.js";

const UNIT_SIZES: readonly UnitSize[] = ["Squad", "Platoon", "Company", "Battalion"];

function getVisibleUnits(game: Game, showAllUnits: boolean): Unit[] {
  if (showAllUnits) return [...game.state.units];
  const active = game.state.getActivePlayer();
  const teamList = game.state.visionState.teamLists.get(active) ?? new Set<UnitId>();
  return game.state.units.filter(
    (u) => u.teamId === active || teamList.has(u.id),
  );
}

/**
 * Transient state for the live move preview. Not stored in GameState — the
 * preview is purely a UI artifact and doesn't affect committed game state
 * until the player commits via a map click.
 *
 * `waypoints` is the in-order list of intermediate points the player has
 * placed via Shift-click or while the sidebar Waypoint mode toggle is on.
 * The full preview path is `origin → waypoints[0] → … → waypoints[n-1] → cursor`.
 */
interface ActiveMove {
  unitId: UnitId;
  origin: Point;
  waypoints: Point[];
  cursor: Point;
}

export function MoveView() {
  const { game, dispatch } = useGameContext();
  const {
    selectedUnitId,
    setSelectedUnitId,
    setHoveredUnitId,
    setHoveredTerrainHit,
    setCursorOnMap,
    setPreviewPositionOverride,
  } = useSelectionContext();
  const { showAllUnits } = useDebugContext();
  const active = game.state.getActivePlayer();
  const [activeMove, setActiveMove] = useState<ActiveMove | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [waypointToggle, setWaypointToggle] = useState(false);

  // Pen for mid-Move unit creation (see docs/features/mid-game-roster.md
  // §2.1). Placement is explicit: clicking the pen's Place button primes
  // the next empty-map click for a createUnit call. We don't make every
  // empty click an add, because empty clicks already commit moves /
  // clear selection here — silent over-loading would surprise the
  // player and accidentally spawn units while panning.
  const [penType, setPenType] = useState<UnitType>("Infantry");
  const [penSize, setPenSize] = useState<UnitSize>("Platoon");
  const [penRecon, setPenRecon] = useState(false);
  const [penDugIn, setPenDugIn] = useState(false);
  const [penName, setPenName] = useState("");
  const [addPrimed, setAddPrimed] = useState(false);

  const visible = getVisibleUnits(game, showAllUnits);
  const ownUnits = game.state.units.filter((u) => u.teamId === active);
  const effectiveSelectedId = activeMove?.unitId ?? selectedUnitId;
  const selected = effectiveSelectedId ? game.state.getUnitById(effectiveSelectedId) : undefined;
  const selectedOwn = selected && selected.teamId === active ? selected : undefined;
  const canUndo = game.state.moveHistory.length > 0;
  const waypointModeActive = shiftHeld || waypointToggle;

  const autoName = (): string => `${penType[0]}-${ownUnits.length + 1}`;

  const startActiveMove = (unit: Unit) => {
    const origin = unit.getPosition();
    setActiveMove({ unitId: unit.id, origin, waypoints: [], cursor: origin });
    setSelectedUnitId(unit.id);
  };

  const cancelActiveMove = () => {
    setActiveMove(null);
    setSelectedUnitId(undefined);
    // The sidebar toggle is sticky across moves; only Shift state is keyboard-
    // driven. Don't auto-reset waypointToggle here — the player may want it on
    // for the next move too.
  };

  const handleUnitClick = (unit: Unit) => {
    if (unit.teamId !== active) {
      // Enemy click toggles info-menu selection only — no movement. If there
      // was an active move on an own unit, switching focus to an enemy also
      // cancels it (same rule as switching focus to a different own unit).
      if (activeMove) setActiveMove(null);
      setSelectedUnitId(selectedUnitId === unit.id ? undefined : unit.id);
      return;
    }
    if (activeMove && activeMove.unitId === unit.id) {
      // Clicking the unit that's mid-move cancels the move (per §2.4) AND
      // clears the info-menu selection.
      cancelActiveMove();
      return;
    }
    // Clicking any other own unit (whether or not there's an active move)
    // starts a fresh active move on that unit.
    startActiveMove(unit);
  };

  const placeNewUnit = (position: Point) => {
    const placedName = penName.trim() === "" ? autoName() : penName.trim();
    dispatch((g) =>
      g.createUnit({
        type: penType,
        name: placedName,
        position,
        size: penSize,
        ...(penRecon && { modifiers: ["Recon"] }),
        ...(penType === "Infantry" && { dugIn: penDugIn }),
      }),
    );
    setPenName("");
    setAddPrimed(false);
  };

  const handleDeleteSelected = () => {
    if (!selectedOwn) return;
    if (!window.confirm(`Delete ${selectedOwn.name}?`)) return;
    const id = selectedOwn.id;
    // Cancel any active move whose source unit we're about to delete so
    // the preview overlay doesn't reference a unit that's gone.
    if (activeMove && activeMove.unitId === id) setActiveMove(null);
    dispatch((g) => g.deleteUnit(id));
    setSelectedUnitId(undefined);
  };

  const handleMapClick = (position: Point) => {
    if (activeMove) {
      // Active move: priming is silently ignored while the existing move
      // is in progress — commit (or add waypoint) below.
    } else if (addPrimed) {
      // No active move + primed: this is a unit placement, not a deselect.
      placeNewUnit(position);
      return;
    }
    if (!activeMove) {
      // No active move and not primed: empty-map click clears info-menu selection.
      setSelectedUnitId(undefined);
      return;
    }
    if (waypointModeActive) {
      // Add a waypoint and stay in active-move mode. Future clicks may add
      // more waypoints, or commit once the player drops waypoint mode.
      setActiveMove({
        ...activeMove,
        waypoints: [...activeMove.waypoints, position],
      });
      return;
    }
    const { unitId } = activeMove;
    dispatch((g) => g.moveUnit(unitId, position));
    setActiveMove(null);
    setSelectedUnitId(undefined);
  };

  const handlePointerMove = (position: Point) => {
    if (!activeMove) return;
    setActiveMove({ ...activeMove, cursor: position });
  };

  // Publish the live active-move cursor into the selection context so the
  // info menu can use it for position-derived fields (e.g. stealth modifier
  // at the previewed location) instead of the unit's stored position.
  useEffect(() => {
    if (!activeMove) {
      setPreviewPositionOverride(undefined);
      return;
    }
    setPreviewPositionOverride({ unitId: activeMove.unitId, position: activeMove.cursor });
  }, [activeMove, setPreviewPositionOverride]);

  const undoLastMove = () => {
    dispatch((g) => g.undoLastMove());
  };

  const endMove = () => {
    // Active move is implicitly cancelled (no commit) per §4.
    setActiveMove(null);
    setSelectedUnitId(undefined);
    dispatch((g) => g.endMove());
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setShiftHeld(true);
        return;
      }
      if (e.key === "Escape") {
        setActiveMove(null);
        setSelectedUnitId(undefined);
        setAddPrimed(false);
        return;
      }
      // Ctrl+Z / Cmd+Z = undo. Shift+Ctrl+Z is conventionally redo — ignore it.
      const isUndoChord = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z";
      if (!isUndoChord) return;
      // Don't hijack undo when the user is typing in an input.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      dispatch((g) => {
        if (g.state.phase === "Move" && g.state.moveHistory.length > 0) {
          g.undoLastMove();
        }
      });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [dispatch]);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <Sidebar>
        <SidebarSection title="Add Unit (Pen)">
          <label style={penLabelStyle}>
            <span>Name</span>
            <input
              type="text"
              value={penName}
              onChange={(e) => setPenName(e.target.value)}
              placeholder="(optional)"
              style={penTextInputStyle}
            />
          </label>
          <label style={penLabelStyle}>
            <span>Type</span>
            <select
              value={penType}
              onChange={(e) => setPenType(e.target.value as UnitType)}
              style={penSelectStyle}
            >
              <option value="Infantry">Infantry</option>
              <option value="Tank">Tank</option>
            </select>
          </label>
          <label style={penLabelStyle}>
            <span>Size</span>
            <select
              value={penSize}
              onChange={(e) => setPenSize(e.target.value as UnitSize)}
              style={penSelectStyle}
            >
              {UNIT_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label style={penCheckboxLabelStyle}>
            <input
              type="checkbox"
              checked={penRecon}
              onChange={(e) => setPenRecon(e.target.checked)}
            />
            Recon
          </label>
          <label style={{ ...penCheckboxLabelStyle, opacity: penType === "Infantry" ? 1 : 0.4 }}>
            <input
              type="checkbox"
              checked={penDugIn}
              disabled={penType !== "Infantry"}
              onChange={(e) => setPenDugIn(e.target.checked)}
            />
            Dug-in (Infantry only)
          </label>
          {addPrimed ? (
            <p style={primedHintStyle}>
              Click empty map to place. Esc cancels.
            </p>
          ) : (
            <div style={{ marginTop: 6 }}>
              <SidebarButton variant="secondary" onClick={() => setAddPrimed(true)}>
                Place new unit
              </SidebarButton>
            </div>
          )}
        </SidebarSection>

        <SidebarSection title="Move actions">
          {selected ? (
            <div style={{ fontSize: 13 }}>
              {selectedOwn && (
                <div style={{ marginBottom: 8 }}>
                  <SidebarButton variant="secondary" onClick={handleDeleteSelected}>
                    Delete unit
                  </SidebarButton>
                </div>
              )}
              {game.state.moveHistory.some((e) => e.unitId === selected.id) && (
                <div style={{ marginBottom: 8 }}>
                  <SidebarButton
                    variant="secondary"
                    onClick={() => dispatch((g) => g.revertUnitMoves(selected.id))}
                  >
                    Snap to turn start
                  </SidebarButton>
                </div>
              )}
              {activeMove && (
                <label style={waypointToggleStyle}>
                  <input
                    type="checkbox"
                    checked={waypointToggle}
                    onChange={(e) => setWaypointToggle(e.target.checked)}
                  />
                  Waypoint mode (or hold Shift)
                </label>
              )}
              <p style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                {activeMove
                  ? waypointModeActive
                    ? "Click to add a waypoint. Release Shift / toggle off and click to commit. Esc cancels."
                    : "Click empty map to commit. Hold Shift or enable Waypoint mode to add waypoints. Esc cancels."
                  : "Click an empty spot on the map to move."}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>
              Click one of your units to select it.
            </p>
          )}
        </SidebarSection>

        <SidebarSection title={`Visible (${visible.length})`}>
          <ul style={listStyle}>
            {visible.map((u) => (
              <li
                key={u.id}
                style={{
                  ...listItemStyle,
                  fontWeight: u.id === effectiveSelectedId ? 600 : 400,
                  opacity: u.teamId === active ? 1 : 0.65,
                }}
              >
                {u.name} — {u.type}
                {u.teamId === active ? "" : " (enemy)"}
              </li>
            ))}
          </ul>
        </SidebarSection>

        {canUndo && (
          <SidebarButton variant="secondary" onClick={undoLastMove}>
            Undo last move (Ctrl+Z)
          </SidebarButton>
        )}

        <SidebarButton onClick={endMove}>End Move</SidebarButton>
      </Sidebar>
      <main style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <MapCanvas
          map={game.state.map}
          units={visible}
          perspectiveTeamId={active}
          selectedUnitId={effectiveSelectedId}
          revealedUnitIds={game.state.visionState.revealed}
          ghostUnitId={activeMove?.unitId}
          strictUnitSelect={!!activeMove}
          onUnitClick={handleUnitClick}
          onUnitHover={(u) => setHoveredUnitId(u?.id)}
          onHoveredTerrainChange={setHoveredTerrainHit}
          onCursorOnMapChange={setCursorOnMap}
          onMapClick={handleMapClick}
          onMapPointerMove={handlePointerMove}
          draggable={!activeMove}
          overlay={
            activeMove && selected
              ? (
                <MovePreviewOverlay
                  unit={selected}
                  origin={activeMove.origin}
                  waypoints={activeMove.waypoints}
                  cursor={activeMove.cursor}
                  perspectiveTeamId={active}
                />
              )
              : null
          }
        />
      </main>
    </div>
  );
}

const listStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  fontSize: 12,
};

const penLabelStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
  fontSize: 13,
};

const penCheckboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 6,
  fontSize: 13,
};

const penSelectStyle: React.CSSProperties = {
  padding: "2px 6px",
  fontSize: 13,
};

const penTextInputStyle: React.CSSProperties = {
  padding: "2px 6px",
  fontSize: 13,
  width: 120,
};

const primedHintStyle: React.CSSProperties = {
  background: "#fef3c7",
  border: "1px solid #f59e0b",
  borderRadius: 3,
  padding: "6px 8px",
  margin: "6px 0 0 0",
  fontSize: 12,
  color: "#78350f",
};

const listItemStyle: React.CSSProperties = {
  padding: "3px 0",
  borderBottom: "1px solid #eee",
};

const waypointToggleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  marginTop: 8,
  cursor: "pointer",
  userSelect: "none",
};

