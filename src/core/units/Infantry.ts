import { getRules } from "../rules.js";
import { Unit, type UnitInit } from "./Unit.js";

export interface InfantryInit extends UnitInit {
  dugIn?: boolean;
}

export class Infantry extends Unit {
  readonly type = "Infantry" as const;

  private _dugIn: boolean;

  constructor(init: InfantryInit) {
    super(init);
    this._dugIn = init.dugIn ?? false;
  }

  get dugIn(): boolean {
    return this._dugIn;
  }

  setDugIn(value: boolean): void {
    this._dugIn = value;
  }

  override getInherentConcealmentModifier(): number {
    return this._dugIn ? getRules().dugInStealthModifier : 1;
  }

  /**
   * Infantry's move snapshot carries `dugIn` alongside the base
   * position + goneToGround. Returned shape: `{ dugIn: boolean }`.
   */
  protected override captureSubclassMoveData(): { dugIn: boolean } {
    return { dugIn: this._dugIn };
  }

  /**
   * Restore the `dugIn` flag captured by captureSubclassMoveData. The
   * cast is bounded to this method — pre-condition is that the data
   * came from this same Infantry instance.
   */
  protected override applySubclassMoveData(data: unknown): void {
    this._dugIn = (data as { dugIn: boolean }).dugIn;
  }

  /**
   * Moving clears Infantry's dugIn state in addition to the base
   * onMoved effects (goneToGround clearing). Mirrors
   * vision-rules-tweaks.md §2.1.
   */
  override onMoved(): void {
    super.onMoved();
    if (this._dugIn) this._dugIn = false;
  }
}
