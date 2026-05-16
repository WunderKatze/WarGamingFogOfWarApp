import {
  dugInStealthModifier as defaultDugInStealthModifier,
  modifierEffects as defaultModifierEffects,
  polygonStealthModifier as defaultPolygonStealthModifier,
  shortWallStealthModifier as defaultShortWallStealthModifier,
  tallWoodsRayThroughLimit as defaultTallWoodsRayThroughLimit,
  unitTypeStats as defaultUnitTypeStats,
  type ModifierEffects,
  type UnitTypeStats,
} from "./config.js";
import type { Modifier, PolygonTerrainType, UnitType } from "./types.js";

/**
 * Runtime-mutable game rules.
 *
 * Every numeric tunable that used to be a `const` import from `config.ts` is
 * now held on a single mutable `Rules` object accessed through `getRules()`.
 * Consumers must read at call time — never capture values at module load —
 * so a rule change takes effect on the next read.
 *
 * `config.ts` is the canonical source of *default* values: `defaultRules` is
 * built from it. The `Rules` object is what production reads consult; the
 * config consts now act exclusively as the defaults baseline that
 * `resetRules()` restores.
 *
 * See `docs/features/game-menu.md` §8.1 for the design context.
 */

export interface Rules {
  unitTypeStats: Record<UnitType, UnitTypeStats>;
  modifierEffects: Record<Modifier, ModifierEffects>;
  dugInStealthModifier: number;
  polygonStealthModifier: Record<PolygonTerrainType, number>;
  shortWallStealthModifier: number;
  tallWoodsRayThroughLimit: number;
}

export const defaultRules: Rules = Object.freeze({
  unitTypeStats: structuredClone(defaultUnitTypeStats),
  modifierEffects: structuredClone(defaultModifierEffects),
  dugInStealthModifier: defaultDugInStealthModifier,
  polygonStealthModifier: structuredClone(defaultPolygonStealthModifier),
  shortWallStealthModifier: defaultShortWallStealthModifier,
  tallWoodsRayThroughLimit: defaultTallWoodsRayThroughLimit,
});

let currentRules: Rules = structuredClone(defaultRules);
const listeners = new Set<() => void>();

/**
 * The currently-active rule values. Always read freshly inside a method;
 * caching the returned object across calls defeats the live-update property.
 */
export function getRules(): Rules {
  return currentRules;
}

/**
 * Merge new values into the current rules (shallow at the top level, by
 * design — callers pass a fully-formed sub-object like
 * `{ polygonStealthModifier: { ...current, Building: 4 } }` when only a
 * single nested value changes). Notifies subscribers after the swap.
 */
export function setRules(partial: Partial<Rules>): void {
  currentRules = { ...currentRules, ...partial };
  notify();
}

/** Restore the built-in defaults. Notifies subscribers. */
export function resetRules(): void {
  currentRules = structuredClone(defaultRules);
  notify();
}

/**
 * Subscribe to rule changes. Returns an unsubscribe function. Used by the
 * UI's RulesProvider to trigger React re-renders when rules mutate.
 */
export function subscribeRules(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(): void {
  for (const fn of listeners) fn();
}
