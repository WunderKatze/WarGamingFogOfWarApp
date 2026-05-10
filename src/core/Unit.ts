import { modifierEffects, unitTypeStats } from "./config.js";
import type { Modifier, Point, UnitType } from "./types.js";

export interface UnitInit {
  id: string;
  name: string;
  position: Point;
  modifiers?: Iterable<Modifier>;
}

export abstract class Unit {
  abstract readonly type: UnitType;

  readonly id: string;
  name: string;
  readonly modifiers: ReadonlySet<Modifier>;

  protected _position: Point;

  constructor(init: UnitInit) {
    this.id = init.id;
    this.name = init.name;
    this._position = init.position;
    this.modifiers = new Set(init.modifiers ?? []);
  }

  getPosition(): Point {
    return this._position;
  }

  setPosition(p: Point): void {
    this._position = p;
  }

  hasModifier(m: Modifier): boolean {
    return this.modifiers.has(m);
  }

  getVision(): number {
    const base = unitTypeStats[this.type].baseVision;
    const mult = this.hasModifier("Recon") ? modifierEffects.Recon.visionMultiplier : 1;
    return base * mult;
  }

  /**
   * Intrinsic stealth: base × per-unit modifiers (e.g. Recon).
   * Concealment from terrain or unit state (e.g. dug-in) is pooled separately
   * by VisionCalculator because only the single highest of those applies.
   */
  getIntrinsicStealth(): number {
    const base = unitTypeStats[this.type].baseStealth;
    const mult = this.hasModifier("Recon") ? modifierEffects.Recon.stealthMultiplier : 1;
    return base * mult;
  }

  /**
   * Concealment modifier this unit contributes from its own state.
   * Pooled with terrain modifiers — only the single highest applies.
   * Default is 1 (no contribution); subclasses override when applicable.
   */
  getInherentConcealmentModifier(): number {
    return 1;
  }
}
