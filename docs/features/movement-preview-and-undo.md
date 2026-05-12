# Feature: Movement Preview, Waypoints, and Undo

**Status:** Approved
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-11

---

## 1. Motivation

The current Move-phase UX is *click own unit, click destination, unit teleports*. Two problems:

1. **No visual feedback during the move.** Distances are eyeballed. You commit before you know how far you've gone or how close you've come to a target.
2. **No way to back out of a misclick.** If you commit a move to the wrong spot, you have to estimate the original position by hand to put the unit back.

This feature replaces the teleport with a live preview, and adds an undo for the active Move phase.

---

## 2. User-facing behavior

### 2.1 Selecting a unit
- During Move phase, clicking an own unit selects it for moving (unchanged from today).
- The unit's NATO symbol / name / stem / dot **detach from the unit's stored position and follow the mouse cursor.**
- A faded **ghost** of the unit remains drawn at the original position.
- A **dashed line** in the team's color connects the ghost dot to the live dot.
- A **distance label** is rendered on the line (see §2.5 for label styling and placement).

### 2.2 Committing a move (straight line)
- Clicking empty space or terrain with no waypoint modifier commits the move: the unit's stored position becomes the click position.
- The ghost, dashed line, and labels disappear.
- The completed move is pushed onto the **move history** (see §2.6).

### 2.3 Waypoint paths
Units sometimes need to move around terrain or other obstacles. Waypoints let a single move trace a multi-segment path.

- **Trigger:** hold **Shift** while clicking, OR toggle the **"Waypoint mode"** switch in the Move-phase sidebar (for touch / no-keyboard play).
- Each click in waypoint mode **adds a waypoint** at that point instead of committing the move. The live unit visual remains attached to the cursor; the dashed line now runs ghost → waypoint₁ → waypoint₂ → … → cursor.
- Every committed segment of the path gets its own distance label using the same styling as §2.5.
- **Committing the full move:** release Shift (or toggle waypoint mode off) and click — the unit's stored position becomes the final click position, and the full path is recorded as a single move in history.
- Waypoints are visual/measurement only — the engine still stores just the final position. The intermediate path is not persisted across moves.

### 2.4 Cancelling a move (no commit)
- Clicking the selected unit again cancels: the live unit visual snaps back to the original position; ghost, line, waypoints, and labels disappear.
- Clicking another own unit cancels the current move and selects the new unit for moving.
- Pressing **Escape** cancels.
- Clicks **outside the canvas** (sidebar, header) do nothing to the active move — they don't commit and don't cancel. The Undo button and End Move button still work.

### 2.5 Distance displays
There are **two independent distance displays** rendered during a move. They share a styling treatment but serve different roles.

**Shared styling — "team-color pill":**
- **Border:** team color (blue for A/Friend perspective, red for B/Hostile — matches the team's dot color).
- **Fill:** white (so the label is readable over any background — terrain, ghost, other units).
- **Text:** team color, `12.3"` format (one decimal, inches).

**Display 1 — Cursor pill (always rendered):**
- Anchored to the **live unit symbol** at the cursor.
- Shows the **full move info**: total path distance from ghost through any waypoints to the current cursor (for a straight-line move this is just the single segment's distance).
- **Placement** relative to the live unit symbol:
  - If the unit is moving **up** (live above ghost), pill sits **below** the symbol.
  - If the unit is moving **down** (live below ghost), pill sits **above** the symbol.
- This display is what the player relies on for the authoritative reading; it's guaranteed legible regardless of segment geometry.

**Display 2 — Per-segment pill (rendered when there's room):**
- One pill per dashed segment, **centered on the segment**, breaking the dashes so the text doesn't overlap them.
- Shows that segment's individual distance.
- If a segment is too short to render the pill cleanly (text would overlap the segment endpoints or other UI), the per-segment pill for that segment is **omitted** — the player falls back on the cursor pill (Display 1) for total distance.

### 2.6 Undoing a move
- An **"Undo last move"** button appears in the Move-phase sidebar whenever the move history is non-empty.
- **Ctrl+Z** (or the button) pops the most recent move and restores the unit to its prior position.
- A multi-waypoint path counts as **one** move — undo restores to the position before the first click of that path.
- Multiple undos walk back through prior moves.
- The move history persists for the duration of the current Move phase. **It clears when the player presses End Move.**

---

## 3. UI sketch

**Straight-line move (moving up-and-right, so cursor pill is below the symbol):**

```
                          ┌──────────┐
                          │ [symbol] │   ← live unit, follows cursor
                          │ 1st Pl   │
                          │   │      │
                          │   ●      │
                          └──┴───────┘
                            ┌───────┐
                            │ 12.3" │   ← cursor pill (Display 1), below symbol
                          ╱ └───────┘     because unit is moving up
                        ╱
                      ╱  ┌───────┐
                    ╱ ── │ 12.3" │ ──    ← per-segment pill (Display 2),
                  ╱      └───────┘          interrupts dashes, centered
                ╱
            ┌──────────┐
            │ [symbol] │   ← ghost, ~30% opacity, at original position
            │ 1st Pl   │
            │   │      │
            │   ●      │
            └──┴───────┘
```

**Waypoint path (Shift held or toggle on — cumulative shown at cursor, per-segment along the path):**

```
                                  ┌──────────┐
                                  │ [symbol] │   ← live unit at cursor
                                  │   ●      │
                                  └──────────┘
                                  ┌───────┐
                                  │ 16.0" │   ← cursor pill: TOTAL path distance
                              ── └───────┘ ──
                            ╱   ┌──────┐
                          ╱  ── │ 6.7" │ ──   ← per-segment pill
                        ╱       └──────┘
                      ●  waypoint₂
                    ╱
                  ╱   ┌──────┐
                ╱  ── │ 5.2" │ ──             ← per-segment pill
              ╱       └──────┘
            ●  waypoint₁
           ╱
         ╱   (segment too short → no per-segment pill;
        ╱     cursor pill still shows total)
       ●  ghost
```

**Sidebar:**

```
[Selected]
  1st Pl
  Infantry, Platoon, dug-in
  Pos (12.3, 8.0)
  [ Stand up ]            ← existing controls

  [☐] Waypoint mode       ← toggle; Shift also enables transiently

[Undo last move]          ← appears only when move history non-empty

[End Move]
```

---

## 4. Interactions and edge cases

| Scenario | Behavior |
|---|---|
| Mouse leaves canvas mid-move | Live position freezes at last in-canvas position. Move stays selected. |
| Click outside canvas (sidebar/header) | No effect on the active move — doesn't commit, doesn't cancel. Sidebar buttons still work. |
| Player ends Move phase while a unit is selected | Move is **cancelled** (no commit, ghost & waypoints discarded). Move history clears. |
| Pan-by-drag while a unit is selected | **Disabled.** Wheel zoom still works. Pan resumes after commit/cancel. |
| Out-of-bounds move (off the map) | Allowed. The engine doesn't enforce bounds (trust-based, per requirements). |
| Move onto terrain | Allowed (terrain click-through is already enabled). |
| Click on enemy unit during a move | (Will defer to Unit-Info-Popup feature; this feature treats it as no-op for the move itself.) |
| Shift released between waypoint clicks | Toggle state wins. If sidebar Waypoint mode is on, clicks still add waypoints; if off, the next click commits. |
| Single waypoint click then commit | Treated as a two-segment path with one waypoint. One undo entry. |
| Undo when the unit has since been deleted | Skip that entry silently and pop the next. |
| Undo across phases | Not supported. History clears at end of Move phase. |

---

## 5. Decisions

| # | Decision | Notes |
|---|---|---|
| 1 | **Undo scope:** moves only in v1 | Creates / deletes / dug-in toggles are not undoable in v1. Expand later if it feels lacking. |
| 2 | **Keyboard shortcut for undo:** Ctrl+Z | Standard web idiom. |
| 3 | **Pan UX during move:** drag-pan disabled while a unit is selected | Wheel zoom remains active. Pan resumes after commit/cancel. Revisit if it feels limiting. |
| 4 | **Distance label format:** `12.3"` | Inches, one decimal. |
| 5 | **Escape cancels** | Yes. |
| 6 | **Clicks outside the canvas:** no effect | Don't cancel, don't commit. Sidebar buttons (Undo, End Move, Waypoint toggle) still operate normally. |
| 7 | **Line and label visuals** | Dashed line in team color (not grey/black — avoids reading as terrain). Two distance displays per §2.5: a cursor pill (always rendered, above/below symbol based on direction) plus per-segment pills centered on each segment (omitted if the segment is too short to render cleanly). |
| 8 | **Where move history lives** | In `GameState` as `moveHistory: Array<{ unitId; priorPosition }>`, cleared on `endMove`. `Game.undoLastMove()` is a new action method. Putting it in `GameState` (rather than UI state) is a deliberate forward investment toward a future replay / history feature, while keeping the v1 contract simple: history is per-Move-phase only and not persisted across turns. |
| 9 | **Waypoint trigger** | Hold **Shift** OR sidebar **Waypoint mode** toggle. The toggle exists primarily for touch / keyboardless play. |
| 10 | **Waypoint undo granularity** | A multi-segment path commits as **one** move; one undo restores the unit to its position before the first click of that path. |

---

## 6. Out of scope (this feature)

- **Multi-unit selection / group moves** — high-value for streamlining table-top play and flagged as a **v2 priority**, but kept out of v1 to constrain scope.
- **Movement-range enforcement** — per §1 design philosophy, the app trusts players. Distance is informational, not regulatory.
- **Touch-specific gesture polish** — Waypoint mode toggle covers the no-keyboard case; deeper touch optimization (long-press menus, pinch handling near a selected unit) is deferred.
- **Replay / fast-forward of move history** — one-step pop only in v1. Storing history in `GameState` (§5 #8) is the forward investment that makes a richer replay feature feasible later without rework.
- **Cross-phase undo** — history clears at End Move.
- **Undo of creates / deletes / dug-in toggles** — see §5 #1.

---

## 7. Implementation notes

### 7.1 Core (game logic)

**`GameState`**
- Add field: `moveHistory: Array<{ unitId: UnitId; priorPosition: Point }>` (initialized `[]`).
- Cleared by `Game.endMove()` after the standard end-of-Move bookkeeping.

**`Game`**
- `moveUnit(unitId, to)`:
  - Before mutating the unit's position, push `{ unitId, priorPosition: unit.getPosition() }` onto `state.moveHistory`.
  - (Multi-segment paths still produce a single entry because §2.6 treats the whole path as one move — only the path's final commit calls `moveUnit`, and the `priorPosition` recorded is the pre-path position. The UI is responsible for not calling `moveUnit` per intermediate waypoint.)
- `undoLastMove()` — new action method, validated to Move phase:
  - Pops the last entry from `state.moveHistory`.
  - If the unit still exists (`state.getUnitById(unitId)` non-null), restores its position via `unit.setPosition(priorPosition)`.
  - If the unit has been deleted since, silently pops the next entry until either a live unit is restored or the history is empty.
  - Does **not** re-run the vision phase (vision only runs at end-of-turn, per existing design).
- `endMove()`: after existing logic, clear `state.moveHistory = []`.

**Tests (`tests/core/Game.test.ts`):**
- `moveUnit` pushes onto `moveHistory` with correct prior position.
- `undoLastMove` restores prior position and pops the entry.
- Multi-undo walks back through multiple moves in LIFO order.
- `undoLastMove` skips deleted-unit entries.
- `endMove` clears `moveHistory`.
- `undoLastMove` outside Move phase throws (phase-validation parity with other actions).

### 7.2 UI (React + Konva)

**`MoveView` local state** (NOT in `GameState` — purely transient preview):
```ts
type ActiveMove = {
  unitId: UnitId;
  origin: Point;          // ghost position = unit.getPosition() at selection time
  waypoints: Point[];     // committed waypoints in order, ghost-to-cursor
  cursor: Point;          // live position, in map (inch) coords
  waypointModeToggle: boolean;
};
const [activeMove, setActiveMove] = useState<ActiveMove | null>(null);
```
Also track `shiftHeld: boolean` from `keydown`/`keyup` listeners; effective waypoint mode = `shiftHeld || waypointModeToggle`.

**Click handling on `MapCanvas`:**
- If no `activeMove`: clicking an own unit starts one. Ghost stays at `unit.getPosition()`; that unit's `UnitToken` should render with reduced opacity for the duration of the move (pass a `ghosted` prop into `UnitToken`, or render the live preview as a separate token and skip the original).
- If `activeMove` exists:
  - Click on the **same selected unit** → cancel (clear `activeMove`, no game state change).
  - Click on a **different own unit** → cancel current, start new on that unit.
  - Click on **map background or terrain**, with waypoint mode → push current cursor into `waypoints`.
  - Click on **map background or terrain**, without waypoint mode → call `dispatch(g => g.moveUnit(unitId, cursorPoint))`, then clear `activeMove`.
- `pointermove` on the stage updates `cursor` (converted from screen to inch coords using `pixelsPerInch` and the layer's current transform).
- `Escape` keydown → cancel.

**New canvas component: `MovePreviewLayer`** (renders inside `MapCanvas`, above units layer):
- Dashed `Line` segments in team color (`theme.colors.friendly` or `.hostile` based on the active player's perspective) connecting `origin → waypoints[0] → … → waypoints[n-1] → cursor`.
- For each segment, compute its on-screen length. If ≥ a per-segment-pill threshold (start at ~48 px), render a centered `DistanceLabel` that breaks the dashes (Konva: render the line as two halves with a gap, or draw the label's background pill over the line — pill background already opaque white, simpler).
- One **cursor pill** anchored to the live unit symbol position, offset above or below based on `sign(cursor.y - origin.y)` (moving up → pill below symbol; moving down → pill above). Shows cumulative distance through all waypoints to the cursor.

**New small component: `DistanceLabel`** — Konva `Group` with white `Rect` + team-color stroke + team-color `Text`. Centered on a given anchor point. ~10px font.

**Live unit preview** while moving: easiest path is to render a second `UnitToken` at `cursor` with `selected={false}` and full opacity, and pass a `ghosted` prop to the original `UnitToken` to render at low opacity. (Alternative: stash a `previewPosition` on the unit; rejected — would entangle preview with persisted state.)

**Sidebar (`MoveView`):**
- Add the **Waypoint mode** toggle (checkbox or switch) — visible only when a unit is selected for moving.
- Add the **Undo last move** button — visible whenever `game.state.moveHistory.length > 0`. Click → `dispatch(g => g.undoLastMove())`.
- Hook `Ctrl+Z` at the view level (only while the view is mounted) to the same handler.

**Pan suppression:** when `activeMove != null`, set `MapCanvas`'s `draggable={false}` (currently always true). Wheel-zoom path is unaffected.

### 7.3 Order of work

1. Core changes + tests (`GameState.moveHistory`, `Game.undoLastMove`, push on `moveUnit`, clear on `endMove`).
2. Sidebar Undo button wired to `undoLastMove` (works with existing teleport-on-click — proves the core path before touching the canvas).
3. `Ctrl+Z` shortcut.
4. `MoveView` local `ActiveMove` state + live preview (ghost + live token + straight dashed line + cursor pill). No waypoints yet.
5. Per-segment pill rendering.
6. Waypoint mode (Shift + sidebar toggle, multi-segment path).
7. Pan suppression while a unit is selected.
8. Edge-case pass against §4 table.
