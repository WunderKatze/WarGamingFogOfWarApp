# Feature: Mid-game roster (stop-gap)

**Status:** Complete
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-16

> **Scope note.** A sibling to [deployment-stop-gap.md](deployment-stop-gap.md) — both are deliberately-minimal patches that let the player manage units before V2 ships a proper transport mechanic. This doc covers roster changes **after deployment ends**: adding and removing units during the Move phase, and a new pre-Move **Add/Remove Units** phase for handling between-turn casualties and bailouts. V2 will replace the manual workflow with a dedicated transport / reinforcement mechanic.

---

## 1. Motivation

Real games change roster mid-fight:
- An infantry platoon climbs into a transport → the platoon disappears from the board (the transport carries them; the player is meant to remember).
- An infantry platoon climbs out of a transport → a new platoon appears on the board at the disembark point.
- A unit is destroyed by shooting → it has to be removed before the next turn begins.
- A transport is destroyed, the infantry inside bails out → a new platoon appears at the wreck.

Today's app has no mid-game roster moves. The Move phase only repositions existing units; there's no add or remove. The model APIs (`Game.createUnit`, `Game.deleteUnit`) exist for Move-phase use but no UI surfaces them, and there's no phase that runs *before* vision for casualty cleanup — so units destroyed during turn N's fire still appear in turn N+1's pre-Move vision until the player works around it.

This patch adds:
- Add / remove during the regular Move phase (for embarkation, mid-turn reinforcements arriving, etc.).
- A new **Add/Remove Units phase** that runs once before every Move phase, in which the player can add / remove units before the pre-Move vision phase fires.

---

## 2. User-facing behavior

### 2.1 Add a unit during Move

- The Move-phase sidebar gains a *Pen* section at the top mirroring the Deploy view: Name (optional), Type, Size, Recon, Dug-in toggle.
- Placement is **explicit** — the pen has a **Place new unit** button. Clicking it primes the next empty-map click; the click then creates the unit instead of doing the normal commit-move / clear-selection. Without priming, empty clicks keep their existing semantics, so a player who never adds units mid-Move sees no behavior change. Escape cancels the priming. (See §4 decision 5 for why this isn't a one-click empty-map-spawns flow.)
- Infantry default to **dugIn = false** during Move (existing `createUnit` default), since a unit just appearing isn't fortified.
- The added unit doesn't appear in any team's vision lists until the next vision-phase tick (which runs at `endMove`). This is intentional: the player can't get free reveals by spawning a unit, peeking, and removing it.
- Blank Name auto-generates (`I-N`, `T-N`); non-blank Name is consumed on placement. No Clone tool here — clone is Deploy-only in v1; mid-game one-offs (a single bailout, a single reinforcement) don't need it.

### 2.2 Remove a unit during Move

- The Selected sidebar panel (already used by the Deploy stop-gap for Move / Clone / Delete during Deploy) gets a **Delete** button when the selected unit belongs to the active player.
- Click → confirm prompt *"Delete {unit.name}?"* → unit is removed.
- The existing `Game.deleteUnit` already handles vision-state cleanup; nothing new in the model.
- Deleting the unit currently in an active move-preview cancels the preview.

### 2.3 Pre-Move Add/Remove Units phase

- A new game phase **Add/Remove Units** runs once between each Transition and Move. Turn order becomes:
  ```
  Transition → Add/Remove Units → Move → FireDeclare → Transition → …
  ```
- Internally the phase identifier is `"AddRemoveUnits"` for code-friendliness; the user-facing label is **"Add/Remove Units"**.
- Active player only. Same player-perspective rules as Deploy / Move.
- The phase view's sidebar is a stripped-down DeploymentView: just the *Pen* (for add) and the *Selected* panel with **Delete** (for remove). No Move…, no Clone (clone arrives later in v2-roster overhaul if it's needed), no repositioning (that's what Move is for).
- An **End Add/Remove Units** button advances to Move. Turn 1's phase opens with nothing to adjust; the player clicks End and proceeds. The phase always runs — there's no condition that skips it — to keep the state machine consistent.
- **Vision timing**: the pre-Move vision phase runs at `endAddRemoveUnits`, NOT at `startTurn`. So additions / removals during the Add/Remove Units phase are visible to (and seen by) units from the moment Move begins. This is what enables the use case: "remove the tank you killed last turn, add the infantry that bailed out at its wreck, then start Move with a vision phase that already knows about the bailout."

### 2.4 Recap of which actions are available in which phase

| Phase | Add | Remove | Reposition | Rename |
|---|---|---|---|---|
| Deploy (own player's deploy turn) | ✓ (`deployUnit`, dugIn defaults true) | ✓ | ✓ (free reposition, no undo stack) | ✓ |
| Add/Remove Units | ✓ (`createUnit`, dugIn defaults false) | ✓ | — | — |
| Move | ✓ (`createUnit`, dugIn defaults false) | ✓ | ✓ (committed moves, undo stack, dug-in clears on move per vision-rules-tweaks) | — |
| FireDeclare / Transition | — | — | — | — |

---

## 3. Edge cases

| Scenario | Behavior |
|---|---|
| Add/Remove Units phase, player makes no changes | Clicks **End Add/Remove Units** → Move begins normally. Same UX as today's auto-Move-start, plus one click. |
| Add/Remove Units phase, player deletes a unit that was in the previous turn's vision lists | `deleteUnit` purges all vision-state entries (existing behavior). The next vision phase (run at `endAddRemoveUnits`) recomputes from scratch. |
| Add/Remove Units phase, player adds a unit then changes mind | Select it → Delete. No undo. |
| Move phase, player adds a unit during their own move turn | Unit appears in the world but isn't in any vision list until `endMove`'s vision phase. Doesn't see / isn't seen until then. |
| Move phase, player deletes the unit currently being moved (active move preview open) | The active move preview cancels with the unit. |
| Move phase, player deletes a unit, then presses Ctrl+Z on a prior move of a *different* unit | The other unit's move is undone normally; the deleted unit stays deleted (no resurrection). `undoLastMove` already skips entries whose unit was deleted. |
| Add/Remove Units phase, the active player closes / refreshes the browser | Game state is lost (same as today — no autosave). |
| Add/Remove Units phase, player tries to add a unit at a position outside the map rect | Allowed silently in v1 (mirrors Deploy). Out-of-bounds units render off the rect; can be deleted and re-added. |
| Add/Remove → Move handoff: an enemy unit was in the previous-turn vision list but isn't visible to any current-turn observer | Standard reveal rule — `recentReveals.removed` will include it on the next Transition, telling the opponent to remove the token from the table. The Add/Remove Units phase doesn't change this; vision still authoritatively decides. |
| First Add/Remove Units phase right after first-player-select | Runs normally. Player has nothing to adjust on turn 1 → click End → Move. |
| A unit added during Add/Remove Units or Move (vs deployed in Deploy) — counts as "moved last turn" for GtG and similar? | **Yes** for mid-game additions; **no** for deployed units. See §4 dec. 4 and [vision-rules-tweaks.md](vision-rules-tweaks.md) §3. |
| Move phase, Place-new-unit primed, then the player starts an active move on an existing unit | Active move takes priority — the next click commits the move (or adds a waypoint), priming is silently ignored. The player can re-press Place after the move resolves. |
| Move phase, Place-new-unit primed, then the player clicks an existing own unit | Selection / active-move starts as today; priming sticks but is overridden by the move-in-progress rule above. Cleanest behavior is to clear priming on selection change — left as a stretch UX polish since the active-move handling already protects against accidental spawn. |

---

## 4. Recorded decisions

1. **The new pre-Move phase is called "Add/Remove Units"** (internal phase id: `"AddRemoveUnits"`). Picked over "Adjust" because it's literal — the phase only does adds and removes, and the label tells the player exactly what's available without jargon.
2. **The Add/Remove Units phase always runs**, including turn 1 right after first-player-select. State-machine consistency over saving one click; the turn-1 case is just an immediate End.
3. **Move-phase add UI lives at the top of the sidebar** (above the existing selected-unit / movement controls), mirroring the Deploy sidebar's pen-at-top ordering for muscle-memory continuity.
4. **Units added during Add/Remove Units or Move count as "moved last turn"** for [vision-rules-tweaks.md](vision-rules-tweaks.md)'s Gone to Ground check (and any future "stationary last turn" rule). **Units deployed during Deployment do NOT count as moved** on the first Move turn — they had time to settle in. This makes a fresh bailout / reinforcement vulnerable on the turn it arrives but lets deployed units immediately benefit from cover-stacking modifiers.
5. **Move-phase add uses explicit priming (Place new unit button) rather than every-empty-click-spawns.** Empty-map click in Move already has meaning (commit-move / clear-selection); silently overloading it would let the player accidentally spawn units while panning. Priming is one extra click per placement but eliminates the surprise. The Add/Remove Units phase has no such conflict, so its placements ARE one-click on empty map.

---

## 5. Out of scope (v1 stop-gap)

- **Transport mechanic** — a real "infantry is loaded into transport X" relationship that auto-handles disembark/load on a single click. v2.
- **Reinforcement schedule** — pre-game configuration of "units arrive on turn 3 from edge Y." Manual mid-Adjust adds cover this for now. v2.
- **Adjust phase undo stack** — Adjust mirrors Deploy: free changes, no undo. (Ctrl+Z is unbound during Adjust.)
- **Renaming or repositioning during Adjust** — repositioning is what Move is for; renaming was scoped to Deploy in the deployment stop-gap and we're leaving it there.
- **Clone during Adjust or Move** — could be useful but adds UX surface and is meaningful mostly for batch initial placement. Adjust adds are usually one-offs (a single bailout). Move adds are also usually one-offs. Defer to v2-roster if needed.
- **Auto-detecting destroyed units from the last turn's fire** — Adjust is manual roster cleanup; the player decides what was destroyed based on table state. A real damage / hits model is a separate v2+ feature.

---

## 6. Open questions

*None outstanding — all 4 answers captured into §4 decisions 1–4.*

---

## 7. Implementation notes

> Sketch only.

### 7.1 Model layer

- Add `"AddRemoveUnits"` to the `GamePhase` union in `GameState.ts`.
- `Game.startTurn`:
  - When deployment is incomplete: unchanged (→ Deploy).
  - When deployment is complete: increment `turnNumber`, set phase to **`"AddRemoveUnits"`**, and **do NOT run the vision phase yet**.
- New `Game.endAddRemoveUnits()`: `requirePhase("AddRemoveUnits")` → set phase to `"Move"` → run vision phase. This is where the existing pre-Move `runVisionPhase` migrates to.
- `Game.deleteUnit`: relax phase gate to allow `"Move"`, `"Deploy"`, **and `"AddRemoveUnits"`**.
- `Game.createUnit`: relax phase gate to allow `"Move"` and **`"AddRemoveUnits"`**.
- For §4 dec. 4 (just-added counts as moved): when GtG lands, the impl can derive "added mid-game" by tracking unit creation timing — either a per-unit `createdOnTurn` field on Unit, or by snapshotting "units present at end of previous turn" so newcomers stand out. Either works; deferred to the GtG implementation pass.

### 7.2 UI layer

- New `AddRemoveUnitsView.tsx` mirroring `DeploymentView` but slimmer: Pen + Selected (delete only) + Deployed list + **End Add/Remove Units** button. Reuses the pen layout; skip rename per §5.
- Extend `MoveView.tsx` with a Pen section and Delete-on-selected, both routed through `createUnit` / `deleteUnit`. Pen lives at the top of the sidebar.
- Add `"AddRemoveUnits"` case to the `ViewRouter` in `App.tsx`.
- Header phase label shows `"Add/Remove Units"` (with the slash) rather than the internal id.

### 7.3 Tests

- Game tests: turn handoff lands in AddRemoveUnits, not Move; `endAddRemoveUnits` enters Move and triggers vision; `createUnit` and `deleteUnit` accept AddRemoveUnits; turn 1 also enters AddRemoveUnits (smoke test).
- View tests aren't established yet for any phase view, so the existing pattern (no view tests) carries forward.
