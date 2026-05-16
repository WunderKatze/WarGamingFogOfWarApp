# Feature: Game Menu

**Status:** Approved
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-16

---

## 1. Motivation

The app is acquiring features that don't fit cleanly into any phase view: restart, eventual map editing, eventual save/load, vision-rule tuning, and debug aids. These are *app-level* affordances — they need a single landing place that doesn't crowd the sidebar or pollute the phase-specific UI.

This feature introduces a **Game menu** opened from a button in the top-right corner. It's the home for cross-cutting actions today and a growth point for more in the future.

The most substantive item on the menu is **Adjust Vision Rules** — a runtime-editable view of the values that today live as imported constants in `config.ts`. Making them mutable also opens the door to future scenario mechanics (e.g., a night-start game with reduced vision that transitions to day mid-match) without re-touching every read site each time.

---

## 2. User-facing behavior

### 2.1 Menu chrome

- A single button in the top-right of the screen with a hamburger glyph (`☰`) and the label `Menu`. Clicking opens a dropdown panel anchored to the button.
- Clicking outside the panel, or pressing Escape, closes it.
- The menu is visible during every phase except the Transition screen (consistent with the info-menu rule from `info-menu.md`).
- The bottom-left **Restart game** button is **removed**; restart is exclusively reached via the menu.

### 2.2 Menu items

The dropdown contains five entries in this order:

1. **Restart game** — same behavior as today's bottom-left button (browser `confirm()` then `reset()`).
2. **Edit map** — placeholder. Clicking shows a small "Map editing comes in a later release" notice. Hooks into the map-creator feature when that lands.
3. **Load game** — placeholder. Clicking shows a similar notice. Hooks into the save/load feature when that lands.
4. **Adjust Vision Rules** — opens the vision-rules editor (§2.3).
5. **Debug options** — opens the debug panel (§2.4).

Items 4 and 5 open sub-panels that take over the menu surface; a "back" affordance returns to the top-level menu.

### 2.3 Adjust Vision Rules

A scrollable panel listing every rule value, grouped by section:

**Unit type stats** — per `UnitType` (Infantry, Tank):
- Base vision (inches)
- Base stealth (multiplier)

**Modifiers**:
- Recon vision multiplier
- Recon stealth multiplier
- Dug-in stealth multiplier

**Terrain stealth multipliers** (one row per kind in the catalog):
- Building, Tall Woods, Short Terrain, Short Wall (Tall Wall is shown read-only since it has no stealth multiplier — only blocks LOS)

**Terrain blocking parameters**:
- Tall woods ray-through limit (inches)

Each numeric field is a free-form `input type="number"` — no steppers, no enforced increments, just validation that the value is positive. Changes take effect immediately and the next vision phase uses new values. A **Reset to defaults** button reverts all values to the built-in baseline; this prompts a `confirm()` first because it discards any in-progress edits.

Any change to a rule value mid-game also flips a `rulesChangedThisTurn` flag on `GameState` so the next player's Transition screen shows a notice (see §2.4 and §2.5).

**Saved rule sets** — a section at the top of the panel:
- A dropdown of saved rule sets (built-in "Default" plus any user-named ones).
- Selecting a set loads its values into the editor and activates them. Mid-game switches confirm first (same reasoning as Reset to defaults).
- A `Save current as…` button captures the current editor values under a user-supplied name.
- A `Delete` button next to user-defined sets (not the built-in Default).
- An `Export…` button writes the currently selected set to a JSON file the player can save anywhere on disk.
- An `Import…` button reads a JSON rule-set file and adds it to the dropdown (prompting for a name if the file's embedded name collides with an existing one).

Rule sets persist to browser `localStorage` under a single key. The active rules also persist so the player's last choice survives a page refresh or browser restart. File export/import is the path for sharing rule sets between users or backing up across devices.

### 2.4 Debug options

A panel with a single toggle (in v1):

- **Show all units** — when on, every unit on the map is rendered regardless of faction or team-detection state. **This does NOT modify the `Revealed` set** — physical-table placement instructions are unaffected, vision calculations are unchanged, and the highlight ring / "Revealed" label keep their normal meaning. It's purely a viewing override for when players are confused about the current state or when testing vision rules.

When the player ends a turn in which Show all units was on at any point, the next player's **Transition screen** displays a notice:

> ⚠ The previous player used Debug Mode this turn.

The notice is shown alongside the normal "Start Turn" content; it doesn't block the next player from starting their turn. Using debug mode does not restrict any other functionality (saves still work, etc.) — the notice is the only consequence.

The Show all units toggle itself is **session-only** — page refresh clears it, so debug state doesn't silently persist. The `debugUsedThisTurn` flag that drives the notice lives on `GameState` and is consumed (cleared) by the Transition screen when the next player taps "Start Turn." Because it's part of `GameState`, it survives a future load/save of the game — restarting the app, loading the in-progress game, and starting the next turn still shows the notice.

### 2.5 Transition-screen notices summary

The Transition screen between turns now hosts two possible cross-turn notices, surfaced when the *previous* player's actions warrant them:

- `⚠ The previous player used Debug Mode this turn.` — set when Show all units was toggled on at any point during the prior turn (§2.4).
- `⚠ Vision Rules changed this turn.` — set when any vision-rule value was modified during the prior turn (§2.3). The notice intentionally does not list which values changed in v1; "rules changed" is enough to prompt the next player to check the Adjust Vision Rules panel if they want details.

Both notices are visible simultaneously when both flags are set. Both clear (consume) when the next player taps "Start Turn." The two flags live on `GameState` (`debugUsedThisTurn`, `rulesChangedThisTurn`) so they survive a save/load of the game.

### 2.6 Behavior when other UI is active

- Opening the menu does not interact with the info menu — both can be visible at once (the info menu is bottom-center, the Game menu is top-right).
- Opening the menu does not cancel an active move or selection.
- Clicking inside the menu does not propagate to the map below.

---

## 3. UI sketch

```
┌──────────────────────────────────────────────────────────┐
│  Header                                       [☰ Menu ▾] │
├──────────────────────────────────────────────────────────┤
│                          MAP                             │
│                                                          │
│                                                          │
│                                                          │
│                       [info menu]                        │
└──────────────────────────────────────────────────────────┘

Top-level dropdown (closed by default):

   ┌────────────────────────────┐
   │  Restart game              │
   │  Edit map                  │
   │  Load game                 │
   │  Adjust Vision Rules    ▸  │
   │  Debug options          ▸  │
   └────────────────────────────┘

Adjust Vision Rules sub-panel:

   ┌──────────────────────────────────┐
   │  ← Back            Rule Set ▾    │
   │   ─────────────────────────────  │
   │   Unit type — Infantry           │
   │     Base vision   [48      ]"    │
   │     Base stealth  [1.333   ]     │
   │                                  │
   │   Unit type — Tank               │
   │     ...                          │
   │                                  │
   │   Modifiers                      │
   │     Recon vision×  [1.333  ]     │
   │     Recon stealth× [1.333  ]     │
   │     Dug-in        ×[2      ]     │
   │                                  │
   │   Terrain                        │
   │     Building     ×[3      ]      │
   │     Tall Woods   ×[3      ]      │
   │     Short Terrain×[2      ]      │
   │     Short Wall   ×[2      ]      │
   │     Tall Wall      blocks LOS    │
   │     TW ray limit  [4      ]"     │
   │                                  │
   │   [ Save current as… ] [ Reset ] │
   └──────────────────────────────────┘

Debug options sub-panel:

   ┌────────────────────────────────┐
   │  ← Back                        │
   │                                │
   │   [✓] Show all units           │
   │       View-only override — does│
   │       NOT affect Revealed.     │
   └────────────────────────────────┘
```

---

## 4. Edge cases

| Scenario | Behavior |
|---|---|
| Menu opens while an active move is in progress | Menu opens normally. The active move is not cancelled. Map clicks under the menu are blocked by the menu surface (overlay). |
| Editing a rule value mid-turn | Rule takes effect immediately. The next call to `VisionCalculator` (next phase or next vision recompute) uses the new value. There is no retroactive recompute of the current vision state. |
| Editing a rule that crosses zero / negative | Inputs reject values ≤ 0 for multipliers and distances. The field stays editable but the rules object isn't updated until the value is valid. |
| Selecting a saved rule set with a name that no longer exists in localStorage | Falls back to Default and shows a small notice. |
| Browser localStorage unavailable / quota exceeded | Saved rule sets degrade to session-only; the editor still works. Show a one-time warning. |
| Show all units toggled on, then off, all within one turn | Still surfaces the "debug used" notice to the next player. The flag is "debug was ever on during this turn," not "is currently on." |
| Player restarts the game while debug mode was used | Restart clears all per-game state including the debug-used flag. Confirmation dialog wording is unchanged. |
| Page refresh during a turn | The whole in-memory game is lost (no auto-save in v1). Both flags (`debugUsedThisTurn`, `rulesChangedThisTurn`) and the Show All Units toggle vanish with it. Once Save/Load games ships, an in-progress game can be reloaded and the flags reappear from the saved `GameState`. |
| Menu open during Transition screen | Menu is not rendered on the Transition screen (parallels info menu). |
| Saved rule set has values from a newer schema (extra keys) | Unknown keys ignored; known keys loaded. Missing keys fall back to default. |
| Imported rule-set file is malformed JSON or missing required keys | Show a "Couldn't read rule set" error toast; nothing is added to localStorage. The active rules are unchanged. |
| Imported rule-set name collides with an existing saved set | Prompt the player to rename, overwrite, or cancel. |
| Vision rules edited multiple times during a turn | A single `Vision Rules changed` notice on the next Transition screen — the flag is a boolean, not a counter. v1 does not list which fields changed. |
| Both debug mode and rule changes happen during the same turn | Both notices are shown on the Transition screen, stacked. |

---

## 5. Recorded decisions

1. **Name is "Game menu" (working title).** Distinguished from the dropped §4.1 "Main menu" startup screen of `docs/requirements.md`.
2. **The startup "Main menu" screen is dropped from v1.** The app opens directly into a blank-map Team A deployment. A non-game start state may exist later but does not require its own screen.
3. **Vision rules are global**, persisted to browser `localStorage`, not per-game. Loading or saving a *game* (separate v1 feature) does not capture or restore rules. The currently-active rules apply to whichever game is in progress.
4. **Built-in "Default" rule set** matches today's hardcoded constants exactly and cannot be deleted or overwritten.
5. **Show all units is session-only.** The accompanying flag that drives the next-turn notice lives on `GameState` (`debugUsedThisTurn`) and is consumed when the next player taps "Start Turn." Because it's on `GameState`, a future save / load of the in-progress game preserves the notice.
6. **Show all units overrides the rendering filter only.** Every unit is drawn regardless of faction / team-detection state, but the `Revealed` set, vision calculations, and physical-table placement instructions are all unchanged.
7. **Restart game moves into the menu.** The current bottom-left button is removed.
8. **Edit map and Load game are placeholder buttons.** Both surface "coming in a later release" notices in v1; their real flows ship as separate v1 features.
9. **Rules are runtime-mutable** via a new core `Rules` object (see §8). Direct imports of value constants from `config.ts` are deprecated; reads go through rules. The terrain catalog's predicates and display strings consult rules at call time, not at module load.
10. **Menu button label.** `☰ Menu` — hamburger glyph + the word "Menu." Visual style is intentionally minimal; a broader appearance overhaul may revisit.
11. **Rule-editor inputs are free-form decimal entry**, validated only for "must be positive." No steppers / enforced increments — fast typing wins over typo-prevention here.
12. **Rule-set storage uses both localStorage AND file import/export.** localStorage is the always-on per-device store. File import/export complements it for sharing rule sets between users and backing up across devices.
13. **Using debug mode does not restrict any other functionality.** The next-turn notice is the only consequence; saves, loads, etc. all continue to work normally.
14. **Reset to defaults confirms; switching rule sets mid-game confirms.** Both actions discard in-progress edits, so both prompt a `confirm()` before applying.
15. **Vision-rule changes during a turn surface a Transition-screen notice.** Same machinery as debug mode (a `rulesChangedThisTurn` flag on `GameState`, consumed at "Start Turn"). Notice wording: `⚠ Vision Rules changed this turn.` A more elegant unified notification system is acknowledged future work (see §7).

---

## 6. Open questions

*None outstanding.*

---

## 7. Out of scope (v1)

- Real implementation of the **Edit map** flow (separate feature).
- Real implementation of the **Load / Save game** flow (separate feature).
- Per-game saved rules embedded in the game-save file (deferred; rules stay global in v1).
- Optional-rules toggles (enable/disable specific mechanics). The architecture supports this but no rules are toggleable in v1.
- Conditional / scenario rules (e.g., day-night transitions). The runtime-mutable Rules object is the v1-architecture enabler; the actual day-night feature ships separately.
- Touch-optimized rule editor layout (functional on tablet, but not specially designed for it).
- A **unified cross-turn notification system.** v1 hand-rolls two flags on `GameState` (`debugUsedThisTurn`, `rulesChangedThisTurn`) and renders matching notices on the Transition screen. As more "previous-player did X" notices accumulate (firing-related disclosures, future scenario events), this should be refactored into a generic notice queue. Out of scope for now; flagged so future contributors don't keep adding ad-hoc flags.

---

## 8. Implementation notes

> Filled in once the doc reaches Approved status. Sketch only for now — flesh out in detail before implementation.

### 8.1 Core: runtime-mutable Rules

- New `src/core/rules.ts` exporting:
  - A `Rules` type covering every value currently in `config.ts` (unit-type stats, modifier effects, dug-in modifier, polygon stealth multipliers, short-wall multiplier, tall-woods limit).
  - A `defaultRules: Rules` constant that exactly mirrors today's hardcoded values.
  - A mutable `currentRules` singleton + a `setRules(partial: Partial<Rules>)` setter + a `subscribeRules(fn)` listener API.
- Read-site refactor:
  - `Unit.getVision()`, `Unit.getIntrinsicStealth()`, `Infantry.getInherentConcealmentModifier()` → read from `currentRules`.
  - `terrainCatalog` entries: `stealthMultiplier` and `ruleDescription` become getters (defined via `get` syntax or as functions) that read live values. Predicates stay static (they don't depend on numeric tunables). `tallWoodsRayThroughLimit` consumed similarly inside `TallWoods.blocksRay`.
- `config.ts` keeps the const exports but they become *only* the default-rules source. Direct imports from `config.ts` get migrated to rules access; future contributors should not import from `config.ts` for runtime read sites.

### 8.2 UI: RulesProvider + editor

- New `src/ui/hooks/useRulesContext.tsx` — context wrapping the rules singleton; emits version bumps when `setRules` fires so React re-renders.
- New `src/ui/components/GameMenu.tsx` — top-right button + dropdown with sub-panel routing.
- New `src/ui/components/RulesEditor.tsx` — the §2.3 panel. Inputs are controlled, validate on change (positive numbers only), dispatch to `setRules`. Saved rule sets live under a single `localStorage` key (a JSON map of name → rule values). File import uses an `<input type="file">`; file export uses a Blob + `URL.createObjectURL` + a synthetic `<a download>` click. Each rule write also flips `GameState.rulesChangedThisTurn = true`.
- New `src/ui/components/DebugPanel.tsx` — §2.4 toggle. Toggling `showAllUnits = true` flips a flag in a new debug context; flipping it on for the first time during a turn sets a `debugUsedThisTurn` flag on the game.
- `App.tsx`: mount `RulesProvider` and `DebugProvider` alongside `SelectionProvider`. Remove the bottom-left `RestartButton`. Add `<GameMenu />` (mounted next to / above the InfoMenu).

### 8.3 GameState additions

- `GameState.debugUsedThisTurn: boolean` — set whenever Show All Units is toggled on at any point during the turn. Cleared at the start of the *next* player's turn after the Transition screen consumes it for the notice.
- `GameState.rulesChangedThisTurn: boolean` — set whenever any vision-rule value mutates during the turn. Cleared at the same point as `debugUsedThisTurn`.
- Both flags serialize with the game so a future load/save feature preserves them.
- Both flags clear on `Restart game` along with the rest of game state.
- Possibly a `GameState.rulesSnapshot` for future per-game-save support — not in v1.

### 8.4 Filtering "Show all units" without affecting vision

- Each phase view's `getVisibleUnits` helper currently does the team-list filter. Pass `showAllUnits` from context: when true, return `game.state.units` unconditionally. Crucially, `MapCanvas`'s `revealedUnitIds` prop is **not** modified by Show All Units — revealed visuals stay tied to the actual `visionState.revealed` set.

### 8.5 Transition screen notices

- `TransitionView` reads both `game.state.debugUsedThisTurn` and `game.state.rulesChangedThisTurn` (which carry forward from the *previous* turn at this point — the flags are set during turn N and consumed at the start of turn N+1's transition). Displays each notice independently, stacked, above or alongside the "Start Turn" content.
- Pressing "Start Turn" dispatches a clear-both-flags action that runs as part of (or just before) the existing `startTurn` path. Both flags reset to false before the new player begins their turn.

### 8.6 Order of work

1. Introduce `Rules` core + refactor read sites; verify 115 tests still pass.
2. Add `RulesProvider` context + `useRulesContext` hook.
3. Build `GameMenu` shell + Restart migration; remove bottom-left button.
4. Add placeholder Edit Map / Load Game items with "coming later" notices.
5. Build `RulesEditor` panel + localStorage save/load.
6. Build `DebugPanel` + Show All Units wiring + `debugUsedThisTurn` flag.
7. Update `TransitionView` to display the debug notice.
8. Edge-case pass against §4.
