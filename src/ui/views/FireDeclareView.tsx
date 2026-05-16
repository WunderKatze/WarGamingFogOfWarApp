import type { Game } from "../../core/Game.js";
import type { UnitId } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { Sidebar, SidebarButton, SidebarSection } from "../components/Sidebar.js";
import { useDebugContext } from "../hooks/useDebugContext.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useSelectionContext } from "../hooks/useSelectionContext.js";

function getVisibleUnits(game: Game, showAllUnits: boolean): Unit[] {
  if (showAllUnits) return [...game.state.units];
  const active = game.state.getActivePlayer();
  const teamList = game.state.visionState.teamLists.get(active) ?? new Set<UnitId>();
  return game.state.units.filter(
    (u) => u.teamId === active || teamList.has(u.id),
  );
}

export function FireDeclareView() {
  const { game, dispatch } = useGameContext();
  const {
    selectedUnitId,
    setSelectedUnitId,
    setHoveredUnitId,
    setHoveredTerrainHit,
    setCursorOnMap,
  } = useSelectionContext();
  const { showAllUnits } = useDebugContext();
  const active = game.state.getActivePlayer();
  const visible = getVisibleUnits(game, showAllUnits);
  const fired = game.state.firedThisTurn;

  const handleUnitClick = (unit: Unit) => {
    // Selection toggles on every visible unit, own or enemy.
    setSelectedUnitId(selectedUnitId === unit.id ? undefined : unit.id);
    // Own-unit click additionally toggles fire-declaration for the turn.
    if (unit.teamId === active) {
      dispatch((g) => g.toggleFire(unit.id));
    }
  };

  const handleMapClick = () => {
    setSelectedUnitId(undefined);
  };

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <Sidebar>
        <SidebarSection title="Declare fire">
          <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>
            Tap your units that fired this turn. They'll be Revealed at end of turn.
          </p>
        </SidebarSection>

        <SidebarSection title={`Fired (${fired.size})`}>
          {fired.size === 0 ? (
            <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>None.</p>
          ) : (
            <ul style={listStyle}>
              {[...fired].map((id) => {
                const u = game.state.getUnitById(id);
                return (
                  <li key={id} style={listItemStyle}>
                    {u?.name ?? id}
                  </li>
                );
              })}
            </ul>
          )}
        </SidebarSection>

        <SidebarButton onClick={() => dispatch((g) => g.endTurn())}>
          End Turn
        </SidebarButton>
      </Sidebar>
      <main style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <MapCanvas
          map={game.state.map}
          units={visible}
          perspectiveTeamId={active}
          selectedUnitId={selectedUnitId}
          firedUnitIds={fired}
          revealedUnitIds={game.state.visionState.revealed}
          onUnitClick={handleUnitClick}
          onUnitHover={(u) => setHoveredUnitId(u?.id)}
          onHoveredTerrainChange={setHoveredTerrainHit}
          onCursorOnMapChange={setCursorOnMap}
          onMapClick={handleMapClick}
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
