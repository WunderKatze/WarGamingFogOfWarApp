import { useState } from "react";
import type { Point, UnitSize, UnitType } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { Sidebar, SidebarButton, SidebarSection } from "../components/Sidebar.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useSelectionContext } from "../hooks/useSelectionContext.js";

const UNIT_SIZES: readonly UnitSize[] = ["Squad", "Platoon", "Company", "Battalion"];

export function DeploymentView() {
  const { game, dispatch } = useGameContext();
  const { selectedUnitId, setSelectedUnitId, setHoveredUnitId, setCursorOnMap } = useSelectionContext();
  const activePlayer = game.state.getActivePlayer();
  const ownUnits = game.state.units.filter((u) => u.teamId === activePlayer);

  // Pen settings — the kind of unit that will be placed on the next map click.
  const [penType, setPenType] = useState<UnitType>("Infantry");
  const [penSize, setPenSize] = useState<UnitSize>("Platoon");
  const [penRecon, setPenRecon] = useState(false);
  const [penDugIn, setPenDugIn] = useState(true);

  const handlePlace = (position: Point) => {
    const nextNumber = ownUnits.length + 1;
    const name = `${penType[0]}-${nextNumber}`;
    dispatch((g) =>
      g.deployUnit({
        type: penType,
        name,
        position,
        size: penSize,
        ...(penRecon && { modifiers: ["Recon"] }),
        ...(penType === "Infantry" && { dugIn: penDugIn }),
      }),
    );
    // Placement also clicks the empty map → clear selection.
    setSelectedUnitId(undefined);
  };

  const handleUnitClick = (unit: Unit) => {
    setSelectedUnitId(selectedUnitId === unit.id ? undefined : unit.id);
  };

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <Sidebar>
        <SidebarSection title="Pen">
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

        <SidebarSection title={`Deployed (${ownUnits.length})`}>
          {ownUnits.length === 0 ? (
            <p style={hintStyle}>Click on the map to place a unit.</p>
          ) : (
            <ul style={listStyle}>
              {ownUnits.map((u) => (
                <li key={u.id} style={listItemStyle}>
                  {u.name} — {u.type}, {u.size}
                  {u.hasModifier("Recon") ? " (Recon)" : ""}
                </li>
              ))}
            </ul>
          )}
        </SidebarSection>

        <SidebarButton onClick={() => dispatch((g) => g.endDeployment())}>
          End Deployment
        </SidebarButton>
      </Sidebar>
      <main style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <MapCanvas
          map={game.state.map}
          units={ownUnits}
          perspectiveTeamId={activePlayer}
          selectedUnitId={selectedUnitId}
          onUnitClick={handleUnitClick}
          onUnitHover={(u) => setHoveredUnitId(u?.id)}
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
