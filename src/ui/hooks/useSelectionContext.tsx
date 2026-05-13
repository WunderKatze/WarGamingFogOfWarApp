import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Point, UnitId } from "../../core/types.js";
import { useGameContext } from "./useGameContext.js";

/**
 * A transient position to display in place of the unit's stored position.
 * Used by the Move phase to feed its live active-move cursor into the
 * info menu so the stealth-modifier line tracks the preview, not the
 * not-yet-committed stored position.
 */
export interface PreviewPositionOverride {
  unitId: UnitId;
  position: Point;
}

interface SelectionContextValue {
  /** The unit currently locked into the info menu and ringed on the map. */
  selectedUnitId: UnitId | undefined;
  setSelectedUnitId(id: UnitId | undefined): void;
  /** The unit the cursor is currently over, when nothing is selected. */
  hoveredUnitId: UnitId | undefined;
  setHoveredUnitId(id: UnitId | undefined): void;
  /** True iff the cursor is over the map canvas (used for the info-menu idle string). */
  cursorOnMap: boolean;
  setCursorOnMap(on: boolean): void;
  /**
   * When set, the info menu displays this position (and any position-derived
   * fields like terrain stealth) for the given unit instead of the unit's
   * stored position. Cleared whenever an active preview ends.
   */
  previewPositionOverride: PreviewPositionOverride | undefined;
  setPreviewPositionOverride(o: PreviewPositionOverride | undefined): void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const { game } = useGameContext();
  const [selectedUnitId, setSelectedUnitId] = useState<UnitId | undefined>(undefined);
  const [hoveredUnitId, setHoveredUnitId] = useState<UnitId | undefined>(undefined);
  const [cursorOnMap, setCursorOnMap] = useState(false);
  const [previewPositionOverride, setPreviewPositionOverride] = useState<PreviewPositionOverride | undefined>(undefined);

  // Selection belongs to the *active player's* perspective. When the active
  // player changes — i.e. on a turn flip via the Transition screen — drop
  // any prior selection / hover so the next player doesn't see info-menu
  // leakage from the previous player's units.
  const activePlayerIndex = game.state.activePlayerIndex;
  useEffect(() => {
    setSelectedUnitId(undefined);
    setHoveredUnitId(undefined);
  }, [activePlayerIndex]);

  // Escape clears the info-menu selection regardless of phase. Phase views
  // can still layer their own Escape behavior (e.g. MoveView cancels an
  // active move) — both handlers fire and both state updates are idempotent.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      setSelectedUnitId(undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({
      selectedUnitId,
      setSelectedUnitId,
      hoveredUnitId,
      setHoveredUnitId,
      cursorOnMap,
      setCursorOnMap,
      previewPositionOverride,
      setPreviewPositionOverride,
    }),
    [selectedUnitId, hoveredUnitId, cursorOnMap, previewPositionOverride],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelectionContext(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelectionContext must be used inside a SelectionProvider");
  return ctx;
}
