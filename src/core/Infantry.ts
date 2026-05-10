import { dugInStealthModifier } from "./config.js";
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
    return this._dugIn ? dugInStealthModifier : 1;
  }
}
