import { getRules } from "../rules.js";
import type { Modifier, Point, TeamId, UnitId, UnitSize, UnitType } from "../types.js";

export interface UnitInit {
  id: UnitId;
  name: string;
  teamId: TeamId;
  position: Point;
  size?: UnitSize;
  modifiers?: Iterable<Modifier>;
  /**
   * Initial Gone to Ground state. `true` for units placed during Deployment
   * (settled), `false` for units added mid-game via Game.createUnit (in
   * flux). Game owns the lifecycle thereafter — see
   * docs/features/vision-rules-tweaks.md §2.3.
   */
  goneToGround?: boolean;
}

export abstract class Unit {
  abstract readonly type: UnitType;

  readonly id: UnitId;
  readonly teamId: TeamId;
  name: string;
  readonly size: UnitSize;
  readonly modifiers: ReadonlySet<Modifier>;
  /**
   * Gone to Ground flag — true if the unit didn't move or fire during its
   * owner's most recent turn. Game mutates this directly via moveUnit,
   * toggleFire, startTurn (reset), and the undo paths. VisionCalculator
   * reads it to apply the GtG stealth stack when the per-ray discovery is
   * already concealed. See docs/features/vision-rules-tweaks.md §2.3.
   */
  goneToGround: boolean;

  protected _position: Point;

  constructor(init: UnitInit) {
    this.id = init.id;
    this.teamId = init.teamId;
    this.name = init.name;
    this.size = init.size ?? "Platoon";
    this._position = init.position;
    this.modifiers = new Set(init.modifiers ?? []);
    this.goneToGround = init.goneToGround ?? false;
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
    const rules = getRules();
    const base = rules.unitTypeStats[this.type].baseVision;
    const mult = this.hasModifier("Recon") ? rules.modifierEffects.Recon.visionMultiplier : 1;
    return base * mult;
  }

  /**
   * Intrinsic stealth: base × per-unit modifiers (e.g. Recon).
   * Concealment from terrain or unit state (e.g. dug-in) is pooled separately
   * by VisionCalculator because only the single highest of those applies.
   */
  getIntrinsicStealth(): number {
    const rules = getRules();
    const base = rules.unitTypeStats[this.type].baseStealth;
    const mult = this.hasModifier("Recon") ? rules.modifierEffects.Recon.stealthMultiplier : 1;
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
