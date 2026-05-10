import { Unit } from "./Unit.js";

export class Tank extends Unit {
  readonly type = "Tank" as const;
}
