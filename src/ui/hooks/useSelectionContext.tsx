import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { UnitId } from "../../core/types.js";

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
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedUnitId, setSelectedUnitId] = useState<UnitId | undefined>(undefined);
  const [hoveredUnitId, setHoveredUnitId] = useState<UnitId | undefined>(undefined);
  const [cursorOnMap, setCursorOnMap] = useState(false);

  const value = useMemo<SelectionContextValue>(
    () => ({
      selectedUnitId,
      setSelectedUnitId,
      hoveredUnitId,
      setHoveredUnitId,
      cursorOnMap,
      setCursorOnMap,
    }),
    [selectedUnitId, hoveredUnitId, cursorOnMap],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelectionContext(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelectionContext must be used inside a SelectionProvider");
  return ctx;
}
