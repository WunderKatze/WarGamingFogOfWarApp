# Feature: Map Editor (stage 1 — draw-direct)

**Status:** Draft
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-16

> **Scope note.** This is the deliberately-minimal first cut of map
> editing — straight draw-direct polygons and walls, no reusable terrain
> pieces, no rotation, no photo backdrop. The intended v1 design is the
> Terrain Collection model in `terrain-collection.md`, which will
> eventually supersede this. Stage 1 ships first to unblock tabletop use
> for an imminent game; some of stage 1 is acknowledged throwaway work
> (the draw-direct UI itself; the save/load file format and edge-case
> handling carry forward).

---

## 1. Motivation

Today every game starts on the same hard-coded demo map built in `App.tsx`'s `buildDemoMap()`. To actually use the app at the table, the player needs a way to model the physical table's terrain: rectangle dimensions matching the table, polygons for buildings / woods / fields, and line segments for walls. They also need to save that map so they don't redraw it every session.

This feature adds a Map Editor accessible from the Game menu's existing **Edit map** placeholder. Players can edit the current game's map, save maps to JSON files for reuse, and load maps from files.

The requirements doc (§3.1) describes two workflows:
- **Draw-first** — start on a blank rectangle, draw terrain in-app, then set up the physical table to match.
- **Photo-first** — load a photograph of the table, calibrate scale, annotate terrain on top.

**This doc covers the draw-first workflow only (stage 1).** Photo-first is captured as out-of-scope and gets its own feature doc when needed. The eventual reusable-pieces Terrain Collection model is captured separately in `terrain-collection.md` (parked in Draft).

---

## 2. User-facing behavior

### 2.1 Entering and exiting the editor

- The Game menu's **Edit map** item opens the editor (replacing today's "comes in a later release" placeholder).
- The editor takes over the main view area (same slot the phase views render into). The Header and the Game menu button remain visible; the info menu hides while editing.
- The editor opens with a snapshot of the **current game's map** prefilled. Edits are made against a working draft, not against the live map directly.
- An **Apply** button writes the working draft back into the game. Because changing map dimensions or removing terrain can invalidate already-placed unit positions, applying always **restarts the game** (with confirm dialog).
- A **Cancel** button discards the working draft and returns to the game with the old map intact.
- An **Exit (back to game)** button is the same as Cancel — both surface the discard-on-cancel pattern.

### 2.2 Editor layout

```
┌────────────────────────────────────────────────────────────┐
│  Header                                          [☰ Menu]  │
├──────────────┬─────────────────────────────────────────────┤
│  Sidebar     │                                             │
│  ─────────   │                                             │
│  Dimensions  │             EDITOR CANVAS                   │
│   W [96 ]"   │          (terrain on a rect background,     │
│   H [60 ]"   │           snap-to-grid optional)            │
│              │                                             │
│  Tool        │                                             │
│   ◉ Polygon  │                                             │
│   ◯ Wall     │                                             │
│   ◯ Delete   │                                             │
│              │                                             │
│  Terrain     │                                             │
│   ◉ Building │                                             │
│   ◯ Tall W.  │                                             │
│   ◯ Short T. │                                             │
│              │                                             │
│  Wall type   │                                             │
│   ◉ Short    │                                             │
│   ◯ Tall     │                                             │
│              │                                             │
│  Snap to     │                                             │
│   [✓] 1.0"   │                                             │
│              │                                             │
│  [Save…]     │                                             │
│  [Load…]     │                                             │
│  [Apply]     │                                             │
│  [Cancel]    │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

### 2.3 Dimensions

- Width and height are inch-typed inputs (positive numbers). Defaults to the current map's dimensions on open.
- Changing dimensions mid-edit is allowed; terrain outside the new bounds is clipped on Apply (not deleted in the editor, just no longer rendered if outside the rect — see §4 edge cases for the firm rule).

### 2.4 Tools

Three radio-selected tools share the canvas:

**Polygon tool** — vertex-by-vertex drawing of an area-terrain polygon.
- Click to drop the first vertex; subsequent clicks add more vertices.
- A dashed preview line follows the cursor from the last placed vertex.
- **Enter** or **double-click** closes the polygon: it commits with the currently selected terrain type from the Terrain group.
- **Escape** cancels the in-progress polygon (all unstaged vertices discarded).
- Minimum of 3 vertices to commit; fewer than 3 + Enter is a no-op.

**Wall tool** — two-click line segments.
- First click drops the start point; a dashed preview line follows the cursor.
- Second click commits the wall using the currently selected wall type (Short or Tall).
- **Escape** cancels the in-progress wall.

**Delete tool** — click an existing polygon or wall to remove it.
- The shape directly under the cursor is highlighted on hover.
- A click removes it (no undo in stage 1 — see §6 open questions).

### 2.5 Snap to grid

- A snap toggle in the sidebar (default ON) snaps all click positions to a 1.0″ grid.
- The grid is rendered as faint dotted lines on the canvas when snap is on; absent when off.
- Snap increment is fixed at 1.0″ in stage 1.

### 2.6 Terrain and wall type selection

- The Terrain group (Building / Tall Woods / Short Terrain) controls what type the **next committed polygon** gets. Doesn't affect existing polygons.
- The Wall-type group (Short / Tall) controls the **next committed wall**. Doesn't affect existing walls.
- The currently selected entry in each group sources display fill / stroke from the existing `terrainCatalog`, so a previewed shape looks the same as a committed shape.

### 2.7 Save and Load (JSON files)

- **Save…** prompts for a filename (or uses a default like `wargame-map.json`) and downloads the current working draft as a JSON file. Format:
  ```json
  {
    "width": 96,
    "height": 60,
    "polygons": [
      { "id": "b1", "terrainType": "Building", "vertices": [{ "x": 30, "y": 12 }, ...] }
    ],
    "walls": [
      { "id": "w1", "from": { "x": 48, "y": 4 }, "to": { "x": 48, "y": 18 }, "wallType": "Tall" }
    ]
  }
  ```
- **Load…** opens a file picker. The selected JSON file is parsed and loaded into the working draft, **replacing** the current draft (with confirm prompt if the draft has unsaved edits).
- Save / Load operate on the working draft. They do not interact with the live game's map until Apply.

### 2.8 Apply

- Confirms: *"Apply this map? The current game will restart and any in-progress unit placements will be lost."*
- On confirm: the working draft becomes the live game's map and a fresh game starts (same flow as Restart).
- Editor closes and returns to the new game's Deploy phase.

---

## 3. Edge cases

| Scenario | Behavior |
|---|---|
| Open editor mid-game (Move / FireDeclare) | Editor opens; working draft is a copy of current map. No game state changes until Apply. Cancel preserves the game. |
| Open editor, make changes, click Cancel | Confirm: "Discard edits?" → yes returns to game with original map; no keeps editing. |
| Apply when no edits were made | Still triggers restart-with-confirm (Apply is unconditional). Could short-circuit to a no-op later. |
| Width / height reduced so existing terrain falls outside the new rect | On Apply, the bounding rect is the new dimensions; out-of-bounds terrain is kept in the saved map (so widening later restores them) but isn't rendered when the rect is smaller. |
| Polygon tool: user drops 1 or 2 vertices then presses Enter | Enter is a no-op below 3 vertices. Escape still cancels. |
| Polygon tool: vertices form a self-intersecting polygon | Committed as-drawn. The vision-rule polygon math may behave oddly — flagged as known limitation (see §6 open questions). |
| Wall tool: first click placed, then tool switched before second click | The in-progress wall is discarded silently. |
| Delete tool: cursor between two overlapping polygons | Targets the topmost (last-drawn) one, mirroring the info-menu hover convention. |
| Snap toggled OFF mid-drawing | The in-progress shape keeps the snapped vertices it already has; new vertices are unsnapped. |
| Load a JSON map file with malformed shape | Error alert: "Couldn't read map file — malformed JSON or missing required fields." Working draft is unchanged. |
| Load a JSON map file with a newer schema (extra keys) | Unknown top-level keys ignored; known keys loaded. Missing keys fall back to current draft values (no destructive default merge). |
| Browser refresh while editing | Editor state is lost (no auto-save). Live game state is also lost — same as today. |
| Apply with a 0-polygon, 0-wall map | Allowed. The game restarts on a blank rectangle. |

---

## 4. Recorded decisions

1. **Stage 1 covers draw-first only.** Photo-first (backdrop image + scale calibration + annotation on top) is deferred — see §5.
2. **The editor edits the current game's map**, not a separate "current map" concept. Working draft is a copy; Apply restarts the game with the new map. There is no in-place edit that preserves an active game's units.
3. **JSON file format** is flat and schema-versionless in v1. Adding a future `version` field is forward-compatible (older readers ignore it; newer readers branch on it).
4. **Snap-to-grid is 1.0″** with no configurable grid size in v1.
5. **Three tools only** in stage 1 — Polygon, Wall, Delete. No edit-existing-shape (move vertex, extend wall) — those are explicit out-of-scope.
6. **Apply unconditionally restarts the game** rather than trying to migrate placed units. Cleaner than attempting partial preservation; matches the existing Restart game flow's invariant.

---

## 5. Out of scope (stage 1)

- **Photo-first workflow** — backdrop image upload, drawing a reference segment for scale calibration, and rendering the photo as a background under the terrain layer. Separate feature doc when prioritized.
- **Reusable Terrain Pieces / drag-from-collection placement** — see `terrain-collection.md`. The intended v1 model that supersedes draw-direct.
- **Cosmetic terrain type** — a no-vision-rules polygon for roads / paths. Lands with the Terrain Collection.
- **Move / rotate placed terrain** — moving or rotating an already-committed polygon/wall. Stage 1 supports delete + redraw only; rotation isn't even a concept yet.
- **Primitive shapes** — rectangle / circle polygon tools. Freeform vertex-by-vertex is the only polygon entry method in stage 1.
- **Editing existing terrain** — moving a vertex, extending a wall, changing a polygon's terrain type after commit. Delete + redraw is the only way.
- **Undo / redo** inside the editor — committed shapes can be deleted but not undone. No history stack.
- **Map metadata** — name, author, notes embedded in the map file. Filename serves as identifier for v1.
- **Multiple maps in one file**, library / browser UI for saved maps, server-backed map storage.

---

## 6. Open questions

1. **Undo inside the editor.** Without it, a misclick on a polygon's third vertex means starting over. Worth a simple `Ctrl+Z` that pops the last placed vertex (mid-shape) or removes the last committed shape (between shapes)? Could be added if it's quick.
2. **Self-intersecting polygons.** `pointInPolygon` and the ray-inside math may give weird results for bowtie polygons. Should the editor reject these on commit (geometric validation), or accept them and trust the player not to draw nonsense? I'd lean accept-and-warn (faster to ship); a hard reject can come later if it bites in practice.
3. **Map width / height bounds.** Lower bound is "positive number." Is there a practical upper bound (e.g., 200″ x 200″)? Beyond some size the rendered map becomes unwieldy at default zoom.
4. **What happens to the bottom-left scale indicator** while editing? Probably stays — it's still useful — but worth confirming.
5. **Should Edit map work during a Transition screen?** Today the Game menu is hidden on Transition (and so is the info menu). If a player needs to edit between turns, the menu would have to be visible somewhere. v1 default: no special handling, Edit map only reachable from non-Transition phases.

---

## 7. Implementation notes

> Sketch only — flesh out before implementation begins.

### 7.1 Routing

`PhaseRouter` in `App.tsx` currently switches on `game.state.phase`. Add a parallel UI-only "editor open" mode that the router surfaces as a higher-priority route:

```ts
if (mapEditor.isOpen) return <MapEditor />;
switch (game.state.phase) { ... }
```

The "is editor open" state lives in a new `MapEditorProvider` context (boolean + open/close API). The Game menu's Edit map item flips it open.

### 7.2 Editor working-draft model

A `WorkingMap` type mirrors `GameMap`'s fields (width, height, polygons[], walls[]) but holds them as **plain serializable data**, not class instances. Edits happen on this working data structure. Apply constructs a fresh `GameMap` from the data and calls something like `Game.replaceMap(new GameMap(...))` — which probably reduces to "reset the game with the new init."

### 7.3 Canvas

Reuse `MapCanvas` for the editor's canvas: it already handles pan, zoom, terrain rendering, and the cursor-position signal we need for drawing. The editor passes:
- The working-draft map as `map`
- Empty `units` (no game units in the editor)
- Drawing-overlay nodes via `overlay`
- Pointer / click handlers via existing props

The drawing overlay renders in-progress shapes (preview line, current polygon vertices) and the grid (when snap is on).

### 7.4 Tool state

A `useEditorState` hook (or local state inside `MapEditor`) tracks:
- Current tool (`"polygon" | "wall" | "delete"`)
- Selected polygon terrain type
- Selected wall type
- Snap on/off
- In-progress polygon (`{ vertices: Point[] } | null`)
- In-progress wall (`{ from: Point } | null`)

### 7.5 File I/O

Patterned on `ruleSetStorage.ts` from the game-menu feature:
- `downloadMap(name, map)` — Blob + `<a download>` synthetic click.
- `parseMapFile(text)` — JSON parse + shape validation, returning a `WorkingMap | null`.
- No localStorage equivalent in stage 1; maps are always file-backed.

### 7.6 Order of work

1. `WorkingMap` data type + serialization helpers + tests.
2. `MapEditorProvider` context + open/close wiring through the Game menu.
3. `MapEditor` component with the sidebar and a canvas that renders the working draft (read-only at this point — no tools yet).
4. Polygon tool: vertex placement, preview line, commit, escape/enter handling.
5. Wall tool: two-click placement, preview, commit.
6. Delete tool: hover highlight + click.
7. Snap-to-grid toggle + grid rendering.
8. Save / Load file I/O.
9. Apply → game-reset wiring.
10. Edge-case pass against §3.
