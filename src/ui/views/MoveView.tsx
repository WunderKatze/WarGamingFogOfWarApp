import { useEffect, useState } from "react";
import type { Game } from "../../core/Game.js";
import type { Point, UnitId } from "../../core/types.js";
import { Infantry } from "../../core/units/Infantry.js";
import type { Unit } from "../../core/units/Unit.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { MovePreviewOverlay } from "../canvas/MovePreviewOverlay.js";
import { Sidebar, SidebarButton, SidebarSection } from "../components/Sidebar.js";
import { useGameContext } from "../hooks/useGameContext.js";

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
 */
interface ActiveMove {
  unitId: UnitId;
  origin: Point;
  cursor: Point;
}

export function MoveView() {
  const { game, dispatch } = useGameContext();
  const active = game.state.getActivePlayer();
  const [selectedId, setSelectedId] = useState<UnitId | undefined>(undefined);
  const [activeMove, setActiveMove] = useState<ActiveMove | null>(null);

  const visible = getVisibleUnits(game);
  const effectiveSelectedId = activeMove?.unitId ?? selectedId;
  const selected = effectiveSelectedId ? game.state.getUnitById(effectiveSelectedId) : undefined;
  const canUndo = game.state.moveHistory.length > 0;

  const startActiveMove = (unit: Unit) => {
    const origin = unit.getPosition();
    setActiveMove({ unitId: unit.id, origin, cursor: origin });
    setSelectedId(unit.id);
  };

  const handleUnitClick = (unit: Unit) => {
    if (unit.teamId !== active) return; // enemy clicks are a no-op for now
    if (activeMove && activeMove.unitId === unit.id) {
      // Clicking the ghost cancels the active move (per §2.4).
      setActiveMove(null);
      return;
    }
    // Clicking any other own unit (whether or not there's an active move)
    // starts a fresh active move on that unit.
    startActiveMove(unit);
  };

  const handleMapClick = (position: Point) => {
    if (!activeMove) return;
    const { unitId } = activeMove;
    dispatch((g) => g.moveUnit(unitId, position));
    setActiveMove(null);
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
    setSelectedId(undefined);
    dispatch((g) => g.endMove());
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMove(null);
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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
                <div style={{ marginTop: 8 }}>
                  <SidebarButton
                    variant="secondary"
                    onClick={() => dispatch((g) => g.toggleDugIn(selected.id))}
                  >
                    {selected.dugIn ? "Stand up" : "Dig in"}
                  </SidebarButton>
                </div>
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
              <p style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                {activeMove
                  ? "Click empty map to commit, click the ghost or press Esc to cancel."
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
          onMapClick={handleMapClick}
          onMapPointerMove={handlePointerMove}
          draggable={!activeMove}
          overlay={
            activeMove && selected
              ? (
                <MovePreviewOverlay
                  unit={selected}
                  origin={activeMove.origin}
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
