# Feature: Vision rules tweaks (V1 polish)

**Status:** Draft
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

- When `Game.moveUnit` runs on an Infantry with `dugIn = true`, set `dugIn = false` as part of the move.
- The toggle in the *Selected* panel remains available — the player can dig in again that same Move phase if they didn't actually move far. Re-toggling is an explicit re-action; doesn't auto-restore.
- Move-history undo (`undoLastMove`, `revertUnitMoves`) restores prior position and **also** restores prior `dugIn` flag so undoing a move doesn't strand the unit with the wrong state. Implementation: snapshot `dugIn` alongside `priorPosition` in each move-history entry.

### 2.2 Tall Woods / Short Terrain edge grace

- For **Tall Woods** and **Short Terrain** only (not Building, not walls), the stealth-multiplier check requires the ray's segment-length-inside-the-polygon to **exceed** a configurable grace distance (default **2″**) rather than be strictly greater than zero.
- New rule value `terrainEdgeGraceDistance: 2` in `rules.ts`, surfaced in the Adjust Vision Rules editor like the existing rules.
- Catalog change: `appliesAsConcealment(from, to)` becomes `segmentLengthInsidePolygon(from, to, poly.vertices) > getRules().terrainEdgeGraceDistance`.
- InfoMenu rule descriptions for these two terrains gain a phrase like *"; first 2″ inside the edge doesn't count."*

**Implication**: a unit ≤2″ from the inner edge of a treeline can see *out* of the woods at full vision (no woods penalty applies to the outgoing ray). A target ≥2″ deep inside the woods still benefits from the woods penalty when observed from outside. Asymmetric by design — rewards hugging the woodline.

### 2.3 Gone to Ground

- A new stealth modifier applied to **Infantry and Tank** units (every unit type in V1) when **all three** are true:
  1. The unit is currently sitting inside at least one polygon whose stealth multiplier is `>1` (i.e. cover-providing terrain — Building, Tall Woods, Short Terrain, or any future polygon kind).
  2. The unit did **not** move in the previous turn (or has never moved — a just-deployed unit qualifies).
  3. The unit did **not** fire in the previous turn (or has never fired).
- Effect: a **multiplicative stack** with the unit's other stealth contributors. This is the first stacking modifier — every other stealth source is currently subject to "single highest." GtG multiplies on top of whichever single-highest source already applies.
- Default multiplier value: **TBD — see §6 OQ 1**. Strawman: `4/3` (matches Recon's order of magnitude).
- Display: InfoMenu shows the combined stealth as `×X (terrain) × ×Y (GtG) = ×Z`, so the player sees the stack.

---

## 3. Edge cases

| Scenario | Behavior |
|---|---|
| Unit dug-in, moved, then position-undone via `undoLastMove` | `dugIn` restored alongside position (§2.1). |
| Unit dug-in, moved 0.1″ (precision touch) | Counts as a move; `dugIn` clears. We don't gate on minimum distance — the player either moved or didn't. |
| GtG: unit just deployed last turn (so there was no "last turn" for it) | Counts as "did not move last turn" and "did not fire last turn." Eligible if currently in cover. |
| GtG: unit fired in the FireDeclare phase that just ended | That fire counts as "last turn" once the turn ends; the *following* turn it loses GtG. The current turn (where the fire is being declared) does not retroactively lose GtG. |
| GtG: unit in cover but cover only applies along certain rays (e.g. a wall) | GtG triggers on **target-in-concealing-polygon** only — walls don't count. Simpler to reason about and matches the "static fortified position" intuition. |
| GtG: unit moves *out* of cover this turn | Move resolves first → unit no longer in cover → GtG check fails this turn (and `movedLastTurn` will mark them next turn anyway). |
| 2.2: Ray exits and re-enters the same concave polygon | `segmentLengthInsidePolygon` already sums all interior portions; the grace check applies to the total. ≤2″ total = no cover. |
| 2.2: Ray entirely inside the polygon (both observer and target inside) | The full ray length is "inside"; if that distance >2″ the cover applies. If observer and target are <2″ apart inside the same woods, neither penalises the other. |

---

## 4. Recorded decisions

> Filled in once §6 OQs are answered.

---

## 5. Out of scope

- A general stacking-modifier framework. GtG is the only stack in V1; generalize when a second stack arrives.
- Reveal-cascade changes — these rules affect *stealth* (how hard you are to see), not the reveal/detection thresholds themselves.
- A GtG opt-out toggle in the unit info menu. The state is purely derived from move/fire history; not player-toggleable.
- "Time since fired/moved" longer than one turn (e.g. GtG ramping up after N stationary turns). One-turn binary in V1.

---

## 6. Open questions

1. **Gone to Ground multiplier value** — strawman `4/3` (matches Recon). Could be `2` for more bite. Tunable later via the rules editor; what should the *baked-in default* be?
2. **2.2 — does Building also need a grace?** Building stealth already only applies when target is **inside** the polygon (per existing rule), so the grace concept doesn't really fit. Confirm: grace applies only to Tall Woods + Short Terrain.
3. **2.1 — dug-in on reposition during Deploy** (assuming the [Deployment stop-gap](deployment-stop-gap.md) lands first): should the new `repositionDeployedUnit` also clear `dugIn`? Argument for: consistency with movement. Argument against: in Deploy you're still positioning, you'd just have to re-toggle. Recommendation: **yes**, clear on reposition.
4. **2.3 GtG visual cue** — should a GtG-eligible unit show a small badge on its token (e.g. a tiny "G")? Cleaner than only-in-info-menu but adds canvas clutter. Defer to a stretch goal?
5. **2.3 stacking display** — `×X × ×Y = ×Z` or `×Z (terrain × GtG)` or just `×Z`? Verbose-but-explanatory wins on first-encounter UX; can compact later.

---

## 7. Implementation notes

> Sketch only.

### 7.1 Rules additions

```ts
// rules.ts
terrainEdgeGraceDistance: 2,        // §2.2
goneToGroundStealthModifier: 4/3,   // §2.3, see OQ 1
```

### 7.2 Catalog wiring (§2.2)

In `terrainCatalog.ts`, change TallWoods and ShortTerrain's `appliesAsConcealment` to compare `segmentLengthInsidePolygon` against `getRules().terrainEdgeGraceDistance`. Update the `ruleDescription` getter to mention the grace.

### 7.3 State additions for GtG

`GameState` gains:
- `movedThisTurn: Set<UnitId>` — populated by `Game.moveUnit`, cleared by `startTurn`.
- `movedLastTurn: ReadonlySet<UnitId>` — snapshotted from `movedThisTurn` at `endTurn`.
- `firedLastTurn: ReadonlySet<UnitId>` — snapshotted from `firedThisTurn` at `endTurn` (just before it's cleared).

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

### 7.7 Tests

- `Game.test`: dug-in clears on move; undo restores; revertUnitMoves restores; movedThisTurn snapshot lifecycle.
- `VisionCalculator.test` (new or extended): GtG modifier stacks; doesn't apply if moved or fired last turn; doesn't apply if not in concealing terrain.
- `terrainCatalog.test`: TallWoods + ShortTerrain edge-grace boundary cases (just below / above 2″).
