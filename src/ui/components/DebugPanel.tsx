import type { CSSProperties } from "react";
import { useDebugContext } from "../hooks/useDebugContext.js";
import { theme } from "../theme.js";

/**
 * Debug options sub-panel of the Game menu. Currently hosts a single
 * toggle: Show All Units. See `docs/features/game-menu.md` §2.4.
 *
 * Toggling on marks `GameState.debugUsedThisTurn = true` so the next
 * player's Transition screen surfaces a notice. Toggling off does NOT
 * clear the flag — the audit is "Debug Mode was used at any point this
 * turn," not "is currently on."
 */
export function DebugPanel() {
  const { showAllUnits, setShowAllUnits } = useDebugContext();
  return (
    <div style={panelStyle}>
      <label style={toggleRowStyle}>
        <input
          type="checkbox"
          checked={showAllUnits}
          onChange={(e) => setShowAllUnits(e.target.checked)}
        />
        <span>Show all units</span>
      </label>
      <p style={hintStyle}>
        Renders every unit on the map regardless of faction or detection.
        Does <strong>not</strong> reveal hidden units or change physical-table
        instructions — view-only.
      </p>
      <p style={warningStyle}>
        ⚠ Using this flips a flag on the game state. The next player will see
        a notice on the Transition screen that Debug Mode was used.
      </p>
    </div>
  );
}

const panelStyle: CSSProperties = {
  width: 280,
  padding: theme.spacing.md,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.sm,
};

const toggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  fontSize: theme.fontSize.base,
  cursor: "pointer",
  userSelect: "none",
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.fontSize.sm,
  color: theme.colors.textMuted,
};

const warningStyle: CSSProperties = {
  margin: 0,
  padding: theme.spacing.sm,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text,
  background: "#fff8e0",
  border: "1px solid #e6c660",
  borderRadius: theme.radius.sm,
};
