import type { CSSProperties } from "react";
import { useMapEditorContext } from "../hooks/useMapEditorContext.js";
import { theme } from "../theme.js";

/**
 * Map editor view. Takes over the main view area while open
 * (see `MapEditorProvider`). Stage 1 — draw-direct polygons / walls
 * on a blank rectangle, save / load JSON, Apply restarts the game.
 *
 * This checkpoint ships only the shell. Toolbox, canvas, file I/O,
 * and Apply land in subsequent commits.
 *
 * See `docs/features/map-editor.md`.
 */
export function MapEditor() {
  const { close } = useMapEditorContext();
  return (
    <div style={containerStyle}>
      <div style={shellStyle}>
        <h2 style={titleStyle}>Map editor</h2>
        <p style={hintStyle}>
          Drawing tools land in the next commit. This is the shell — Apply,
          Cancel, and the toolbox will appear here.
        </p>
        <div style={footerStyle}>
          <button type="button" onClick={close} style={buttonStyle}>
            Close (no changes)
          </button>
        </div>
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fafafa",
  padding: theme.spacing.xl,
};

const shellStyle: CSSProperties = {
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.sidebarBorder}`,
  borderRadius: theme.radius.md,
  padding: theme.spacing.xxl,
  maxWidth: 480,
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.lg,
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.fontSize.xl,
  color: theme.colors.text,
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.fontSize.sm,
  color: theme.colors.textMuted,
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
};

const buttonStyle: CSSProperties = {
  padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
  background: theme.colors.primary,
  color: "#fff",
  border: "none",
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.base,
  fontWeight: 600,
  cursor: "pointer",
};
