import { useState } from "react";
import type { CreateUnitParams } from "../../core/Game.js";
import type { Point, UnitSize, UnitType } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";

/**
 * Initial values for the pen's fields. Each view configures its own
 * defaults: Deploy starts Infantry dug-in; mid-game pens start
 * not-dug-in. Fields the caller doesn't specify fall back to safe
 * defaults (Infantry / Platoon / no Recon / not dug-in / empty name).
 */
export interface UnitPenDefaults {
  type?: UnitType;
  size?: UnitSize;
  recon?: boolean;
  dugIn?: boolean;
  name?: string;
}

export interface UseUnitPenOptions {
  /** Used for auto-generated names like "I-3" / "T-2". */
  ownUnitCount: number;
  defaults?: UnitPenDefaults;
}

/**
 * The current pen state, exposed for the rendering component to read.
 * Setters live separately in `setters`.
 */
export interface UnitPenState {
  type: UnitType;
  size: UnitSize;
  recon: boolean;
  dugIn: boolean;
  name: string;
}

export interface UnitPenSetters {
  setType(t: UnitType): void;
  setSize(s: UnitSize): void;
  setRecon(b: boolean): void;
  setDugIn(b: boolean): void;
  setName(n: string): void;
}

export interface UseUnitPenReturn {
  state: UnitPenState;
  setters: UnitPenSetters;
  /** Build CreateUnitParams using the pen's current state at the given position. */
  buildParams(position: Point): CreateUnitParams;
  /** Auto-generated name based on type + ownUnitCount, e.g. "I-3". */
  autoName(): string;
  /**
   * Populate the pen's type / size / recon / dugIn from an existing unit
   * (the Clone affordance). Does NOT touch the name field — the caller
   * sets the name separately (e.g. via `setters.setName(nextCloneName(…))`).
   * For non-Infantry sources, the pen's dugIn stays at its current value
   * since the source has no dugIn state to copy.
   */
  loadFromUnit(unit: Unit): void;
  /** Reset the name field to empty. Useful after a non-clone placement. */
  clearName(): void;
}

/**
 * State + helpers for a unit-creation pen. Each view that creates units
 * (DeploymentView / MoveView / AddRemoveUnitsView) gets its own instance
 * via this hook; the `<UnitPen>` component renders the form fields off
 * the returned state.
 *
 * The split between this hook and the component is deliberate: the view
 * needs the helpers (buildParams, autoName, loadFromUnit) for its own
 * post-place logic (e.g. DeploymentView bumping the clone name, MoveView
 * resetting its addPrimed flag) without round-tripping through the form.
 *
 * See docs/features/v2/code-health-pass-ui.md §2 U2 for context. The
 * Phase B step 4b toggleable-modifier abstraction is what lets
 * loadFromUnit ask `unit.supportsToggleable("dugIn")` instead of
 * `instanceof Infantry`.
 */
export function useUnitPen(opts: UseUnitPenOptions): UseUnitPenReturn {
  const { defaults = {} } = opts;
  const [type, setType] = useState<UnitType>(defaults.type ?? "Infantry");
  const [size, setSize] = useState<UnitSize>(defaults.size ?? "Platoon");
  const [recon, setRecon] = useState<boolean>(defaults.recon ?? false);
  const [dugIn, setDugIn] = useState<boolean>(defaults.dugIn ?? false);
  const [name, setName] = useState<string>(defaults.name ?? "");

  const autoName = (): string => `${type[0]}-${opts.ownUnitCount + 1}`;

  const buildParams = (position: Point): CreateUnitParams => {
    const placedName = name.trim() === "" ? autoName() : name.trim();
    return {
      type,
      name: placedName,
      position,
      size,
      ...(recon && { modifiers: ["Recon"] }),
      ...(type === "Infantry" && { dugIn }),
    };
  };

  const loadFromUnit = (unit: Unit): void => {
    setType(unit.type);
    setSize(unit.size);
    setRecon(unit.hasModifier("Recon"));
    if (unit.supportsToggleable("dugIn")) {
      setDugIn(unit.getToggleableState("dugIn"));
    }
    // For unit types that don't support dug-in, leave the pen's dugIn
    // value as-is — the source has no state to copy, and the user may
    // switch the pen back to a dug-in-capable type next.
  };

  const clearName = (): void => setName("");

  return {
    state: { type, size, recon, dugIn, name },
    setters: { setType, setSize, setRecon, setDugIn, setName },
    buildParams,
    autoName,
    loadFromUnit,
    clearName,
  };
}
