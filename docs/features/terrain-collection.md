# Feature: Terrain Collection

**Status:** Draft (parked)
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-16

> **Status note.** This doc is being parked in Draft while the simpler
> `map-editor.md` stage-1 (draw-direct) ships first to unblock tabletop
> use today. The Collection model below is the *intended* v1 design and
> will eventually replace the draw-direct flow — stage 1 is the
> deliberately-disposable quick-ship that gets a map onto a table for
> this weekend's game. Pick this back up after stage 1 lands.

---

## 1. Motivation

Real tabletop wargaming uses **physical terrain pieces**: a player has a small collection of buildings, woods, walls, hills, and roads — each a specific physical object with fixed dimensions — and arranges them on the table to set up the battlefield. The same building piece can appear on many different tables across many games; the player owns N of each piece and physically picks one up and places it.

The current draw-direct map editor (see `map-editor.md` stage 1) treats every terrain feature as a one-off polygon or wall drawn in-place. That works as a quick-ship but doesn't mirror how the player actually builds tables in real life, and doesn't let them reuse the same building piece across multiple maps.

The Terrain Collection adds a layer of indirection: the player **designs reusable terrain pieces** once, then **places instances** of them on any map by dragging from a collection sidebar. Each piece carries a real-world identity (name, count owned, fixed dimensions) that the player can map back to their physical bag of terrain.

---

## 2. User-facing behavior (raw spec from design conversation)

The following captures Ryan's intent verbatim — open questions in §4 still
need to be resolved before this can be promoted to Approved.

### 2.1 Terrain Collection panel

A sub-menu inside the map editor shows a list and preview of selectable
pieces of terrain that the player has already designed. Pieces in the
collection can be dragged from this sidebar onto the map editor canvas to
place them, with rotation.

### 2.2 Create Terrain Piece flow

1. The user clicks a **Create Terrain Piece** button.
2. A dedicated terrain drawing view opens. Two tools:
   - **Polygon tool** — vertex-by-vertex placement (with an optional snap-to-grid toggle).
   - **Rectangle tool** — simple click-and-drag rectangle.
3. **Each edge of the in-progress shape displays its length** while drawing, so the player can match the piece to their real-life physical terrain dimensions.
4. Editable fields beside the drawing canvas:
   - **Terrain type** — Building / Tall Woods / Short Terrain / Short Wall / Tall Wall / **Cosmetic** (new — no vision rules; used for roads).
   - **Name** — a short text label (e.g. "Short wall", "Big farmhouse").
   - **Count** — how many of this piece the player owns.
5. **Add to Collection** saves the piece and clears the drawing canvas for the next piece.
6. **Exit** at any time returns to the map editor view.

### 2.3 New terrain type — Cosmetic

A polygon-type terrain that **has no vision rules** at all. It renders on
the map (with a distinct visual treatment — likely a road-asphalt color
or similar) but contributes nothing to `isRayBlocked` or
`getConcealmentModifiersAlongRay`. Primary use case: roads, paths,
decorative elements.

### 2.4 Placement on the map

Drag a piece from the Terrain Collection sidebar onto the editor canvas
to place it. Once placed, the user can:

- **Move** the piece — drag to reposition.
- **Rotate** the piece — affordance TBD (rotation handle / numeric input / keyboard).
- **Delete** the piece.

Multiple placements of the same piece each count against its `count`
field (open question §4: hard cap or informational?).

### 2.5 Persistence

- **Terrain Collection** — a JSON file that can be **imported and exported
  separately** from the map. Likely a single global collection per device
  (open question §4).
- **Map file** — references placed pieces by piece-id + position +
  rotation. A map is portable only when paired with its collection (or
  with the pieces embedded — open question §4).

---

## 3. Data model sketch

```ts
interface TerrainPiece {
  id: string;
  name: string;
  type: "Building" | "TallWoods" | "ShortTerrain"
      | "ShortWall" | "TallWall" | "Cosmetic";
  count: number;
  geometry: // polygon vertices or wall endpoints; shape depends on type
}

interface PlacedPiece {
  id: string;
  pieceId: string;     // → TerrainPiece.id in the active collection
  position: Point;     // map-space inch coords of the piece's origin
  rotation: number;    // degrees
}

interface TerrainCollection {
  pieces: TerrainPiece[];
}

interface MapData {
  width: number;
  height: number;
  placements: PlacedPiece[];
  // backdrop?, etc.
}
```

The vision algorithms in `GameMap` continue to operate on resolved
`TerrainPolygon` / `TerrainWall` instances — the runtime *materializes*
each `PlacedPiece` into one of those at map-load time by applying its
rotation + translation to the piece's local geometry, then feeds the
result into the existing `terrainCatalog`-driven loops.

Cosmetic-type pieces materialize into `TerrainPolygon` with a new
`terrainType: "Cosmetic"` entry in the catalog whose
`appliesAsConcealment` and `blocksRay` both return `false` and whose
`visual` is a distinct fill.

---

## 4. Open questions (must resolve before Approved)

1. **Walls drawn in the terrain creator.** Same polygon/rectangle tool with "wall" as the type (yields a thin-rectangle wall), or a separate two-click wall tool that produces a true 1D segment matching today's `TerrainWall`? My instinct: a separate wall tool — preserves the existing core distinction and avoids needing to refactor wall semantics to handle polygon-shaped walls.
2. **Multi-segment walls.** Is a "wall" piece always a single straight segment, or can it be an L-shape / U-shape / multi-segment fence (one piece, multiple connected wall lines)?
3. **Cosmetic terrain rendering.** Distinct fill via the existing catalog visual scheme, or a more substantial visual treatment (textures, road lines)? v1 likely just a flat color.
4. **Rotation increment.** Free-form rotation via drag handle, snap to 15° / 45° / 90°, or both modes selectable? Snap probably useful for typical placements; free-form needed for natural-looking layouts.
5. **Count enforcement.** Hard cap (block placement when N of N already placed) or informational (shows "3/4 placed" but doesn't prevent more)? Hard cap matches physical reality; informational is more forgiving.
6. **Edge length labels.** Only while drawing in the creator, only on the currently-selected placed piece, or always visible on every placed piece in the editor? Always-visible could get noisy fast.
7. **Collection scope.** One global collection per device (one bag of terrain, many maps) or one collection per map (saved together)? The user's spec leans global ("imported and exported separately") — confirm.
8. **Map portability.** When the user shares a map JSON with another player, does the map reference pieces by id (requires the recipient to also have a matching collection) or embed a snapshot of the referenced pieces? Embedded is friendlier; ref-by-id is smaller. Could be both via a switch on save.
9. **Migration from stage-1 maps.** Stage-1 of `map-editor.md` saves direct-drawn polygons and walls in a flat JSON. When this Collection model ships, do we have an importer that wraps each stage-1 polygon/wall as a single-count piece? Probably yes — cheap to write, preserves old saves.
10. **What happens to a placed piece whose definition was deleted from the collection** — orphaned placements rendered with a warning, auto-removed, or refused-deletion-while-placed?

---

## 5. Relationship to other features

- **Succeeds** the stage-1 draw-direct flow in `map-editor.md`. Once this
  ships, the draw-direct UI can be removed (or kept as an "advanced /
  bypass-collection" tool if useful).
- **Adds** a Cosmetic polygon terrain type to the existing
  `terrainCatalog`. That's a single new entry following the established
  pattern (display name, multiplier=1, predicates that always return
  false, visual fill).
- **Likely interacts with save/load games** (the separate v1 save/load
  feature) — a saved game would need to carry either the collection it
  was based on, or embed each placed piece's resolved geometry. Worth
  cross-referencing once both features are Approved.

---

## 6. Out of scope (when this becomes Approved)

To be filled in once the open questions are resolved. Likely candidates:
- Photo-first workflow (still its own separate feature).
- Cross-device collection sync (collections stay file-shared in v1).
- Snap-on-rotation in addition to snap-on-translate.
- Layered pieces (a building piece *on top of* a hill piece).
