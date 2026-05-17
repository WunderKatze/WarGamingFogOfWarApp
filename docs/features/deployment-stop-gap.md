# Feature: Deployment lifecycle (stop-gap)

**Status:** Approved
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-16

> **Scope note.** This is a deliberately-minimal mid-V1 patch on the existing
> Deploy view to round it out for tabletop use. The intended overhaul —
> richer symbol palette, drag-from-tray placement, faction-aware presets,
> symbol metadata beyond name — is deferred to its own feature doc in V2.
> This stop-gap ships now to unblock playable sessions.

---

## 1. Motivation

Today's Deploy phase ([DeploymentView.tsx](src/ui/views/DeploymentView.tsx)) is one-way: pick a pen, click the map, the unit lands. Once placed it can't be moved, renamed, removed, or duplicated within the same Deploy phase. In practice the player wants to:

- Reposition a unit they placed in the wrong spot (~2″ off, etc.)
- Delete a misclick (wrong size, wrong faction stamp, wrong type)
- Give units real names like `M4 Tank Platoon` or `B Coy` instead of auto-generated `I-3` / `T-2`
- Quickly drop several similar units (e.g. four identical infantry platoons) without re-configuring the pen between each one

Restarting the whole game to fix one bad placement is too heavy. This patch adds the four smallest things needed.

---

## 2. User-facing behavior

### 2.1 Reposition a deployed unit

- Selecting one of the active player's deployed units (existing click-to-select) puts the sidebar's *Selected* panel into reposition mode: a **Move…** button and a **Delete** button appear beside the unit's name.
- Clicking **Move…** primes a reposition: the next map click moves the selected unit to that position instead of placing a new one. **Escape** cancels.
- The pen settings (Type / Size / Recon / Dug-in) are ignored during reposition — only the unit's position changes.

### 2.2 Delete a deployed unit

- The **Delete** button in the *Selected* panel removes the unit.
- Confirm prompt: *"Delete {unit.name}?"* — accidental deletes during deploy are easy when click-targets are close together.
- No undo; redeploy by re-pen-and-place.

### 2.3 Custom unit names

- The pen sidebar gains a **Name (optional)** text field above the type/size selectors. Blank means auto-generate as today (`I-3`, `T-2`); non-blank uses the typed name verbatim for the next placement.
- After a normal placement, the name input **clears** so the next click doesn't reuse the previous name (otherwise three placements would all share the same name and silently collide). The clone tool (§2.4) is the exception: it intentionally repopulates the name with an incremented value.
- Each unit in the Deployed list also gets an inline-editable name: click the name → text input → Enter or blur commits, Escape cancels.

### 2.4 Clone a deployed unit

- The Selected panel gains a **Clone** button (alongside **Move…** and **Delete**).
- Clicking **Clone** copies the source unit's settings into the pen — type, size, recon, dug-in flag, and a numbered variant of its name (see below) — then primes the pen for the next placement. The next map click drops a copy at that point.
- The pen *keeps* the cloned settings after placement, so the player can keep dropping copies in a rhythm. Changing any pen field, or pressing Escape, breaks out of the cloning rhythm and resumes normal pen use.
- **Cloned-name pattern**: if the source name ends in a number (e.g. `M4 Tank Platoon 1`, `Alpha 7`, `I-3`), increment that trailing number until it's unique among the active player's deployed units. If the source name has no trailing number (e.g. `Alpha`), append ` 2` (and increment from there for further clones).

### 2.5 First-player selection after deployment

- Real wargaming usually has the players roll off to see who goes first. This deserves its own screen so the order isn't silently fixed by which team deployed first.
- After both players finish deployment, the Transition screen swaps the **Start Turn** button for a *"Who goes first?"* prompt with one button per team (e.g. **Team A goes first** / **Team B goes first**).
- Clicking a team's button sets the active player but **stays in Transition** — the chosen team's normal Start-Turn screen renders next. This soft-lands a misclick: the wrong team's Transition is just a Start-Turn prompt with no map shown, so the player can pass the device without revealing the opponent's setup.
- Only renders once, at game start. Subsequent turn handoffs use the unchanged Transition screen.

---

## 3. Edge cases

| Scenario | Behavior |
|---|---|
| Reposition primed, then unit selection cleared (e.g. click empty map) | Reposition aborts; next map click is a normal placement. |
| Reposition primed, then a different unit is selected | Reposition aborts and re-primes for the newly-selected unit (intuitive: you intend to move *that* one now). |
| Delete the unit currently primed for reposition | Reposition state clears with the unit. |
| Custom name collides with an existing deployed unit's name | Allowed silently. Names aren't unique keys; the unit id is. The player owns name uniqueness if they care. |
| Custom name field non-blank when player switches phase | Discarded — pen state is per-Deploy-phase. |
| Rename a unit to empty string | Reverts to current name (treat as cancel). |
| Reposition / delete during Move / FireDeclare | Out of scope — Move phase already has its own move + undo + delete flow. |
| Clone is clicked while a different unit is primed for reposition | Reposition aborts; pen takes on the cloned settings; next click drops the clone. |
| Clone after the source unit was deleted | The Selected panel is empty (no selection), so the Clone button isn't visible. No-op. |
| Clone increments past a million while finding a unique name | Practically n/a, but the search is bounded — at most `ownUnits.length + 1` iterations are needed since that many distinct names can't coexist. |
| First-player select: player clicks the wrong team's button | The chosen team's Start-Turn Transition renders (no map). Player passes the device to the right player, who can then either click Start Turn (accept the choice) or — if they want to correct — there's no in-game undo; the misclicked team plays first. Acceptable trade-off for the soft-landing rule. |
| First-player select: player taps Restart from the game menu before choosing | Restart resets to deployment, so the choice screen will render again after re-deploying. No special handling. |

---

## 4. Recorded decisions

1. **Reposition is click-then-click**, not drag. Drag would need Konva drag handlers on `UnitToken` that don't exist today and would interact poorly with touch (the player's table-side use case). Click-then-click works identically on mouse and touch.
2. **Rename UI lives in both places**: a Name field in the pen sidebar for set-on-placement, and an inline-editable name on each row of the Deployed list for after-the-fact edits. Cost of building both is low and removes a UX cliff.
3. **Auto-name format stays `I-3` / `T-2`** (first letter of type + sequential number) when the pen Name field is blank. Spelled-out `Infantry 3` adds little since most players rename anyway.
4. **Delete always confirms.** Skipping the confirm for "recently placed" or "no modifiers" would add code and rule complexity for a small UX win.
5. **Clone copies pen settings, not a one-shot place-and-revert.** The pen retains the cloned configuration after placement so the player can chain multiple drops without re-cloning. Changing the pen breaks the rhythm.
6. **Cloned name pattern is "increment the trailing number, or append ` 2`."** Keeps the player in a numbered series (`Alpha 1`, `Alpha 2`, `Alpha 3`) and avoids name collisions without prompting.
7. **First-player selection is two-step (select-then-confirm), not one-click.** Picking a team in §2.5 sets the active player but stays in Transition; the next click is the normal Start Turn. A misclick lands on the wrong team's Start-Turn screen (no map shown) rather than directly revealing their setup. Costs one extra click for the soft-landing rule.

---

## 5. Out of scope (v1 stop-gap)

- **Symbol palette / icon picker** beyond the current `Infantry` / `Tank` enum — v2.
- **Faction-aware presets** (e.g. a 1944 US Infantry preset that pre-fills size + recon + name template) — v2.
- **Drag-to-reposition** — click-then-click is enough; drag needs Konva drag handlers on UnitToken that don't exist today.
- **Bulk operations** — multi-select delete, multi-select rename — v2.
- **Renaming during Move / FireDeclare** — name edits land in Deploy only. Mid-game relabel needs a restart; acceptable for a stop-gap.
- **Name persistence / templates** ("save 'M4 Tank Platoon' for reuse") — v2.

---

## 6. Open questions

*None outstanding — all 4 doc-time questions plus the clone tool's UX shape are answered into §4 decisions 1–6.*

---

## 7. Implementation notes

> Sketch only.

### 7.1 Game-layer additions

- `Game.deleteUnit` already exists but `requirePhase("Move")`. Either drop the gate or add a new `deleteUnitDuringDeploy(unitId)` that mirrors it but requires `Deploy`. Same shape, different gate.
- `Game.moveUnit` requires Move; add `repositionDeployedUnit(unitId, position)` that requires Deploy and skips `moveHistory` (Deploy has no undo stack).
- `Unit.name` is already mutable — add a `Game.renameUnit(unitId, name)` that gates on phase (Deploy only for v1 per §5), trims, and rejects blank.
- No new Game method is needed for **clone** — the existing `deployUnit` is what the next placement uses. The "copy source to pen" logic lives entirely in the view.
- `Game.chooseFirstPlayer(teamId)` for §2.5: requires Transition, deployment complete, no prior choice, turn 0. Sets `activePlayerIndex` and `state.firstPlayerChosen = true`. Phase stays Transition.

### 7.2 UI-layer additions

- `DeploymentView` holds new state `repositionPrimedUnitId?: UnitId`. When set, `handlePlace` routes to `repositionDeployedUnit`; otherwise to `deployUnit`. Escape clears.
- Sidebar gains a *Selected* section that renders only when `selectedUnitId` is set and the unit belongs to the active player. Hosts the rename input, **Move…**, **Clone**, and **Delete** buttons.
- Pen sidebar gains a controlled **Name** input. Cleared after every successful normal placement; *not* cleared after a clone placement (the cloned name with its incremented number stays, and clicking Clone again increments further).
- Cloned-name resolution: small pure helper `nextCloneName(sourceName, existingNames)` that increments any trailing integer or appends ` 2`, skipping until the result is unique among `existingNames`. Unit-tested in isolation.

### 7.3 Tests

- Unit tests: phase gating on `deleteUnitDuringDeploy`, `repositionDeployedUnit`, `renameUnit`. Rename rejects empty / trims whitespace.
- Pure-function test: `nextCloneName` for the common patterns (`Alpha` → `Alpha 2`, `Alpha 2` → `Alpha 3`, `M4 Tank Platoon 7` → `M4 Tank Platoon 8`, `I-3` → `I-4`, collision-skipping).
- No vision-pipeline changes; no vision tests needed.
