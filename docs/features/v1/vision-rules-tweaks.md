# Feature: Vision rules tweaks (V1 polish)

**Status:** Complete
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-17

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

**Definition.** A unit is "gone to ground" if it didn't move or fire during its owner's most recent active turn. The state is per-unit and re-evaluated every own-turn — it isn't a permanent buff. ("Turn" here means one player's half of the round; B moving units during B's turn doesn't affect any of A's units' GtG state.)

**Concealment (new terminology).** A discovery calculation is **concealed** when the per-ray single-highest stealth contributor (terrain modifiers along the ray + the target's inherent modifier like dug-in) is > 1. Concealment is therefore per-(observer, target) ray — a target can be concealed from one observer but not another.

**Stealth effect.** When a GtG unit is the target of a discovery calculation AND that calculation is concealed, the GtG modifier (`goneToGroundStealthModifier`, default `2`) stacks *multiplicatively* on top of the single-highest concealment. If the calculation is not concealed (the target's in the open and not dug-in), GtG contributes nothing — a GtG tank in open ground gets no stealth bonus, but the same tank viewed across a short wall or through short terrain does.

**Lifecycle of the per-unit flag.**

- `deployUnit` initializes `goneToGround = true` (units placed during Deployment are considered settled).
- `createUnit` (mid-game add via Move or Add/Remove Units phase) initializes `goneToGround = false` (in flux).
- `moveUnit` sets `goneToGround = false`.
- `toggleFire` sets `goneToGround = false` when fire is declared; on un-declare it restores to `true` if the unit also didn't move this turn.
- `undoLastMove` and `revertUnitMoves` restore the flag from a `priorGoneToGround` snapshot taken in the move-history entry.
- `startTurn` for the active player resets all that player's units' flags back to `true` (every own-turn opens with a fresh chance — if they remain static through the turn, they end it GtG).

Default multiplier: **`2`** (placeholder; vision-value rebalance pending — see §4 dec. 1). Displayed in the InfoMenu's stealth line as `×X (terrain) × ×Y (GtG) = ×Z` when GtG actually applies (§4 dec. 5), plus an always-on "Gone to Ground — ×N stealth if concealed by terrain" hint row whenever the selected/hovered unit is gone to ground (so the per-ray rule is visible even when concealment doesn't currently apply at the unit's standing position). A token marker also draws — see §2.4.

### 2.4 Token visual markers for dug-in and Gone to Ground

- Both modifiers are state-derived and easy to lose track of; on a busy table, players want to see at a glance which units are dug in and which are gone to ground.
- Each token gains up to two small badges next to the position dot:
  - **Dug-in** ("D") marker for any Infantry whose `dugIn === true`.
  - **GtG** ("G") marker for any unit whose `goneToGround === true`.
- Markers are visible on **every unit MapCanvas renders** — own units AND revealed enemies. Hidden enemies (not visible to the active player) don't render their tokens at all, so they trivially don't show markers. Revealed enemies' posture is shown so the opponent has full information when an enemy reveals.
- The InfoMenu also displays both state lines: the existing dug-in toggle row, plus a green italic "Gone to Ground · ×N stealth if concealed by terrain" hint whenever a GtG unit is selected/hovered (the per-ray "if concealed" qualifier needs to stay visible because the stealth line only shows the stacked product when concealment actually applies at the unit's standing position).

---

## 3. Edge cases

| Scenario | Behavior |
|---|---|
| Unit dug-in, moved, then position-undone via `undoLastMove` | `dugIn` restored alongside position (§2.1). `goneToGround` is also restored from the same move-history entry. |
| Unit dug-in, moved 0.1″ (precision touch) | Counts as a move; `dugIn` and `goneToGround` both clear. We don't gate on minimum distance — the player either moved or didn't. |
| Unit dug-in, repositioned during Deploy via `repositionDeployedUnit` | `dugIn` is preserved — Deploy reposition is re-deployment, not movement (§4 dec. 3). |
| GtG: unit deployed during Deployment | `deployUnit` initializes `goneToGround = true`, so they're GtG on the first Move turn if they remain static through it (a static turn ends with the flag still true). |
| GtG: unit added mid-game during the previous turn (Add/Remove Units or Move) | `createUnit` initializes `goneToGround = false`. Flag stays false through the rest of that turn and the opponent's turn. On the unit's owner's NEXT startTurn the flag resets to true; if the unit stays static through that turn, it ends GtG. |
| GtG: unit fired in the FireDeclare phase | `toggleFire` flips the flag to false immediately on declare. Un-declare restores to true only if the unit also didn't move this turn. |
| GtG: unit moves *out* of cover this turn | Move flips `goneToGround = false` AND the unit is no longer in cover — both fail-safes against GtG applying. |
| GtG: unit in cover but cover only applies along certain rays (e.g. a wall) | The per-ray concealment check handles this naturally — GtG stacks for rays that ARE concealed (by the wall), doesn't stack for rays that aren't. |
| GtG: vision phase reads the flag at three points (`endAddRemoveUnits`, `endMove`, `endTurn`) | Each vision phase sees whatever value the flag has at the moment — the live updates from `moveUnit` / `toggleFire` mean the flag is always current. |
| 2.2: Ray exits and re-enters the same concave polygon | `segmentLengthInsidePolygon` already sums all interior portions; the grace check applies to the total. ≤2″ total = no cover. |
| 2.2: Ray entirely inside the polygon (both observer and target inside) | The full ray length is "inside"; if that distance >2″ the cover applies. If observer and target are <2″ apart inside the same woods, neither penalises the other. |
| Token marker on revealed enemy unit | Visible — posture is information the opponent has earned by getting the reveal (§4 dec. 6). |

---

## 4. Recorded decisions

1. **Gone to Ground multiplier defaults to `2`** as a placeholder while the broader vision-value rebalance is in progress. Tunable at runtime via the Adjust Vision Rules editor; the v1 ship just needs a number clearly distinguishable from `1` so the mechanic is observable in play.
2. **Building gets no edge-distance grace** (§2.2). The existing Building catalog entry already only applies its stealth when the target unit is *inside* the polygon (`containsPoint(to)`), which is the same "hard to see in, easy to see out" semantic that grace gives Tall Woods / Short Terrain. Walls similarly don't fit the grace model.
3. **Dug-in is preserved across Deploy-phase reposition** (§2.1). `repositionDeployedUnit` is re-deployment, not movement — clearing dug-in would force a re-toggle every nudge during setup. `moveUnit` (Move phase) still clears it as the rule's headline behavior.
4. **GtG is a per-unit flag, not a derived predicate.** Each unit owns a `goneToGround: boolean` mutated live by Game actions (`deployUnit`, `createUnit`, `moveUnit`, `toggleFire`, `startTurn` reset, undo paths). The vision pipeline only consults that single flag — no per-team "moved last turn" snapshot maps. Re-evaluation happens at the unit's owner's next `startTurn`, which resets all of that player's units to `true`, then any action during the turn flips them back to `false`.
5. **Stack display in the InfoMenu is verbose**: `×X (terrain) × ×Y (GtG) = ×Z`. Shown only when concealment actually applies at the unit's standing position. A separate always-on green hint row says "Gone to Ground · ×N stealth if concealed by terrain" so the per-ray rule is visible even when the standing-position concealment doesn't fire.
6. **Token visual markers are shown on every rendered unit** (own and revealed enemies). Hidden enemies don't render tokens at all, so they trivially don't leak posture. Revealed enemies' posture IS exposed — the opponent earned that information by getting the reveal, and seeing whether a revealed unit is dug-in or GtG is part of the strategic information they should have.
7. **GtG only stacks during a *concealed* discovery.** The per-ray check is `max(inherentMod, ...terrainMods) > 1` — i.e. the same single-highest pool the regular stealth calc uses, but as a binary "is there any concealment for this ray?" gate on the GtG multiplier. Dug-in counts because it's part of the inherent modifier. A GtG tank in the open with no inherent and no terrain mods gets no GtG; the same tank viewed across a short wall or through woods does.

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

### 7.3 GtG state

Per §4 dec. 4 the GtG state lives directly on `Unit` as a mutable `goneToGround: boolean` field. The Game class owns the lifecycle:

- `deployUnit` → `unit.goneToGround = true`
- `createUnit` → `unit.goneToGround = false`
- `moveUnit` → snapshot prior value into the move-history entry's `priorGoneToGround`, then set `unit.goneToGround = false`
- `toggleFire` on declare → `unit.goneToGround = false`; on un-declare → restore to `!state.movedThisTurn.has(unitId)`
- `startTurn` for active player → for every own unit, `unit.goneToGround = true` (fresh chance)
- `undoLastMove` and `revertUnitMoves` → restore `priorGoneToGround` from the snapshot

`GameState.movedThisTurn` (Set\<UnitId\>) is retained for the `toggleFire` un-declare restoration; no per-team "last turn" snapshot maps are needed.

### 7.4 Vision pipeline (§2.3)

`VisionCalculator.discover` reads `target.goneToGround` directly:

```ts
const highestMod = Math.max(1, inherentMod, ...terrainMods);
if (target.goneToGround && highestMod > 1) {
  highestMod *= getRules().goneToGroundStealthModifier;
}
```

The `highestMod > 1` gate is the per-ray concealment check (§4 dec. 7). `runVisionPhase` takes no additional GtG-related parameters — everything it needs is on the units themselves.

### 7.5 InfoMenu display

`getStealthAtPosition` returns the standing-position single-highest as before. The view combines that with `game.isGoneToGround(unit)`:

```ts
const isConcealedHere = stealth.value > 1;
const isGtg = game.isGoneToGround(unit);
const gtgApplies = isGtg && isConcealedHere;
```

Renderer:
- Stealth row: `×stealth.value (stealth.source)` always; `× ×gtgMult (Gone to Ground) = ×total` appended when `gtgApplies`.
- A separate "Gone to Ground · ×N stealth if concealed by terrain" hint row when `isGtg`, regardless of standing-position concealment.

### 7.6 Dug-in clear (§2.1)

```ts
moveUnit(unitId, newPosition) {
  this.requirePhase("Move");
  const unit = this.requireOwnUnit(unitId);
  const priorDugIn = unit instanceof Infantry ? unit.dugIn : undefined;
  this.state.moveHistory.push({
    unitId,
    priorPosition: unit.getPosition(),
    priorGoneToGround: unit.goneToGround,
    ...(priorDugIn !== undefined && { priorDugIn }),
  });
  unit.setPosition(newPosition);
  if (unit instanceof Infantry && unit.dugIn) unit.setDugIn(false);
  unit.goneToGround = false;
  this.state.movedThisTurn.add(unitId);
}
```

`undoLastMove` and `revertUnitMoves` restore both `priorDugIn` (when present) and `priorGoneToGround`.

### 7.7 Token markers (§2.4)

`UnitToken` accepts optional `dugIn?: boolean` and `goneToGround?: boolean` props and draws small "D" / "G" badges next to the position dot when set (Konva `Group` overlays, `listening={false}` so they pass clicks through). MapCanvas accepts `dugInUnitIds` and `goneToGroundUnitIds` as `ReadonlySet<UnitId>` props and forwards the membership test to each `UnitToken`. A `computeUnitStatusBadges(game)` helper in `src/ui/canvas/` builds both sets from `game.state.units` (no team filter — own and revealed enemies render badges; hidden enemies aren't passed to MapCanvas at all so they don't render incidentally).

### 7.8 Tests

- `Game.test`: dug-in clears on move; undo restores both dug-in and GtG; revertUnitMoves restores both; Tank move-history entries don't carry priorDugIn but DO carry priorGoneToGround; repositionDeployedUnit preserves both.
- `VisionCalculator.test`: GtG stacks on top of the single-highest concealment when the target is GtG AND concealed; doesn't stack when target is in the open; dug-in inherent concealment counts as concealment (so a dug-in GtG infantry on open ground does get the stack).
- `terrainCatalog.test`: TallWoods + ShortTerrain edge-grace boundary cases (just below / above 2″).
