import { useState } from "react";
import type { Game } from "../../core/Game.js";
import type { Point, UnitId } from "../../core/types.js";
import { Infantry } from "../../core/units/Infantry.js";
import type { Unit } from "../../core/units/Unit.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { Sidebar, SidebarButton, SidebarSection } from "../components/Sidebar.js";
import { useGameContext } from "../hooks/useGameContext.js";

function getVisibleUnits(game: Game): Unit[] {
  const active = game.state.getActivePlayer();
  const teamList = game.state.visionState.teamLists.get(active) ?? new Set<UnitId>();
  return game.state.units.filter(
    (u) => u.teamId === active || teamList.has(u.id),
  );
}

export function MoveView() {
  const { game, dispatch } = useGameContext();
  const active = game.state.getActivePlayer();
  const [selectedId, setSelectedId] = useState<UnitId | undefined>(undefined);

  const visible = getVisibleUnits(game);
  const selected = selectedId ? game.state.getUnitById(selectedId) : undefined;

  const handleUnitClick = (unit: Unit) => {
    if (unit.teamId !== active) return; // can only select own units
    setSelectedId(unit.id);
  };

  const handleMapClick = (position: Point) => {
    if (!selectedId) return;
    dispatch((g) => g.moveUnit(selectedId, position));
  };

  const endMove = () => {
    setSelectedId(undefined);
    dispatch((g) => g.endMove());
  };

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
              <p style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                Click an empty spot on the map to move.
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
                  fontWeight: u.id === selectedId ? 600 : 400,
                  opacity: u.teamId === active ? 1 : 0.65,
                }}
              >
                {u.name} — {u.type}
                {u.teamId === active ? "" : " (enemy)"}
              </li>
            ))}
          </ul>
        </SidebarSection>

        <SidebarButton onClick={endMove}>End Move</SidebarButton>
      </Sidebar>
      <main style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <MapCanvas
          map={game.state.map}
          units={visible}
          perspectiveTeamId={active}
          selectedUnitId={selectedId}
          revealedUnitIds={game.state.visionState.revealed}
          onUnitClick={handleUnitClick}
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
