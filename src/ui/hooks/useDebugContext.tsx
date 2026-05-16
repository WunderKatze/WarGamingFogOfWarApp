import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useGameContext } from "./useGameContext.js";

interface DebugContextValue {
  /**
   * Session-only "Show All Units" toggle. When true, phase views render
   * every unit on the map regardless of faction or team-detection state.
   * Does NOT modify GameState.visionState.revealed — physical-table
   * placement instructions stay correct.
   */
  showAllUnits: boolean;
  /**
   * Toggle Show All Units. Flipping it ON dispatches Game.markDebugUsed()
   * so the next player's Transition screen shows the "Debug Mode was used"
   * notice. Flipping it OFF is silent: the flag stays set for the rest of
   * the turn (the audit is "Debug Mode was used at any point").
   */
  setShowAllUnits(on: boolean): void;
}

const DebugContext = createContext<DebugContextValue | null>(null);

/**
 * Mount inside GameProvider — uses dispatch to mark the audit flag when
 * Show All Units is toggled on. Show All Units state itself is session-
 * only; a page refresh resets it to false.
 */
export function DebugProvider({ children }: { children: ReactNode }) {
  const { dispatch } = useGameContext();
  const [showAllUnits, setShowAllUnitsState] = useState(false);

  const setShowAllUnits = useCallback(
    (on: boolean) => {
      setShowAllUnitsState(on);
      if (on) dispatch((g) => g.markDebugUsed());
    },
    [dispatch],
  );

  const value = useMemo<DebugContextValue>(
    () => ({ showAllUnits, setShowAllUnits }),
    [showAllUnits, setShowAllUnits],
  );

  return <DebugContext.Provider value={value}>{children}</DebugContext.Provider>;
}

export function useDebugContext(): DebugContextValue {
  const ctx = useContext(DebugContext);
  if (!ctx) throw new Error("useDebugContext must be used inside a DebugProvider");
  return ctx;
}
