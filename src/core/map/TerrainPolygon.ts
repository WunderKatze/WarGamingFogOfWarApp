import { pointInPolygon } from "./geometry.js";
import type { Point, PolygonTerrainType, Segment } from "../types.js";

export interface TerrainPolygonInit {
  id: string;
  vertices: readonly Point[];
  terrainType: PolygonTerrainType;
}

export class TerrainPolygon {
  readonly id: string;
  readonly vertices: readonly Point[];
  readonly terrainType: PolygonTerrainType;

  constructor(init: TerrainPolygonInit) {
    if (init.vertices.length < 3) {
      throw new Error(
        `TerrainPolygon ${init.id}: needs at least 3 vertices, got ${init.vertices.length}`,
      );
    }
    this.id = init.id;
    this.vertices = [...init.vertices];
    this.terrainType = init.terrainType;
  }

  /** Edges of the polygon, including the implicit closing edge from last vertex to first. */
  getEdges(): Segment[] {
    const n = this.vertices.length;
    const edges: Segment[] = [];
    for (let i = 0; i < n; i++) {
      edges.push({ from: this.vertices[i]!, to: this.vertices[(i + 1) % n]! });
    }
    return edges;
  }

  containsPoint(p: Point): boolean {
    return pointInPolygon(p, this.vertices);
  }
}
