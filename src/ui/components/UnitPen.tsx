import type { CSSProperties } from "react";
import type { UnitSize, UnitType } from "../../core/types.js";
import type { UseUnitPenReturn } from "../hooks/useUnitPen.js";

/**
 * The unit sizes selectable in any pen, in the order they appear in the
 * dropdown. Exported so views that display unit metadata elsewhere
 * (e.g. a deployed-units list) can share the ordering.
 */
export const UNIT_SIZES: readonly UnitSize[] = ["Squad", "Platoon", "Company", "Battalion"];

interface UnitPenProps {
  pen: UseUnitPenReturn;
  /**
   * Called after any pen field changes. Used by DeploymentView to break
   * its clone-rhythm state (any manual edit to the pen reverts to
   * non-rhythm behavior). Other views don't need this and can omit it.
   */
  onFieldChanged?: () => void;
}

/**
 * Renders the standard unit-creation pen — name input, type select,
 * size select, Recon checkbox, dug-in checkbox. The pen owns its
 * fields' state via `useUnitPen`; this component is purely the JSX.
 *
 * Views compose this inside their own `<SidebarSection title="…">`
 * (the title differs per view: "Pen" / "Add Unit (Pen)") and own any
 * surrounding controls (Place button, primed-hint banner, etc.). The
 * pen does not own a Place button — placement is triggered by the
 * view's map-click handler calling `pen.buildParams(position)`.
 *
 * See docs/features/v2/code-health-pass-ui.md §2 U2.
 */
export function UnitPen({ pen, onFieldChanged }: UnitPenProps) {
  const { state, setters } = pen;
  const notifyChange = () => onFieldChanged?.();

  const handleType = (t: UnitType) => { setters.setType(t); notifyChange(); };
  const handleSize = (s: UnitSize) => { setters.setSize(s); notifyChange(); };
  const handleRecon = (b: boolean) => { setters.setRecon(b); notifyChange(); };
  const handleDugIn = (b: boolean) => { setters.setDugIn(b); notifyChange(); };
  const handleName = (n: string) => { setters.setName(n); notifyChange(); };

  return (
    <>
      <label style={labelStyle}>
        <span>Name</span>
        <input
          type="text"
          value={state.name}
          onChange={(e) => handleName(e.target.value)}
          placeholder="(optional)"
          style={textInputStyle}
        />
      </label>
      <label style={labelStyle}>
        <span>Type</span>
        <select
          value={state.type}
          onChange={(e) => handleType(e.target.value as UnitType)}
          style={selectStyle}
        >
          <option value="Infantry">Infantry</option>
          <option value="Tank">Tank</option>
        </select>
      </label>
      <label style={labelStyle}>
        <span>Size</span>
        <select
          value={state.size}
          onChange={(e) => handleSize(e.target.value as UnitSize)}
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
          checked={state.recon}
          onChange={(e) => handleRecon(e.target.checked)}
        />
        Recon
      </label>
      <label style={{ ...checkboxLabelStyle, opacity: state.type === "Infantry" ? 1 : 0.4 }}>
        <input
          type="checkbox"
          checked={state.dugIn}
          disabled={state.type !== "Infantry"}
          onChange={(e) => handleDugIn(e.target.checked)}
        />
        Dug-in (Infantry only)
      </label>
    </>
  );
}

const labelStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
  fontSize: 13,
};

const checkboxLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 6,
  fontSize: 13,
};

const selectStyle: CSSProperties = {
  padding: "2px 6px",
  fontSize: 13,
};

const textInputStyle: CSSProperties = {
  padding: "2px 6px",
  fontSize: 13,
  width: 120,
};
