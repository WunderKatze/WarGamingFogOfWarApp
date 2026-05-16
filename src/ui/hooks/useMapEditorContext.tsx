import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface MapEditorContextValue {
  /** True when the editor is taking over the main view area. */
  isOpen: boolean;
  open(): void;
  close(): void;
}

const MapEditorContext = createContext<MapEditorContextValue | null>(null);

/**
 * Provider for the map editor's open/close state. Mount alongside the
 * other UI providers in `App.tsx`. The editor's *working-draft* state is
 * local to `MapEditor` itself (seeded from the current game's map at
 * mount, discarded on unmount). This provider just answers "is the
 * editor showing right now?" so the router knows whether to render the
 * phase view or the editor.
 *
 * See `docs/features/map-editor.md` §7.1.
 */
export function MapEditorProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo<MapEditorContextValue>(
    () => ({ isOpen, open, close }),
    [isOpen, open, close],
  );
  return <MapEditorContext.Provider value={value}>{children}</MapEditorContext.Provider>;
}

export function useMapEditorContext(): MapEditorContextValue {
  const ctx = useContext(MapEditorContext);
  if (!ctx) throw new Error("useMapEditorContext must be used inside a MapEditorProvider");
  return ctx;
}
