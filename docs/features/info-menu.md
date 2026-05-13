# Feature: Info Menu

**Status:** Approved
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-12

---

## 1. Motivation

This feature is primarily about **organization and discoverability**.

- **Consolidate unit information into one location.** Unit details currently live in the Move-phase sidebar's "Selected" section. That couples unit info to a specific phase and a specific selection action, and the sidebar mixes per-unit info with phase-control buttons. The info menu becomes the single canonical place where unit (and terrain) information is displayed.
- **Surface hidden info.** Terrain stealth modifiers are not currently visible anywhere in the UI — players have to know the rules to play around them. Bringing stealth modifier information into the panel is a new piece of information being exposed, not just a relocation.
- **Foundation for future unit data and contextual actions.** As units are extended with new stats, states, and abilities, the info menu is the landing point for that new data — the panel is sized and structured to grow rather than continually expanding the sidebar. The same applies to context-sensitive actions: v1 only migrates the existing dig-in toggle, but future per-unit actions land here too.

---

## 2. User-facing behavior

### 2.1 Panel location and appearance

A fixed rectangular panel sits at the **bottom center** of the screen, overlaying the map. It is always visible and always shows something (hover content, selection-locked content, or a neutral idle state). The panel does not scroll or expand — all content fits within a fixed height.

### 2.2 Hover mode (default)

When no unit is selected and the player is hovering the map, the panel shows info for whatever is under the cursor:

**If the cursor is over a unit:**
- The unit's NATO milsymbol (small, same rendering as map)
- Name and size classification
- Current map position (x, y inches)
- Vision state label:
  - Own / friendly unit: `"Not revealed"` or `"Revealed"` — whether the unit is currently revealed. The visual ring on the map already conveys this, but the text label is explicit and accessible. Friendly units never show a `"Detected"` state — by design, a player should not know whether their own unit has merely been detected versus fully revealed.
  - Enemy unit: `"Detected"` or `"Revealed"` — corresponds to the standard discover/reveal vision states for enemies the active player can see.
- Dig-in button (Infantry only):
  - Friendly unit: active toggle button, same function as current sidebar button
  - Enemy unit: non-interactive indicator showing current dig-in state (label only, no button)
- Stealth modifier at the unit's current position. The number shown is the **single highest applicable concealment multiplier** at this position (modifiers do not stack — `VisionCalculator` takes `max(intrinsic, terrain…, inherent like dug-in)`). Examples: `Stealth ×3 (Tall Woods)`, `Stealth ×2 (dug in)`, or `Stealth ×1 (none)` if no modifier applies.

**If the cursor is over terrain (and no unit is at that pixel):**
- Terrain type name
- Stealth multiplier (if area terrain): the value from `polygonStealthModifier` — e.g. `Stealth ×3` for Building / Tall Woods, `Stealth ×2` for Short Terrain
- A short human-readable rule description tied to the actual mechanic. The mechanic, paraphrased from `VisionCalculator.canDetect`, is: an observer can detect a target only when `distance ≤ observer.vision ÷ effective_stealth`. The terrain's multiplier becomes the target's `effective_stealth` if it is the highest applicable modifier (modifiers do not stack — only the single highest applies). Sample descriptions:
  - **Building** — *"A unit inside this building multiplies its stealth by ×3 against observers, shrinking the range at which it can be detected. Buildings only apply this modifier to units that are inside them."*
  - **Tall Woods** — *"A unit with a line of sight passing through tall woods multiplies the target's stealth by ×3, even if neither unit is inside the woods. Tall woods also block sight beyond a ray length of 4 inches inside."*
  - **Short Terrain** — *"A unit with a line of sight passing through short terrain multiplies the target's stealth by ×2. Short terrain does not block sight."*
- If no special terrain: `"Terrain Type: Open (none)"`

**If the cursor is over empty map with no terrain:**
- `"Terrain Type: Open (none)"`

### 2.3 Selection-locked mode

When a unit is **selection-locked**, the panel ignores hover and displays that unit's info regardless of where the cursor is. The same unit-info layout as §2.2 applies. A subtle visual indicator (e.g. a small lock icon or a "Selected" label in the panel header) distinguishes locked mode from hover mode.

**Any visible unit is selectable in any phase.** Clicking any visible unit (own or enemy, regardless of phase) selects it and locks the info menu to it. A highlight ring is drawn around the selected unit on the map.

A selection is cleared by any of:
- **Clicking the same unit again** (toggle off).
- **Clicking off the unit** — empty map or terrain (provided that click has no other meaning in the current phase, e.g. committing a Move-phase active move).
- **Pressing Escape.**

When a selection is cleared, the highlight ring disappears and the panel reverts to hover mode.

**Selection vs. phase-specific actions.** Selection is panel-state only; it does not by itself start a move, fire, or any other phase action. In Move phase specifically, the existing behavior of "clicking an own unit starts an active move" is preserved — the active move and the info-menu selection are layered. Clicking an own unit during Move phase both selects it (locks the panel) AND starts an active move. Committing the move (a click on empty map) naturally "clicks off the unit" and so clears the selection by the rule above. Escape both cancels the active move and clears the selection. Enemy units are never given phase-specific actions in v1 — clicking them only selects them.

> Click-to-select-any-visible-unit is new behavior. Previously, enemy clicks were a no-op and own-unit clicks only had meaning in Move phase.

### 2.4 Dig-in button migration

The dig-in button currently lives in the Move-phase sidebar. Once the info menu is built, the sidebar button is **removed** and the info menu dig-in button becomes the sole way to toggle dig-in. The dig-in button is only actionable on friendly Infantry; all other unit info displays show the state as read-only text.

---

## 3. UI sketch

```
┌─────────────────────────────────────────────────────────────────────┐
│  MAP (full screen)                                                  │
│                                                                     │
│                                                                     │
│         ◯  ← enemy highlight ring around an enemy unit on map      │
│                                                                     │
│                                                                     │
│  ╔═══════════════════════════════════════════════════╗              │
│  ║  [lock]  [sym]  Bravo Co. · Infantry · Company    ║              │
│  ║  Pos (12.5, 8.3) · Revealed · Dug in              ║  ← info     │
│  ║  Stealth ×3 (Tall Woods)              [Stand up]  ║    menu     │
│  ╚═══════════════════════════════════════════════════╝              │
└─────────────────────────────────────────────────────────────────────┘
                (panel centered, fixed to bottom of viewport)
```

---

## 4. Edge cases

| Scenario | Behavior |
|---|---|
| Cursor exits the map entirely | Panel shows the idle string `"Location is out of the map area"` |
| Two overlapping units at same pixel | Show info for the topmost unit (same z-order as click handling) |
| A unit is selected and cursor leaves map | Panel stays locked to selected unit (selection overrides hover, including idle) |
| Selected unit and player presses Escape | Selection clears, highlight ring disappears, panel reverts to hover mode |
| Selected unit and player clicks empty map / terrain | Same as Escape (selection clears). Exception: in Move phase, a click on empty map commits the active move first — but a Move commit is itself "clicking off the unit," so the selection ends up cleared by the same rule. |
| Selected unit and player clicks the same unit again | Selection toggles off (clears) |
| Selected unit and player clicks a different visible unit | Selection moves to the new unit; ring follows |
| Panel shows enemy info: dig-in state changes mid-hover (e.g. another player's turn could not happen, but the state is reactive) | Panel re-renders to reflect current state |
| Unit moves off area terrain mid-move (cursor position changes terrain) | While the active move is in progress and the panel is locked to the moving unit, the stealth-modifier line updates based on the unit's **live cursor position**, not the stored position |
| Terrain under cursor spans multiple terrain types (overlapping polygons) | Show the topmost / highest-priority terrain type (same convention as `getConcealmentModifiersAlongRay`) |
| Long info string overflows the panel | Content is allowed to bleed past the panel's visual edge rather than truncate or wrap awkwardly. Authors must avoid producing long strings — see §5 decision 3. |
| Phase changes while a unit is selected | Selection persists across phase changes — the info menu is phase-agnostic |

---

## 5. Recorded decisions

1. **Idle-state string** — when the cursor is off the map and no unit is selected, the panel shows `"Location is out of the map area"` (or similar). The panel never disappears.

2. **Selection works in any phase, on any visible unit.** Both own and enemy units are selectable in all phases as long as they are visible to the active player. Selection is a panel-level concept; it is layered on top of phase-specific actions rather than replacing them (see §2.3). Selection is cleared by: clicking the same unit again, clicking off the unit, or pressing Escape.

3. **Panel is fixed-size, sized for the maximum reasonable content.** The panel does not grow or shrink with content. The size is chosen so that "typical" content fits comfortably. If a string is unusually long, it is allowed to **bleed past the panel edge** rather than wrap or truncate. The implicit design constraint is that authors must endeavour to keep all surfaced strings short — long rule descriptions or unit names are a content bug.

4. **Symbol in panel is fixed-size, independent of map zoom.** The NATO milsymbol shown inside the info menu does not scale with the map's zoom level. It renders at a fixed pixel size — roughly "a bit bigger than the map-rendered symbol at average zoom" — so it is always legible regardless of how zoomed-in or out the map is. This is one of the motivations for putting the symbol in the panel at all.

5. **Feature ships in two stages.**
   - **Stage 1 — unit info only.** Hover-over-unit and selection-locked-on-unit, plus the dig-in migration (§2.4). The terrain-hover sub-behavior of §2.2 (the "If the cursor is over terrain" and "If the cursor is over empty map with no terrain" cases) is **deferred to stage 2**. During stage 1, when the cursor is over the map but not over a unit, the panel shows the idle string from decision 1.
   - **Stage 2 — terrain hover.** Adds the terrain-info display to the panel once terrain rendering / hit-testing is wired up enough to answer "what's at this cursor position?". A separate design doc may or may not be needed for the underlying terrain pipeline — that's a judgment call to make when we get there, not a hard prerequisite.

## 6. Open questions

*None outstanding. The terrain-pipeline design question is captured under §5 decision 5 as a stage-2 concern to evaluate when stage 2 starts.*

---

## 7. Out of scope (v1)

- Terrain hover (deferred to stage 2 — see §5 decision 5)
- Terrain detail for non-area terrain types (roads, rivers) — also a stage-2-and-beyond concern; terrain rendering not yet fully implemented
- Clicking the info panel to follow a unit (camera track)
- Multi-unit selection summary (aggregate stats for a group)
- Phase-specific info overlays (e.g., fire arcs during FireDeclare phase)

---

## 8. Implementation notes

Stage 1 lifts unit selection from per-phase state to an app-level concept, surfaces hover information from `MapCanvas`, and adds a bottom-center panel that observes both signals.

### 8.1 Selection / hover state — new context

Introduce a `SelectionProvider` mounted in `App.tsx` so the state survives phase transitions:

```ts
interface SelectionContextValue {
  selectedUnitId: UnitId | undefined;
  setSelectedUnitId(id: UnitId | undefined): void;
  hoveredUnitId: UnitId | undefined;
  setHoveredUnitId(id: UnitId | undefined): void;
  cursorOnMap: boolean;
  setCursorOnMap(on: boolean): void;
}
```

Phase views read `selectedUnitId` from this context instead of holding their own `selectedId` state.

### 8.2 MapCanvas + UnitToken changes

- Add `onUnitHover?: (unit: Unit | null) => void` on `MapCanvas`, threaded to each `UnitToken` (fires on Konva `onMouseEnter` / `onMouseLeave`).
- Wrap the canvas container `<div>` with native `onMouseEnter` / `onMouseLeave` handlers to drive `setCursorOnMap`.
- `selectedUnitId` continues to be a `MapCanvas` prop; phase views now source it from selection context. The existing selection-ring on `UnitToken` is reused as the §2.3 highlight ring (no new ring needed).

### 8.3 InfoMenu component (new file)

`src/ui/components/InfoMenu.tsx`. Fixed-position div, bottom-center, fixed size (per §5 decision 3). Reads from `useSelectionContext()` and `useGameContext()`.

Render priority:
1. `selectedUnitId` set → unit info for that unit, with lock indicator.
2. Else `hoveredUnitId` set → unit info for that unit, no lock indicator.
3. Else `cursorOnMap` → short hint like `"Hover a unit to inspect."` (terrain hover is stage 2 — see §5 decision 5).
4. Else → `"Location is out of the map area"`.

Unit info content (§2.2):
- Mini NATO milsymbol at a fixed pixel size, independent of map zoom (reuse the `buildSidc` helper from `UnitToken.tsx`).
- Name · type · size.
- Position `(x.x, y.y)`.
- Vision state:
  - Friendly: `visionState.revealed.has(id)` → `"Revealed"`, else `"Not revealed"`.
  - Enemy: `revealed.has(id)` → `"Revealed"`; in active player's `teamLists` but not revealed → `"Detected"`.
- Dig-in (Infantry only):
  - Friendly Infantry → interactive `Dig in` / `Stand up` button calling `dispatch((g) => g.toggleDugIn(id))`.
  - Enemy Infantry → read-only `"Dug in"` / `"Standing"` text.
- Stealth modifier at the unit's current position. Compute the single highest applicable concealment modifier by combining the unit's `getInherentConcealmentModifier()` with the area-terrain modifiers that contain the unit's position (`map.polygons` `containsPoint` for `Building` / `TallWoods` / `ShortTerrain`). Display the ×N value and a one-word source label (e.g. `Stealth ×3 (Tall Woods)`, `Stealth ×2 (dug in)`, `Stealth ×1 (none)`).

### 8.4 Move-phase wiring

`MoveView` keeps `activeMove` local but reads `selectedUnitId` from the selection context (replacing the local `selectedId` useState). Click behaviors update both:
- Click own unit (not already in active move) → start active move **and** `setSelectedUnitId(unit.id)`.
- Click the unit that's in active move → cancel active move **and** `setSelectedUnitId(undefined)`.
- Click empty map (Move commit, non-waypoint mode) → dispatch move **and** `setSelectedUnitId(undefined)`.
- Escape → cancel active move **and** `setSelectedUnitId(undefined)`.
- Click enemy → `setSelectedUnitId(enemy.id)` only (no movement; Move phase has no enemy action).

### 8.5 Other phases

- `DeploymentView`: add `onUnitClick={(u) => toggleSelection(u.id)}`; placement (`onMapClick`) also clears the selection.
- `FireDeclareView`: own-unit click both toggles fire **and** sets selection; enemy click only sets selection.
- `TransitionView`: no change (no map interaction).
- Click on empty map in any view: `setSelectedUnitId(undefined)`. Where a view already has a phase-specific `onMapClick` (Move commit, Deploy placement), that handler chains the clear.

### 8.6 Sidebar dig-in removal

Remove the `<SidebarButton>Dig in / Stand up</SidebarButton>` block from `MoveView.tsx` (sidebar's "Selected" section). InfoMenu becomes the sole dig-in toggle. Other Selected-section content (name, type, size, position) is also redundant once the InfoMenu ships — leave it in place for stage 1 only if it's still useful as a fallback; otherwise remove it too.

### 8.7 Order of work

1. `SelectionProvider` + plumbing into App.
2. `onUnitHover` + cursor-on-map signal on `MapCanvas` / `UnitToken`.
3. Selected-unit highlight ring already exists via `UnitToken.selected`; verify it shows when selection is set in any phase.
4. `InfoMenu` component, idle and unit-info displays.
5. Migrate `MoveView` selection state to context (including post-commit / Escape clears).
6. Add selection wiring in `DeploymentView` and `FireDeclareView`.
7. Remove dig-in button from sidebar; collapse redundant sidebar "Selected" content.
8. Edge-case pass against §4.
