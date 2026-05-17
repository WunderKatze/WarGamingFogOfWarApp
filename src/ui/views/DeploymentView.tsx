import { useEffect, useState, type CSSProperties } from "react";
import type { Point, UnitSize, UnitType } from "../../core/types.js";
import { Infantry } from "../../core/units/Infantry.js";
import type { Unit } from "../../core/units/Unit.js";
import { MapCanvas } from "../canvas/MapCanvas.js";
import { Sidebar, SidebarButton, SidebarSection } from "../components/Sidebar.js";
import { nextCloneName } from "../components/nextCloneName.js";
import { useDebugContext } from "../hooks/useDebugContext.js";
import { useGameContext } from "../hooks/useGameContext.js";
import { useSelectionContext } from "../hooks/useSelectionContext.js";

const UNIT_SIZES: readonly UnitSize[] = ["Squad", "Platoon", "Company", "Battalion"];

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
  const ownUnits = game.state.units.filter((u) => u.teamId === activePlayer);
  const visible = showAllUnits ? [...game.state.units] : ownUnits;

  // Pen settings — the kind of unit that will be placed on the next map click.
  const [penType, setPenType] = useState<UnitType>("Infantry");
  const [penSize, setPenSize] = useState<UnitSize>("Platoon");
  const [penRecon, setPenRecon] = useState(false);
  const [penDugIn, setPenDugIn] = useState(true);
  // Optional name for the next placement. Empty = auto-generate (`I-3`).
  // Bumped automatically after each placement while in clone rhythm,
  // cleared otherwise.
  const [penName, setPenName] = useState("");

  // When set, the next map click moves this unit instead of placing a new
  // one. Cleared on placement, Escape, or selection change to a different
  // unit (where it re-primes for the new target).
  const [repositionPrimedUnitId, setRepositionPrimedUnitId] = useState<string | undefined>(undefined);

  // Set true by the Clone button. While true, normal placements auto-bump
  // penName to the next available clone-name; any manual edit to a pen
  // field breaks rhythm and reverts to normal behavior.
  const [inCloneRhythm, setInCloneRhythm] = useState(false);

  // Inline rename in the Deployed list.
  const [renamingUnitId, setRenamingUnitId] = useState<string | undefined>(undefined);
  const [renameDraft, setRenameDraft] = useState("");

  const breakCloneRhythm = () => setInCloneRhythm(false);

  // Pen-field setters that break clone rhythm. Wrapping is preferable to
  // sprinkling break-calls into each input's onChange — keeps the rhythm
  // invariant local to one place.
  const setPenTypeAndBreak = (t: UnitType) => { setPenType(t); breakCloneRhythm(); };
  const setPenSizeAndBreak = (s: UnitSize) => { setPenSize(s); breakCloneRhythm(); };
  const setPenReconAndBreak = (v: boolean) => { setPenRecon(v); breakCloneRhythm(); };
  const setPenDugInAndBreak = (v: boolean) => { setPenDugIn(v); breakCloneRhythm(); };
  const setPenNameAndBreak = (n: string) => { setPenName(n); breakCloneRhythm(); };

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

  const autoName = (): string => `${penType[0]}-${ownUnits.length + 1}`;

  const handlePlace = (position: Point) => {
    if (repositionPrimedUnitId) {
      const targetId = repositionPrimedUnitId;
      dispatch((g) => g.repositionDeployedUnit(targetId, position));
      setRepositionPrimedUnitId(undefined);
      return;
    }
    const placedName = penName.trim() === "" ? autoName() : penName.trim();
    dispatch((g) =>
      g.deployUnit({
        type: penType,
        name: placedName,
        position,
        size: penSize,
        ...(penRecon && { modifiers: ["Recon"] }),
        ...(penType === "Infantry" && { dugIn: penDugIn }),
      }),
    );
    setSelectedUnitId(undefined);
    if (inCloneRhythm) {
      // Bump for the next click. ownUnits doesn't include the just-placed
      // unit yet (state hasn't re-rendered), so include placedName
      // explicitly in the "taken" set.
      const taken = [...ownUnits.map((u) => u.name), placedName];
      setPenName(nextCloneName(placedName, taken));
    } else {
      setPenName("");
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
    setPenType(selectedOwn.type);
    setPenSize(selectedOwn.size);
    setPenRecon(selectedOwn.hasModifier("Recon"));
    setPenDugIn(selectedOwn instanceof Infantry ? selectedOwn.dugIn : true);
    setPenName(nextCloneName(selectedOwn.name, ownUnits.map((u) => u.name)));
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
          <label style={labelStyle}>
            <span>Name</span>
            <input
              type="text"
              value={penName}
              onChange={(e) => setPenNameAndBreak(e.target.value)}
              placeholder="(optional)"
              style={textInputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Type</span>
            <select
              value={penType}
              onChange={(e) => setPenTypeAndBreak(e.target.value as UnitType)}
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
              onChange={(e) => setPenSizeAndBreak(e.target.value as UnitSize)}
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
              onChange={(e) => setPenReconAndBreak(e.target.checked)}
            />
            Recon
          </label>
          <label style={{ ...checkboxLabelStyle, opacity: penType === "Infantry" ? 1 : 0.4 }}>
            <input
              type="checkbox"
              checked={penDugIn}
              disabled={penType !== "Infantry"}
              onChange={(e) => setPenDugInAndBreak(e.target.checked)}
            />
            Dug-in (Infantry only)
          </label>
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
  display: "flex",
  alignItems: "center",
  gap: 2,
  flexWrap: "wrap",
};

const listItemMetaStyle: React.CSSProperties = {
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
