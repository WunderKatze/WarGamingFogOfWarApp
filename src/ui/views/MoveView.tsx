import { useEffect, useState } from "react";
import type { Game } from "../../core/Game.js";
import type { Point, UnitId } from "../../core/types.js";
import { Infantry } from "../../core/units/Infantry.js";
import type { Unit } from "../../core/units/Unit.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { MovePreviewOverlay } from "../canvas/MovePreviewOverlay.js";
import { Sidebar, SidebarButton, SidebarSection } from "../components/Sidebar.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useSelectionContext } from "../hooks/useSelectionContext.js";

function getVisibleUnits(game: Game): Unit[] {
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
  const { selectedUnitId, setSelectedUnitId, setHoveredUnitId, setCursorOnMap } = useSelectionContext();
  const active = game.state.getActivePlayer();
  const [activeMove, setActiveMove] = useState<ActiveMove | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [waypointToggle, setWaypointToggle] = useState(false);

  const visible = getVisibleUnits(game);
  const effectiveSelectedId = activeMove?.unitId ?? selectedUnitId;
  const selected = effectiveSelectedId ? game.state.getUnitById(effectiveSelectedId) : undefined;
  const canUndo = game.state.moveHistory.length > 0;
  const waypointModeActive = shiftHeld || waypointToggle;

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
      // Enemy click toggles info-menu selection only — no movement.
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

  const handleMapClick = (position: Point) => {
    if (!activeMove) {
      // No active move: empty-map click clears info-menu selection.
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
        <SidebarSection title="Selected">
          {selected ? (
            <div style={{ fontSize: 13 }}>
              <div><strong>{selected.name}</strong></div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {selected.type}, {selected.size}
                {selected.hasModifier("Recon") ? " (Recon)" : ""}
                {selected instanceof Infantry && selected.dugIn ? ", dug-in" : ""}
              </div>
              <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                Pos ({selected.getPosition().x.toFixed(1)}, {selected.getPosition().y.toFixed(1)})
              </div>
              {selected instanceof Infantry && (
                <label style={dugInCheckboxStyle}>
                  <input
                    type="checkbox"
                    checked={selected.dugIn}
                    onChange={() => dispatch((g) => g.toggleDugIn(selected.id))}
                  />
                  Dug-In
                </label>
              )}
              {game.state.moveHistory.some((e) => e.unitId === selected.id) && (
                <div style={{ marginTop: 8 }}>
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

const dugInCheckboxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  marginTop: 8,
  cursor: "pointer",
  userSelect: "none",
};
