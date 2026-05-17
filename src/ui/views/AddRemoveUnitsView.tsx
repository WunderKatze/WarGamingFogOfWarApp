import { useState } from "react";
import type { Game } from "../../core/Game.js";
import type { Point, UnitId, UnitSize, UnitType } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { computeUnitStatusBadges } from "../canvas/unitStatusBadges.js";
import { Sidebar, SidebarButton, SidebarSection } from "../components/Sidebar.js";
import { useDebugContext } from "../hooks/useDebugContext.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useSelectionContext } from "../hooks/useSelectionContext.js";

const UNIT_SIZES: readonly UnitSize[] = ["Squad", "Platoon", "Company", "Battalion"];

/**
 * View for the Add/Remove Units phase — see docs/features/mid-game-roster.md §2.3.
 *
 * Slim DeploymentView: pen for adding a unit, Selected panel with a
 * single Delete affordance for removing the selected own-unit, a
 * read-only Deployed list. No reposition (that's Move), no clone
 * (deferred), no rename (deferred). Ends with an **End Add/Remove
 * Units** button that runs the pre-Move vision phase.
 *
 * Enemy units last visible to the active team (from the previous
 * turn's vision phase) are rendered on the map for context — vision
 * doesn't run again until endAddRemoveUnits.
 */
function getVisibleUnits(game: Game, showAllUnits: boolean): Unit[] {
  if (showAllUnits) return [...game.state.units];
  const active = game.state.getActivePlayer();
  const teamList = game.state.visionState.teamLists.get(active) ?? new Set<UnitId>();
  return game.state.units.filter(
    (u) => u.teamId === active || teamList.has(u.id),
  );
}

export function AddRemoveUnitsView() {
  const { game, dispatch } = useGameContext();
  const {
    selectedUnitId,
    setSelectedUnitId,
    setHoveredUnitId,
    setHoveredTerrainHit,
    setCursorOnMap,
  } = useSelectionContext();
  const { showAllUnits } = useDebugContext();
  const activePlayer = game.state.getActivePlayer();
  const { dugInUnitIds, goneToGroundUnitIds } = computeUnitStatusBadges(game);
  const ownUnits = game.state.units.filter((u) => u.teamId === activePlayer);
  const visible = getVisibleUnits(game, showAllUnits);

  const [penType, setPenType] = useState<UnitType>("Infantry");
  const [penSize, setPenSize] = useState<UnitSize>("Platoon");
  const [penRecon, setPenRecon] = useState(false);
  const [penDugIn, setPenDugIn] = useState(false);
  const [penName, setPenName] = useState("");

  const autoName = (): string => `${penType[0]}-${ownUnits.length + 1}`;

  const handlePlace = (position: Point) => {
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
    setSelectedUnitId(undefined);
    setPenName("");
  };

  const handleUnitClick = (unit: Unit) => {
    setSelectedUnitId(selectedUnitId === unit.id ? undefined : unit.id);
  };

  const selectedUnit = selectedUnitId
    ? game.state.units.find((u) => u.id === selectedUnitId)
    : undefined;
  const selectedOwn = selectedUnit && selectedUnit.teamId === activePlayer ? selectedUnit : undefined;

  const handleDelete = () => {
    if (!selectedOwn) return;
    if (!window.confirm(`Delete ${selectedOwn.name}?`)) return;
    const id = selectedOwn.id;
    dispatch((g) => g.deleteUnit(id));
    setSelectedUnitId(undefined);
  };

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <Sidebar>
        <SidebarSection title="Add Unit (Pen)">
          <label style={labelStyle}>
            <span>Name</span>
            <input
              type="text"
              value={penName}
              onChange={(e) => setPenName(e.target.value)}
              placeholder="(optional)"
              style={textInputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Type</span>
            <select
              value={penType}
              onChange={(e) => setPenType(e.target.value as UnitType)}
              style={selectStyle}
            >
              <option value="Infantry">Infantry</option>
              <option value="Tank">Tank</option>
            </select>
          </label>
          <label style={labelStyle}>
            <span>Size</span>
            <select
              value={penSize}
              onChange={(e) => setPenSize(e.target.value as UnitSize)}
              style={selectStyle}
            >
              {UNIT_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={penRecon}
              onChange={(e) => setPenRecon(e.target.checked)}
            />
            Recon
          </label>
          <label style={{ ...checkboxLabelStyle, opacity: penType === "Infantry" ? 1 : 0.4 }}>
            <input
              type="checkbox"
              checked={penDugIn}
              disabled={penType !== "Infantry"}
              onChange={(e) => setPenDugIn(e.target.checked)}
            />
            Dug-in (Infantry only)
          </label>
        </SidebarSection>

        {selectedOwn && (
          <SidebarSection title="Selected">
            <div style={{ marginBottom: 8, fontSize: 13 }}>
              <strong>{selectedOwn.name}</strong>
              <div style={{ fontSize: 11, color: "#555" }}>
                {selectedOwn.type}, {selectedOwn.size}
                {selectedOwn.hasModifier("Recon") ? " (Recon)" : ""}
              </div>
            </div>
            <SidebarButton onClick={handleDelete} variant="secondary">Delete</SidebarButton>
          </SidebarSection>
        )}

        <SidebarSection title={`Deployed (${ownUnits.length})`}>
          {ownUnits.length === 0 ? (
            <p style={hintStyle}>No units. Click the map to add one.</p>
          ) : (
            <ul style={listStyle}>
              {ownUnits.map((u) => (
                <li key={u.id} style={listItemStyle}>
                  <strong>{u.name}</strong>
                  <span style={listItemMetaStyle}>
                    {" — "}{u.type}, {u.size}
                    {u.hasModifier("Recon") ? " (Recon)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SidebarSection>

        <SidebarButton onClick={() => dispatch((g) => g.endAddRemoveUnits())}>
          End Add/Remove Units
        </SidebarButton>
      </Sidebar>
      <main style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <MapCanvas
          map={game.state.map}
          units={visible}
          perspectiveTeamId={activePlayer}
          selectedUnitId={selectedUnitId}
          dugInUnitIds={dugInUnitIds}
          goneToGroundUnitIds={goneToGroundUnitIds}
          onUnitClick={handleUnitClick}
          onUnitHover={(u) => setHoveredUnitId(u?.id)}
          onHoveredTerrainChange={setHoveredTerrainHit}
          onCursorOnMapChange={setCursorOnMap}
          onMapClick={handlePlace}
        />
      </main>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
  fontSize: 13,
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 6,
  fontSize: 13,
};

const selectStyle: React.CSSProperties = {
  padding: "2px 6px",
  fontSize: 13,
};

const textInputStyle: React.CSSProperties = {
  padding: "2px 6px",
  fontSize: 13,
  width: 120,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  margin: 0,
};

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

const listItemMetaStyle: React.CSSProperties = {
  color: "#555",
};
