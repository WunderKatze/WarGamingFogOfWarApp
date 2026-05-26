# Feature: Vision values + Recon mechanic tweaks (V1 polish, pass 2)

**Status:** Complete
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-22

> **Scope note.** Mini-update on top of [vision-rules-tweaks.md](vision-rules-tweaks.md), bundling four small changes: vision distances bumped, Recon's stealth half removed and replaced with a Gone-to-Ground interaction, the Tall Woods sight-through limit cut, and a hygiene pass on the tests so future config tweaks don't churn them.

---

## 1. Motivation

After the GtG / edge-grace pass shipped, playtest exposed a few values that needed to move:

- Vision distances were too short relative to typical engagement ranges. Units that should have eyes-on each other were missing each other across reasonable distances.
- Recon's `×4/3` stealth bonus felt redundant — Recon is already a "see better, move better" identity, and stacking a stealth bonus on top muddled what the trait represents. Better to give Recon a *behavioral* niche tied to the new GtG mechanic.
- Tall Woods at a 4″ sight-through limit let too many rays cleanly pierce small wood patches. Tightening to 2″ makes even a thin treeline a real barrier.

A side observation: most existing Game / VisionCalculator tests hardcode the numeric values they expect. Every config tweak above churns tests for no real reason. Worth a single refactor pass.

---

## 2. Rule changes

### 2.1 Vision distances

In [config.ts](src/core/config.ts):

| Unit type | Old `baseVision` | New `baseVision` |
|---|---|---|
| Infantry | 48 | **72** |
| Tank | 48 | **64** |

Both still routed through the runtime-mutable Rules layer; the in-game Adjust Vision Rules editor's `Unit type stats` section already lets the player tune further.

### 2.2 Recon mechanic

Two coupled changes:

- **Drop the stealth half of Recon.** [config.ts](src/core/config.ts) `modifierEffects.Recon.stealthMultiplier` goes from `4/3` to `1`. Recon's `visionMultiplier` stays at `4/3`.
- **Recon keeps Gone to Ground when moving.** The standard GtG rule is "moving or firing clears the flag" — Recon units now lose the flag on *fire only*. Movement is part of their identity (they're scouts; they move to look).
  - `Game.moveUnit` for a Recon unit: still snapshots `priorGoneToGround` into the move-history entry, but does NOT set `goneToGround = false`. Restoration on undo is a no-op (the flag was already true), but the snapshot stays for symmetry.
  - `Game.toggleFire` on declare: unchanged — sets `goneToGround = false` for Recon and non-Recon alike.
  - `Game.createUnit` for a Recon unit: `goneToGround = true` (Recon units arrive scouting, not in flux — same justification as "movement doesn't break GtG"). Non-Recon mid-game additions still start `false`.
  - `Game.startTurn` reset for active player: unchanged — sets every own unit to `true`, Recon or not.

### 2.3 Tall Woods sight-through limit

In [config.ts](src/core/config.ts):

| Setting | Old | New |
|---|---|---|
| `tallWoodsRayThroughLimit` | 4″ | **2″** |

This is the threshold where a ray passing inside a Tall Woods polygon for *more than* this distance gets blocked. It's separate from the §2.2 edge grace from the earlier vision-rules-tweaks pass (the edge grace is about stealth contribution; this is about hard LOS blockage). Surfaced in the Adjust Vision Rules editor under `Terrain blocking`.

### 2.4 Test refactor

Existing Game / VisionCalculator / GameMap tests routinely hardcode the result they expect against a specific config value (e.g. "vision range 48 / 2 = 24"). Every value tweak churns those tests for no real reason — the *behavior* is correct, the magic number just shifted.

Refactor pass: any test assertion that depends on a config value should be written as an arithmetic expression *over the imported config constant*. The existing pattern in `GameMap.test.ts` (which imports `polygonStealthModifier` and uses it in expectations) is the model.

Concrete examples of the pattern:

```ts
// Before:
expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(50, 50)))
  .toEqual([3]);

// After:
expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(50, 50)))
  .toEqual([polygonStealthModifier.Building]);
```

```ts
// Before — discovery boundary computed against a literal:
const observer = tankAt("A", p(0, 0));
const target = tankAt("B", p(20, 0));  // 20" < 48" baseline range

// After:
const observer = tankAt("A", p(0, 0));
// Half a tank's vision range — must be discoverable.
const target = tankAt("B", p(unitTypeStats.Tank.baseVision / 2, 0));
```

No new tests are added for the test refactor; this is hygiene. Existing assertions just become tweak-resilient.

---

## 3. Edge cases

| Scenario | Behavior |
|---|---|
| Recon unit moves, undoes the move | `priorGoneToGround` snapshot was `true` (or whatever it was); restore is a no-op for the Recon path since `moveUnit` didn't change the flag. Position is restored as usual. |
| Recon unit moves, then fires | Move keeps `goneToGround = true`. Fire declare sets it `false`. Behaviour parallel to "non-Recon unit that didn't move but did fire" — the *fire* is what breaks GtG. |
| Recon unit fires, then un-declares fire | `toggleFire` restoration sets `goneToGround = !movedThisTurn.has(id)`. For a Recon unit that didn't move, `movedThisTurn` is empty for it → restores to `true`. For a Recon unit that *did* move — wait, this can't disqualify it because movement doesn't add Recon to `movedThisTurn`... |

**Sub-decision needed**: should `moveUnit` still add a Recon unit's id to `state.movedThisTurn`? The set is used by `toggleFire` to decide whether to restore GtG. If Recon moves are NOT in `movedThisTurn`, then un-declaring fire on a Recon unit that moved restores GtG — which is *consistent with the Recon rule* (movement doesn't break Recon GtG, so it shouldn't disqualify on fire un-declare either).

So: `moveUnit` should still add to `movedThisTurn` for non-Recon (so toggleFire un-declare works as today), AND for Recon (because the `movedThisTurn` set still reflects "did the unit move this turn" as a factual record, separate from GtG semantics). The Recon-specific GtG behavior is handled by `toggleFire` ignoring `movedThisTurn` for Recon units when re-evaluating. Or, equivalently, only checking `movedThisTurn` for non-Recon.

Recorded as **§4 dec. 4**.

| Scenario | Behavior |
|---|---|
| Tall Woods 3″-wide strip, ray fully crosses (3″ inside) | With the new 2″ limit, this ray is **blocked**. With the old 4″ limit, this same ray passed. Existing `GameMap.test` includes a "narrow strip 3″ wide, doesn't block" case — that test needs updating (and the test refactor in §2.4 makes that an expression-over-config change). |
| Recon stealth removed: existing dug-in Recon Infantry | Effective stealth becomes `1 × max(inherent=dugIn, terrain)` — no more Recon multiplier. They're still hard to see in cover, just not stacked with a Recon×. |
| Vision distance up: existing balanced engagements | Players will see further. Saved games (post the upcoming save/load) loaded with old default ranges and new defaults will play differently. Expected; this *is* the rebalance. |

---

## 4. Recorded decisions

1. **Vision distances bumped to 72 (Infantry) / 64 (Tank).** Playtest-tuned numbers; tunable via the Adjust Vision Rules editor afterward.
2. **Recon loses its stealth half.** The trait identity becomes "vision range + behavioral GtG persistence," not "harder to spot." Stealth bonus felt overloaded and made Recon dominant on both axes.
3. **Recon keeps GtG when moving.** Movement is part of the scout identity; only firing reveals the position enough to break the static-position bonus. Mid-game `createUnit` for a Recon unit also starts `goneToGround = true` (same justification: arriving doesn't break a scout's hide).
4. **`Game.moveUnit` still adds Recon unit ids to `state.movedThisTurn`,** keeping that set a factual record of "moved this turn." The Recon-specific GtG behaviour is implemented as a Recon check in `moveUnit` (skip the GtG clear) and as a Recon check in `toggleFire` un-declare (ignore `movedThisTurn` membership for Recon units). Two narrow checks rather than a forked tracking set.
5. **Tall Woods sight-through limit drops to 2″.** Even thin treelines now block longer rays through them.
6. **Test refactor scales assertions to imported config constants** rather than literal numbers. Hygiene pass — no behaviour change.

---

## 5. Out of scope

- Saved-game migration. There's no save/load yet, so no migration concern.
- A "Recon types" expansion (Light Recon, Scout Recon, etc.). Single Recon trait remains.
- Tuning Building / Short Terrain stealth values or other polygon multipliers in this pass.
- A general "vision rules profile" preset system in the Rules editor — out of scope; the existing Save / Load named rule sets cover this.

---

## 6. Open questions

*None outstanding — all 6 questions answered into §4 decisions 1–6.*

---

## 7. Implementation notes

### 7.1 Code-side changes

- [config.ts](src/core/config.ts): update `unitTypeStats.Infantry.baseVision = 72`, `unitTypeStats.Tank.baseVision = 64`, `modifierEffects.Recon.stealthMultiplier = 1`, `tallWoodsRayThroughLimit = 2`.
- [Game.ts](src/core/Game.ts) `moveUnit`: gate the `unit.goneToGround = false` write on `!unit.hasModifier("Recon")`. Move-history snapshot still records the prior value unconditionally.
- [Game.ts](src/core/Game.ts) `toggleFire` un-declare branch: when restoring GtG, treat Recon units as if they hadn't moved this turn — i.e. ignore `state.movedThisTurn` membership for them. `unit.goneToGround = unit.hasModifier("Recon") ? true : !this.state.movedThisTurn.has(unitId);`
- [Game.ts](src/core/Game.ts) `createUnit`: thread `defaultGoneToGround = params.modifiers?.includes("Recon")` (or equivalent) into `buildUnit`. The existing helper already takes the default as a parameter.

### 7.2 Test refactor

Grep for hardcoded values that match `config.ts` constants and replace with the imported constant (or arithmetic over it). Likely files:
- `tests/core/Game.test.ts`
- `tests/core/VisionCalculator.test.ts`
- `tests/core/map/GameMap.test.ts`

Specific update needed regardless of refactor: the `GameMap.test.ts` "tall woods narrow strip" case currently asserts a 3″ strip does NOT block; the new 2″ limit makes 3″ block. Either widen the strip in that test, or split it into a "below limit" and "above limit" pair using `tallWoodsRayThroughLimit` from config.

### 7.3 Tests

- New `Game.test` cases for the Recon-keeps-GtG-on-move behaviour: a Recon Tank that moves still has `goneToGround = true`; a non-Recon Tank still goes `false`; `createUnit` for a Recon Infantry starts `true`; `toggleFire` un-declare on a Recon that moved restores `true`.
- No new VisionCalculator tests required (the change is in Game; the discover path is unchanged).
