import type { CSSProperties } from "react";
import type { Point } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { DiscoveryVisualizerOverlay } from "../canvas/DiscoveryVisualizerOverlay.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { computeUnitStatusBadges } from "../canvas/unitStatusBadges.js";
import { Sidebar, SidebarButton, SidebarSection } from "../components/Sidebar.js";
import { UnitPen } from "../components/UnitPen.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useSelectionContext } from "../hooks/useSelectionContext.js";
import { useUnitPen } from "../hooks/useUnitPen.js";
import { useVisibleUnits } from "../hooks/useVisibleUnits.js";

/**
 * View for the Add/Remove Units phase — see docs/features/v1/mid-game-roster.md §2.3.
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
export function AddRemoveUnitsView() {
  const { game, dispatch } = useGameContext();
  const {
    selectedUnitId,
    setSelectedUnitId,
    setHoveredUnitId,
    setHoveredTerrainHit,
    setCursorOnMap,
  } = useSelectionContext();
  const activePlayer = game.state.getActivePlayer();
  const { dugInUnitIds, goneToGroundUnitIds } = computeUnitStatusBadges(game);
  const ownUnits = game.state.units.filter((u) => u.teamId === activePlayer);
  const visible = useVisibleUnits();

  const pen = useUnitPen({ ownUnitCount: ownUnits.length });

  const handlePlace = (position: Point) => {
    dispatch((g) => g.createUnit(pen.buildParams(position)));
    setSelectedUnitId(undefined);
    pen.clearName();
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
          <UnitPen pen={pen} />
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
          overlay={<DiscoveryVisualizerOverlay perspectiveTeamId={activePlayer} />}
        />
      </main>
    </div>
  );
}

const hintStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  margin: 0,
};

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  fontSize: 12,
};

const listItemStyle: CSSProperties = {
  padding: "3px 0",
  borderBottom: "1px solid #eee",
};

const listItemMetaStyle: CSSProperties = {
  color: "#555",
};
