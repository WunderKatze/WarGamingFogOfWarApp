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
   * docs/features/v1/vision-rules-tweaks.md §2.3.
   */
  goneToGround?: boolean;
}

/**
 * Snapshot of every piece of unit state that a Move-phase move can mutate,
 * captured before the move so an undo / revert can restore it.
 *
 * `position` and `goneToGround` are universal — every unit has them.
 * `subclassData` is opaque to the base class: each subclass that has
 * additional move-mutable state (e.g. Infantry's `dugIn`) defines its own
 * shape via `captureSubclassMoveData` / `applySubclassMoveData`. The base
 * treats this slot as opaque; subclasses own the cast on receive.
 *
 * Shape decision recorded in docs/features/v2/code-health-pass.md §7 D3:
 * picked over a typed-per-subclass interface (which conflicts with Phase
 * B's data-driven unit model) and over an `extra: Record<string, unknown>`
 * (which invites scattered string-key access). The `unknown` slot is
 * future-compatible: Phase B's modifier-snapshot composition slots into
 * the same field as a same-shape renaming.
 */
export interface UnitMoveSnapshot {
  readonly position: Point;
  readonly goneToGround: boolean;
  readonly subclassData: unknown;
}

/**
 * Declares a boolean state that the active player can flip on a unit
 * during their turn (e.g. WWII Infantry's `dugIn`). Different unit
 * types declare their own list — Tanks support none; Infantry
 * supports "dugIn". Engine-core code consults `unit.toggleableModifiers`
 * + `supportsToggleable(id)` instead of `instanceof`-checking concrete
 * subclasses, which is what lets engine-core stay ruleset-agnostic
 * (R3). Phase B step 4b.
 *
 * Read-only metadata: the spec describes the modifier; current value
 * + write live behind `getToggleableState` / `setToggleableState` so
 * subclasses own their own storage.
 */
export interface ToggleableModifierSpec {
  /** Stable id used by engine + UI to address this modifier. */
  readonly id: string;
  /** Human-readable label rendered next to the toggle. */
  readonly displayName: string;
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
   * already concealed. See docs/features/v1/vision-rules-tweaks.md §2.3.
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

  /**
   * Toggleable boolean modifiers this unit type supports. Base default:
   * none. Subclasses override to declare their own (e.g. Infantry
   * declares "dugIn"). Engine-core's toggle pathway reads this list
   * instead of `instanceof`-checking concrete subclasses, which keeps
   * engine-core ruleset-agnostic. See [[ToggleableModifierSpec]].
   */
  get toggleableModifiers(): readonly ToggleableModifierSpec[] {
    return [];
  }

  /** Convenience: does this unit declare the given toggleable id? */
  supportsToggleable(id: string): boolean {
    return this.toggleableModifiers.some((m) => m.id === id);
  }

  /**
   * Read the current value of a toggleable modifier. Base default
   * throws; subclasses that declare a toggleable override to return
   * its current value. Callers should gate on `supportsToggleable(id)`
   * before reading.
   */
  getToggleableState(id: string): boolean {
    throw new Error(
      `Unit "${this.id}" (type "${this.type}") does not support ` +
        `toggleable modifier "${id}"`,
    );
  }

  /**
   * Write a toggleable modifier's value. Base default throws; subclasses
   * that declare a toggleable override to apply the write. Callers should
   * gate on `supportsToggleable(id)` before writing.
   */
  setToggleableState(id: string, _value: boolean): void {
    throw new Error(
      `Unit "${this.id}" (type "${this.type}") does not support ` +
        `toggleable modifier "${id}"`,
    );
  }

  getVision(): number {
    const rules = getRules();
    const base = this.getStats(rules).baseVision;
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
    const base = this.getStats(rules).baseStealth;
    const mult = this.hasModifier("Recon") ? rules.modifierEffects.Recon.stealthMultiplier : 1;
    return base * mult;
  }

  private getStats(rules: ReturnType<typeof getRules>) {
    const stats = rules.unitTypeStats[this.type];
    if (!stats) {
      throw new Error(
        `Unit type "${this.type}" has no entry in rules.unitTypeStats — ` +
          `the active ruleset must seed stats for every registered unit type.`,
      );
    }
    return stats;
  }

  /**
   * Concealment modifier this unit contributes from its own state.
   * Pooled with terrain modifiers — only the single highest applies.
   * Default is 1 (no contribution); subclasses override when applicable.
   */
  getInherentConcealmentModifier(): number {
    return 1;
  }

  /**
   * Snapshot every piece of state that a Move-phase move can mutate.
   * Captured by Game.moveUnit before the position changes, so
   * undoLastMove / revertUnitMoves can restore the unit to its pre-move
   * shape. Base captures position and goneToGround; subclasses with
   * additional move-mutable state extend via the `subclassData` hook.
   */
  captureMoveSnapshot(): UnitMoveSnapshot {
    return {
      position: this._position,
      goneToGround: this.goneToGround,
      subclassData: this.captureSubclassMoveData(),
    };
  }

  /**
   * Restore a snapshot produced by captureMoveSnapshot on this same unit.
   * Pre-condition: the snapshot was produced by this very instance, so its
   * `subclassData` matches what this class's applySubclassMoveData expects.
   * No runtime cross-class check.
   */
  applyMoveSnapshot(snap: UnitMoveSnapshot): void {
    this._position = snap.position;
    this.goneToGround = snap.goneToGround;
    this.applySubclassMoveData(snap.subclassData);
  }

  /**
   * Subclass hook for capturing additional move-mutable state. Default:
   * no subclass state. Override returns a value of any shape; the same
   * value is handed back to applySubclassMoveData on restore. The base
   * class treats the result as opaque.
   */
  protected captureSubclassMoveData(): unknown {
    return null;
  }

  /**
   * Subclass hook for applying data captured by captureSubclassMoveData.
   * Default: no-op. Each subclass owns the type of `data` it expects and
   * casts at receive — this is the single cast site per subclass for
   * snapshot data.
   */
  protected applySubclassMoveData(_data: unknown): void {
    // base default: no subclass state to apply.
  }

  /**
   * Apply per-unit side effects that follow a Move-phase move. Called by
   * Game.moveUnit after setPosition. Base clears goneToGround unless a
   * modifier prevents it (currently: Recon, see vision-recon-tweaks §2.2);
   * subclasses extend to clear additional move-broken state.
   *
   * Phase B note: the Recon-modifier check here will move into a
   * modifier-behavior pipeline once Axis 2 lands; this method becomes
   * the place that calls into it.
   */
  onMoved(): void {
    if (!this.hasModifier("Recon")) {
      this.goneToGround = false;
    }
  }
}
