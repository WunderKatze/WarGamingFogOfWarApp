# Feature: Vision rules tweaks (V1 polish)

**Status:** Approved
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-16

> **Scope note.** Three rule changes to bring the vision model to V1 playability. None is a system overhaul: 2.1 and 2.2 adjust existing per-unit / per-terrain hooks, 2.3 introduces a new modifier source ("Gone to Ground") that is the first **stacking** modifier — a small but meaningful break from today's "single highest" pool rule.

---

## 1. Motivation

Three issues surfaced in playtest:

1. **Dug-in survives movement.** A unit can dig in, move, and stay dug in for the entire turn. Conceptually digging in is a fortified static position; moving should reset it.
2. **Woods / short terrain hide observers as much as their targets.** Today a unit standing 1″ inside a forest peering out suffers the same `×N` stealth penalty on its LOS as someone trying to see *into* the woods. Real-world: scouts on the woodline see clearly out. Need a small grace distance.
3. **Static units in cover aren't differentiated from active units in cover.** A platoon that's been sitting in a treeline for two turns should be harder to spot than one that just arrived or fired this turn. Today's dug-in modifier handles Infantry (and only via explicit toggle) — Tanks have no equivalent.

---

## 2. Rule changes

### 2.1 Dug-in clears on movement

- When `Game.moveUnit` runs on an Infantry with `dugIn = true`, set `dugIn = false` as part of the move. Move-phase only.
- **Deploy-phase reposition does NOT clear dug-in** — repositioning during Deploy is *re-deployment*, not movement. The player is still configuring the starting state; clearing dug-in would force a re-toggle every time they nudged a unit's position.
- The toggle in the *Selected* panel remains available — the player can dig in again that same Move phase if they didn't actually move far. Re-toggling is an explicit re-action; doesn't auto-restore.
- Move-history undo (`undoLastMove`, `revertUnitMoves`) restores prior position and **also** restores prior `dugIn` flag so undoing a move doesn't strand the unit with the wrong state. Implementation: snapshot `dugIn` alongside `priorPosition` in each move-history entry.

### 2.2 Tall Woods / Short Terrain edge grace

- For **Tall Woods** and **Short Terrain** only, the stealth-multiplier check requires the ray's segment-length-inside-the-polygon to **exceed** a configurable grace distance (default **2″**) rather than be strictly greater than zero.
- New rule value `terrainEdgeGraceDistance: 2` in `rules.ts`, surfaced in the Adjust Vision Rules editor like the existing rules.
- Catalog change: `appliesAsConcealment(from, to)` becomes `segmentLengthInsidePolygon(from, to, poly.vertices) > getRules().terrainEdgeGraceDistance`.
- InfoMenu rule descriptions for these two terrains gain a phrase like *"; first 2″ inside the edge doesn't count."*

**Implication**: a unit ≤2″ from the inner edge of a treeline can see *out* of the woods at full vision (no woods penalty applies to the outgoing ray). A target ≥2″ deep inside the woods still benefits from the woods penalty when observed from outside. Asymmetric by design — rewards hugging the woodline.

**Building is excluded** — Building stealth already applies only when the *target* is inside the polygon (per the existing `containsPoint(to)` catalog entry), so "hard to see in, easy to see out" is already true for buildings without an edge-distance grace. The grace concept doesn't fit the binary inside-or-not rule. Walls are also unaffected — they have no concept of "depth inside."

### 2.3 Gone to Ground

- A new stealth modifier applied to **Infantry and Tank** units (every unit type in V1) when **all three** are true:
  1. The unit is currently sitting inside at least one polygon whose stealth multiplier is `>1` (i.e. cover-providing terrain — Building, Tall Woods, Short Terrain, or any future polygon kind).
  2. The unit did **not** move in the previous turn AND was **not** added mid-game during the previous turn. A unit deployed during the Deployment phase qualifies on the first Move turn (deployment isn't movement). A unit added during a previous turn's Add/Remove Units or Move phase counts as "moved" — it didn't have time to settle in.
  3. The unit did **not** fire in the previous turn (or has never fired).
- Effect: a **multiplicative stack** with the unit's other stealth contributors (terrain, dug-in, etc.). This is the first stacking modifier — every other stealth source is currently subject to "single highest." GtG multiplies on top of whichever single-highest source already applies.
- Default multiplier value: **`2`** (placeholder; vision-value rebalance pending — see §4 dec. 1).
- Display: InfoMenu shows the combined stealth as `×X (terrain) × ×Y (GtG) = ×Z`, per §4 dec. 5. A token marker is also drawn — see §2.4.

### 2.4 Token visual markers for dug-in and Gone to Ground

- Both modifiers are state-derived and easy to lose track of; on a busy table, players want to see at a glance which of their units are dug in and which qualify for GtG.
- Each token gains up to two small badges rendered next to the milsymbol:
  - **Dug-in** marker for any Infantry whose `dugIn === true`.
  - **GtG** marker for any Infantry or Tank that currently satisfies the §2.3 conditions.
- Both markers appear on **own units** by default. For revealed enemy units the GtG marker is hidden (since GtG state depends on per-side history the opponent doesn't fully see); the dug-in marker is also hidden for revealed enemies (consistent with not revealing posture). This keeps the markers a player-side tool, not an information leak — revisit if the v2 reveal-cascade rules ever change what's known.
- The InfoMenu also calls out both state flags in the existing detail row (already shows dug-in toggle; gains a "Gone to Ground" line when applicable).
- Visual specifics (icon glyphs, color, placement) are intentionally not pinned in the doc — they'll be tuned in the implementation pass with whatever reads cleanly at typical zoom levels.

---

## 3. Edge cases

| Scenario | Behavior |
|---|---|
| Unit dug-in, moved, then position-undone via `undoLastMove` | `dugIn` restored alongside position (§2.1). |
| Unit dug-in, moved 0.1″ (precision touch) | Counts as a move; `dugIn` clears. We don't gate on minimum distance — the player either moved or didn't. |
| Unit dug-in, repositioned during Deploy via `repositionDeployedUnit` | `dugIn` is preserved — Deploy reposition is re-deployment, not movement (§4 dec. 3). |
| GtG: unit just deployed last turn (so there was no "last turn" for it) | Counts as "did not move last turn" and "did not fire last turn." Eligible if currently in cover. |
| GtG: unit added mid-game during the previous turn (Add/Remove Units or Move) | Counts as having **moved** last turn — GtG does not apply on the following turn. See [mid-game-roster.md](mid-game-roster.md) §4 dec. 4 for the cross-doc rationale. |
| GtG: unit fired in the FireDeclare phase that just ended | That fire counts as "last turn" once the turn ends; the *following* turn it loses GtG. The current turn (where the fire is being declared) does not retroactively lose GtG. |
| GtG: unit in cover but cover only applies along certain rays (e.g. a wall) | GtG triggers on **target-in-concealing-polygon** only — walls don't count. Simpler to reason about and matches the "static fortified position" intuition. |
| GtG: unit moves *out* of cover this turn | Move resolves first → unit no longer in cover → GtG check fails this turn (and `movedLastTurn` will mark them next turn anyway). |
| GtG: snapshot point in the phase machine | `movedLastTurn` / `firedLastTurn` snapshot at `endTurn`, then are read by the next player's vision phase (which now runs at `endAddRemoveUnits`, not at startTurn). Same logical position relative to the player's first vision recompute. |
| 2.2: Ray exits and re-enters the same concave polygon | `segmentLengthInsidePolygon` already sums all interior portions; the grace check applies to the total. ≤2″ total = no cover. |
| 2.2: Ray entirely inside the polygon (both observer and target inside) | The full ray length is "inside"; if that distance >2″ the cover applies. If observer and target are <2″ apart inside the same woods, neither penalises the other. |
| Token marker (§2.4) on revealed enemy unit | Hidden — posture is player-side info that doesn't leak with the reveal. |

---

## 4. Recorded decisions

1. **Gone to Ground multiplier defaults to `2`** as a placeholder while the broader vision-value rebalance is in progress. Tunable at runtime via the Adjust Vision Rules editor; the v1 ship just needs a number that's clearly distinguishable from `1` so the mechanic is observable in play.
2. **Building gets no edge-distance grace** (§2.2). The existing Building catalog entry already only applies its stealth when the target unit is *inside* the polygon (`containsPoint(to)`), which is the same "hard to see in, easy to see out" semantic that grace gives Tall Woods / Short Terrain. Walls similarly don't fit the grace model.
3. **Dug-in is preserved across Deploy-phase reposition** (§2.1). `repositionDeployedUnit` is re-deployment, not movement — clearing dug-in would force a re-toggle every nudge during setup. `moveUnit` (Move phase) still clears it as the rule's headline behavior.
4. **GtG counts mid-game-added units as "moved last turn"** but **not units placed during Deployment** (cross-doc with [mid-game-roster.md](mid-game-roster.md) §4 dec. 4). A bailout / reinforcement is in flux; a deployed unit had time to settle.
5. **Stack display in the InfoMenu is verbose**: `×X (terrain) × ×Y (GtG) = ×Z`. First-encounter clarity over compactness; can shorten later if it crowds the panel.
6. **Token visual markers for dug-in and GtG** (§2.4). Both states are easy to lose track of mid-game; small badges on own units' tokens make them glanceable. Hidden for revealed enemy units to avoid leaking posture.

---

## 5. Out of scope

- A general stacking-modifier framework. GtG is the only stack in V1; generalize when a second stack arrives.
- Reveal-cascade changes — these rules affect *stealth* (how hard you are to see), not the reveal/detection thresholds themselves.
- A GtG opt-out toggle in the unit info menu. The state is purely derived from move/fire history; not player-toggleable.
- "Time since fired/moved" longer than one turn (e.g. GtG ramping up after N stationary turns). One-turn binary in V1.

---

## 6. Open questions

*None outstanding — all 5 doc-time questions plus the §2.4 token-marker scope are answered into §4 decisions 1–6.*

---

## 7. Implementation notes

> Sketch only.

### 7.1 Rules additions

```ts
// rules.ts
terrainEdgeGraceDistance: 2,            // §2.2
goneToGroundStealthModifier: 2,         // §2.3, §4 dec. 1 (placeholder)
```

### 7.2 Catalog wiring (§2.2)

In `terrainCatalog.ts`, change TallWoods and ShortTerrain's `appliesAsConcealment` to compare `segmentLengthInsidePolygon` against `getRules().terrainEdgeGraceDistance`. Update the `ruleDescription` getter to mention the grace.

### 7.3 State additions for GtG

`GameState` gains:
- `movedThisTurn: Set<UnitId>` — populated by `Game.moveUnit` AND by `Game.createUnit` (mid-game adds count as "moved", per §4 dec. 4). Cleared by `startTurn`.
- `movedLastTurn: ReadonlySet<UnitId>` — snapshotted from `movedThisTurn` at `endTurn`.
- `firedLastTurn: ReadonlySet<UnitId>` — snapshotted from `firedThisTurn` at `endTurn` (just before it's cleared).

Note that vision phases happen at multiple points: `endAddRemoveUnits` and `endMove` and `endTurn`. All of them must use the same `movedLastTurn` / `firedLastTurn` snapshot established at the prior `endTurn` for the GtG check to be stable across the turn.

### 7.4 Vision pipeline (§2.3)

`getConcealmentModifiersAlongRay(from, target)` still returns the per-ray modifier list and the caller takes the single highest. After picking the highest, the caller checks GtG eligibility for the **target** unit and multiplies the highest by `goneToGroundStealthModifier` when eligible. GtG eligibility is a pure function of `state.movedLastTurn`, `state.firedLastTurn`, target unit's type, and "is target inside any polygon with stealth >1" (cheap polygon-containment scan).

### 7.5 InfoMenu display

`getStealthAtPosition` extends from `{value, source}` to:

```ts
interface StealthAtPosition {
  primary: { value: number; source: string };
  goneToGround?: { value: number };
  total: number;
}
```

Renderer shows `×primary (source)` and, if GtG applies, ` × ×gtg (Gone to Ground) = ×total`.

### 7.6 Dug-in clear (§2.1)

```ts
moveUnit(unitId, newPosition) {
  this.requirePhase("Move");
  const unit = this.requireOwnUnit(unitId);
  const priorDugIn = unit instanceof Infantry ? unit.dugIn : undefined;
  this.state.moveHistory.push({ unitId, priorPosition: unit.getPosition(), priorDugIn });
  this.state.movedThisTurn.add(unitId);  // also for GtG §2.3
  unit.setPosition(newPosition);
  if (unit instanceof Infantry && unit.dugIn) unit.setDugIn(false);
}
```

`undoLastMove` and `revertUnitMoves` restore `priorDugIn` when present.

### 7.7 Token markers (§2.4)

Extend `UnitToken` with two optional badges drawn next to the milsymbol (small Konva `Group` overlays, listening disabled so they don't intercept clicks). Pass the two flags in as props from the views — already-existing call sites in `DeploymentView` / `AddRemoveUnitsView` / `MoveView` / `FireDeclareView` thread the GtG-eligibility predicate through. The marker is hidden for revealed enemy units to avoid posture-leak.

### 7.8 Tests

- `Game.test`: dug-in clears on move; undo restores; revertUnitMoves restores; movedThisTurn snapshot lifecycle includes `createUnit` adds.
- `VisionCalculator.test` (new or extended): GtG modifier stacks multiplicatively with single-highest pool; doesn't apply if moved or fired last turn; doesn't apply if not in concealing polygon; mid-game-added units don't qualify on the following turn; deployed units do qualify on turn 1.
- `terrainCatalog.test`: TallWoods + ShortTerrain edge-grace boundary cases (just below / above 2″).
- Dug-in-preserved-on-Deploy-reposition: a small Game-level test that calls `repositionDeployedUnit` on a dugIn=true Infantry and checks the flag survived.
