import type { Point, WallType } from "../types.js";

export interface TerrainWallInit {
  id: string;
  from: Point;
  to: Point;
  wallType: WallType;
}

export class TerrainWall {
  readonly id: string;
  readonly from: Point;
  readonly to: Point;
  readonly wallType: WallType;

  constructor(init: TerrainWallInit) {
    this.id = init.id;
    this.from = init.from;
    this.to = init.to;
    this.wallType = init.wallType;
  }
}
