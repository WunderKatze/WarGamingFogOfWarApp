import { useEffect, useState, type CSSProperties } from "react";
import type { Point } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { computeUnitStatusBadges } from "../canvas/unitStatusBadges.js";
import { Sidebar, SidebarButton, SidebarSection } from "../components/Sidebar.js";
import { UnitPen } from "../components/UnitPen.js";
import { nextCloneName } from "../components/nextCloneName.js";
import { useDebugContext } from "../hooks/useDebugContext.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useSelectionContext } from "../hooks/useSelectionContext.js";
import { useUnitPen } from "../hooks/useUnitPen.js";

export function DeploymentView() {
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
  const visible = showAllUnits ? [...game.state.units] : ownUnits;

  // Deployment-phase pen defaults to Infantry, Platoon, no Recon, dug-in.
  // The dug-in default reflects deployed units starting "settled" per
  // vision-rules-tweaks §2.3.
  const pen = useUnitPen({
    ownUnitCount: ownUnits.length,
    defaults: { dugIn: true },
  });

  // When set, the next map click moves this unit instead of placing a new
  // one. Cleared on placement, Escape, or selection change to a different
  // unit (where it re-primes for the new target).
  const [repositionPrimedUnitId, setRepositionPrimedUnitId] = useState<string | undefined>(undefined);

  // Set true by the Clone button. While true, normal placements auto-bump
  // the pen name to the next available clone-name; any manual edit to a pen
  // field breaks rhythm and reverts to normal behavior.
  const [inCloneRhythm, setInCloneRhythm] = useState(false);

  // Inline rename in the Deployed list.
  const [renamingUnitId, setRenamingUnitId] = useState<string | undefined>(undefined);
  const [renameDraft, setRenameDraft] = useState("");

  const breakCloneRhythm = () => setInCloneRhythm(false);

  // Selecting a different unit while reposition was primed for the prior
  // one re-primes for the new selection (intuitive: "now I want to move
  // *this* one instead"). Selecting nothing cancels priming.
  useEffect(() => {
    if (repositionPrimedUnitId && repositionPrimedUnitId !== selectedUnitId) {
      setRepositionPrimedUnitId(undefined);
    }
  }, [selectedUnitId, repositionPrimedUnitId]);

  // Escape: cancels reposition and breaks clone rhythm. The inline-rename
  // input handles its own Escape via onKeyDown so the listener here only
  // fires when no rename input is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      setRepositionPrimedUnitId(undefined);
      setInCloneRhythm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handlePlace = (position: Point) => {
    if (repositionPrimedUnitId) {
      const targetId = repositionPrimedUnitId;
      dispatch((g) => g.repositionDeployedUnit(targetId, position));
      setRepositionPrimedUnitId(undefined);
      return;
    }
    const params = pen.buildParams(position);
    dispatch((g) => g.deployUnit(params));
    setSelectedUnitId(undefined);
    if (inCloneRhythm) {
      // Bump for the next click. ownUnits doesn't include the just-placed
      // unit yet (state hasn't re-rendered), so include params.name
      // explicitly in the "taken" set. pen.setters.setName is the raw
      // setter — it doesn't trigger onFieldChanged, so rhythm stays on.
      const taken = [...ownUnits.map((u) => u.name), params.name];
      pen.setters.setName(nextCloneName(params.name, taken));
    } else {
      pen.clearName();
    }
  };

  const handleUnitClick = (unit: Unit) => {
    setSelectedUnitId(selectedUnitId === unit.id ? undefined : unit.id);
  };

  const selectedUnit = selectedUnitId
    ? game.state.units.find((u) => u.id === selectedUnitId)
    : undefined;
  const selectedOwn = selectedUnit && selectedUnit.teamId === activePlayer ? selectedUnit : undefined;

  const handleMove = () => {
    if (!selectedOwn) return;
    setRepositionPrimedUnitId(selectedOwn.id);
    setInCloneRhythm(false);
  };

  const handleDelete = () => {
    if (!selectedOwn) return;
    if (!window.confirm(`Delete ${selectedOwn.name}?`)) return;
    const id = selectedOwn.id;
    dispatch((g) => g.deleteUnit(id));
    setSelectedUnitId(undefined);
    if (repositionPrimedUnitId === id) setRepositionPrimedUnitId(undefined);
  };

  const handleClone = () => {
    if (!selectedOwn) return;
    pen.loadFromUnit(selectedOwn);
    pen.setters.setName(nextCloneName(selectedOwn.name, ownUnits.map((u) => u.name)));
    setInCloneRhythm(true);
    setRepositionPrimedUnitId(undefined);
  };

  const startRename = (unit: Unit) => {
    setRenamingUnitId(unit.id);
    setRenameDraft(unit.name);
  };
  const commitRename = () => {
    if (!renamingUnitId) return;
    const id = renamingUnitId;
    const trimmed = renameDraft.trim();
    setRenamingUnitId(undefined);
    if (trimmed === "") return; // treat blank as cancel
    const current = game.state.units.find((u) => u.id === id);
    if (!current || current.name === trimmed) return;
    dispatch((g) => g.renameUnit(id, trimmed));
  };
  const cancelRename = () => {
    setRenamingUnitId(undefined);
    setRenameDraft("");
  };

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <Sidebar>
        <SidebarSection title="Pen">
          <UnitPen pen={pen} onFieldChanged={breakCloneRhythm} />
        </SidebarSection>

        {selectedOwn && (
          <SidebarSection title="Selected">
            <div style={selectedHeaderStyle}>
              <strong>{selectedOwn.name}</strong>
              <span style={selectedSubStyle}>
                {selectedOwn.type}, {selectedOwn.size}
                {selectedOwn.hasModifier("Recon") ? " (Recon)" : ""}
              </span>
            </div>
            {repositionPrimedUnitId === selectedOwn.id ? (
              <p style={primedHintStyle}>
                Click on the map to move <strong>{selectedOwn.name}</strong>. Escape to cancel.
              </p>
            ) : null}
            <div style={selectedButtonsStyle}>
              <SidebarButton onClick={handleMove} variant="secondary">Move…</SidebarButton>
              <SidebarButton onClick={handleClone} variant="secondary">Clone</SidebarButton>
              <SidebarButton onClick={handleDelete} variant="secondary">Delete</SidebarButton>
            </div>
          </SidebarSection>
        )}

        <SidebarSection title={`Deployed (${ownUnits.length})`}>
          {ownUnits.length === 0 ? (
            <p style={hintStyle}>Click on the map to place a unit.</p>
          ) : (
            <ul style={listStyle}>
              {ownUnits.map((u) => (
                <li key={u.id} style={listItemStyle}>
                  {renamingUnitId === u.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRename();
                        }
                      }}
                      style={renameInputStyle}
                    />
                  ) : (
                    <span
                      onClick={() => startRename(u)}
                      style={nameClickableStyle}
                      title="Click to rename"
                    >
                      {u.name}
                    </span>
                  )}
                  <span style={listItemMetaStyle}>
                    {" — "}{u.type}, {u.size}
                    {u.hasModifier("Recon") ? " (Recon)" : ""}
                  </span>
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
  display: "flex",
  alignItems: "center",
  gap: 2,
  flexWrap: "wrap",
};

const listItemMetaStyle: CSSProperties = {
  color: "#555",
};

const nameClickableStyle: CSSProperties = {
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "underline dotted",
  textUnderlineOffset: 2,
};

const renameInputStyle: CSSProperties = {
  padding: "1px 4px",
  fontSize: 12,
  width: 110,
  fontWeight: 600,
};

const selectedHeaderStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  marginBottom: 8,
  fontSize: 13,
};

const selectedSubStyle: CSSProperties = {
  fontSize: 11,
  color: "#555",
};

const selectedButtonsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const primedHintStyle: CSSProperties = {
  background: "#fef3c7",
  border: "1px solid #f59e0b",
  borderRadius: 3,
  padding: "6px 8px",
  margin: "0 0 8px 0",
  fontSize: 12,
  color: "#78350f",
};
