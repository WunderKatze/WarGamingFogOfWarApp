import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useGameContext } from "../hooks/useGameContext.js";
import { useMapEditorContext } from "../hooks/useMapEditorContext.js";
import { theme } from "../theme.js";
import { DebugPanel } from "./DebugPanel.js";
import { RulesEditor } from "./RulesEditor.js";

/**
 * Top-right dropdown that consolidates app-level affordances: Restart,
 * Edit map (placeholder for the map-creator feature), Load game
 * (placeholder for save/load), Adjust Vision Rules (sub-panel — empty
 * in this checkpoint, filled in next), and Debug options (sub-panel —
 * same).
 *
 * Hidden on the Transition screen, paralleling the info menu rule.
 * Closes on outside click, Escape, or selecting a top-level action.
 *
 * See `docs/features/game-menu.md`.
 */
export function GameMenu() {
  const { game, reset } = useGameContext();
  const { open: openMapEditor, isOpen: isMapEditorOpen } = useMapEditorContext();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>("root");
  const containerRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setIsOpen(false);
    setView("root");
  };

  // Escape closes the menu — does not bubble down into phase-view Escape
  // handlers because both can run; closing the menu is the higher-priority
  // interpretation when it's open.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // Outside click closes. mousedown (not click) so it fires before any
  // would-be map click registers underneath.
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [isOpen]);

  // Hidden during Transition and while the map editor owns the view —
  // both screens have their own chrome and shouldn't be cluttered.
  if (game.state.phase === "Transition") return null;
  if (isMapEditorOpen) return null;

  const handleRestart = () => {
    close();
    if (window.confirm("Restart game? All units and turn progress will be lost.")) {
      reset();
    }
  };

  const handleEditMap = () => {
    close();
    openMapEditor();
  };

  const placeholderAlert = (label: string) => {
    window.alert(`${label} comes in a later release.`);
    close();
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        style={buttonStyle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        ☰ Menu
      </button>
      {isOpen && (
        <div style={panelStyle} role="menu">
          {view === "root" && (
            <>
              <MenuItem onClick={handleRestart}>Restart game</MenuItem>
              <MenuItem onClick={handleEditMap}>Edit map</MenuItem>
              <MenuItem onClick={() => placeholderAlert("Save / Load games")}>Load game</MenuItem>
              <MenuItem onClick={() => setView("vision")}>Adjust Vision Rules ▸</MenuItem>
              <MenuItem onClick={() => setView("debug")}>Debug options ▸</MenuItem>
            </>
          )}
          {view === "vision" && (
            <SubPanel title="Adjust Vision Rules" onBack={() => setView("root")}>
              <RulesEditor />
            </SubPanel>
          )}
          {view === "debug" && (
            <SubPanel title="Debug options" onBack={() => setView("root")}>
              <DebugPanel />
            </SubPanel>
          )}
        </div>
      )}
    </div>
  );
}

type View = "root" | "vision" | "debug";

function MenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={menuItemStyle} role="menuitem">
      {children}
    </button>
  );
}

function SubPanel({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div style={subPanelHeaderStyle}>
        <button type="button" onClick={onBack} style={backButtonStyle}>
          ← Back
        </button>
        <span style={subPanelTitleStyle}>{title}</span>
      </div>
      <div style={subPanelBodyStyle}>{children}</div>
    </>
  );
}

const containerStyle: CSSProperties = {
  position: "fixed",
  top: theme.spacing.lg,
  right: theme.spacing.lg,
  zIndex: 1000,
};

const buttonStyle: CSSProperties = {
  padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
  background: "rgba(255,255,255,0.92)",
  color: theme.colors.text,
  border: `1px solid ${theme.colors.sidebarBorder}`,
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.sm,
  cursor: "pointer",
  fontWeight: 600,
};

const panelStyle: CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: theme.spacing.sm,
  minWidth: 240,
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.sidebarBorder}`,
  borderRadius: theme.radius.md,
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  padding: theme.spacing.xs,
  display: "flex",
  flexDirection: "column",
};

const menuItemStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: `${theme.spacing.sm + 2}px ${theme.spacing.md}px`,
  background: "transparent",
  color: theme.colors.text,
  border: "none",
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.base,
  cursor: "pointer",
};

const subPanelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.md,
  padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
  borderBottom: `1px solid ${theme.colors.subtleBorder}`,
};

const subPanelTitleStyle: CSSProperties = {
  fontSize: theme.fontSize.sm,
  fontWeight: 600,
  color: theme.colors.textMuted,
};

const backButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: theme.colors.text,
  fontSize: theme.fontSize.sm,
  cursor: "pointer",
  padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
};

const subPanelBodyStyle: CSSProperties = {
  padding: theme.spacing.md,
};
