import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TerrainPolygon } from "../../core/map/TerrainPolygon.js";
import type { TerrainWall } from "../../core/map/TerrainWall.js";
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

/**
 * The terrain feature currently under the cursor — emitted by Konva hover
 * events on the rendered TerrainPolygonShape / TerrainWallShape. If the
 * cursor is over the map background with no terrain underneath, this is
 * undefined; combine with `cursorOnMap` to distinguish "open ground" from
 * "cursor off-map entirely."
 */
export type TerrainHit =
  | { kind: "polygon"; polygon: TerrainPolygon }
  | { kind: "wall"; wall: TerrainWall };

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
   * The polygon or wall the cursor is currently over. Undefined when the
   * cursor is on open ground or off-map. Driven by Konva mouseEnter/Leave
   * on the rendered terrain shapes — no JS hit-testing.
   */
  hoveredTerrainHit: TerrainHit | undefined;
  setHoveredTerrainHit(hit: TerrainHit | undefined): void;
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
  const [hoveredTerrainHit, setHoveredTerrainHit] = useState<TerrainHit | undefined>(undefined);
  const [previewPositionOverride, setPreviewPositionOverride] = useState<PreviewPositionOverride | undefined>(undefined);

  // Selection belongs to the *active player's* perspective. When the active
  // player changes — i.e. on a turn flip via the Transition screen — drop
  // any prior selection / hover so the next player doesn't see info-menu
  // leakage from the previous player's units.
  const activePlayerIndex = game.state.activePlayerIndex;
  useEffect(() => {
    setSelectedUnitId(undefined);
    setHoveredUnitId(undefined);
    setHoveredTerrainHit(undefined);
  }, [activePlayerIndex]);

  // Cursor leaving the canvas implies there's nothing under it.
  useEffect(() => {
    if (!cursorOnMap) setHoveredTerrainHit(undefined);
  }, [cursorOnMap]);

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
      hoveredTerrainHit,
      setHoveredTerrainHit,
      previewPositionOverride,
      setPreviewPositionOverride,
    }),
    [selectedUnitId, hoveredUnitId, cursorOnMap, hoveredTerrainHit, previewPositionOverride],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelectionContext(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelectionContext must be used inside a SelectionProvider");
  return ctx;
}
