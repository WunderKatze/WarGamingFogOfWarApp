import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ArchetypeChoice } from "../canvas/discoveryRings.js";

/**
 * Provider for the Discovery Visualizer's session-only settings — the lens
 * the player has chosen + scope + the copy-from-hover toggle. State is
 * React-local; nothing persists across page loads (v1 scope).
 * See docs/features/discovery-visualizer.md §2 / §8.1–8.2.
 */

export type DiscoveryScope = "off" | "selected" | "all";

export interface DiscoveryVisualizerSettings {
  scope: DiscoveryScope;
  archetype: ArchetypeChoice;
  /**
   * Selected cover-modifier value for the threat. The panel's dropdown
   * derives its available values from the rules at render time; if a rule
   * edit removes the currently-selected value, the panel resets this to 1.
   */
  postureModifier: number;
  goneToGround: boolean;
  copyFromHover: boolean;
}

interface DiscoveryVisualizerContextValue {
  settings: DiscoveryVisualizerSettings;
  setScope(s: DiscoveryScope): void;
  setArchetype(a: ArchetypeChoice): void;
  setPostureModifier(m: number): void;
  setGoneToGround(on: boolean): void;
  setCopyFromHover(on: boolean): void;
}

const DEFAULTS: DiscoveryVisualizerSettings = {
  scope: "off",
  archetype: { kind: "unit", unitType: "Infantry", recon: false },
  postureModifier: 3,
  goneToGround: true,
  copyFromHover: true,
};

const DiscoveryVisualizerContext = createContext<DiscoveryVisualizerContextValue | null>(null);

export function DiscoveryVisualizerProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DiscoveryVisualizerSettings>(DEFAULTS);

  const setScope = useCallback((scope: DiscoveryScope) => {
    setSettings((s) => ({ ...s, scope }));
  }, []);
  const setArchetype = useCallback((archetype: ArchetypeChoice) => {
    setSettings((s) => ({ ...s, archetype }));
  }, []);
  const setPostureModifier = useCallback((postureModifier: number) => {
    setSettings((s) => ({ ...s, postureModifier }));
  }, []);
  const setGoneToGround = useCallback((goneToGround: boolean) => {
    setSettings((s) => ({ ...s, goneToGround }));
  }, []);
  const setCopyFromHover = useCallback((copyFromHover: boolean) => {
    setSettings((s) => ({ ...s, copyFromHover }));
  }, []);

  const value = useMemo<DiscoveryVisualizerContextValue>(
    () => ({ settings, setScope, setArchetype, setPostureModifier, setGoneToGround, setCopyFromHover }),
    [settings, setScope, setArchetype, setPostureModifier, setGoneToGround, setCopyFromHover],
  );

  return (
    <DiscoveryVisualizerContext.Provider value={value}>
      {children}
    </DiscoveryVisualizerContext.Provider>
  );
}

export function useDiscoveryVisualizerContext(): DiscoveryVisualizerContextValue {
  const ctx = useContext(DiscoveryVisualizerContext);
  if (!ctx) throw new Error("useDiscoveryVisualizerContext must be used inside a DiscoveryVisualizerProvider");
  return ctx;
}
