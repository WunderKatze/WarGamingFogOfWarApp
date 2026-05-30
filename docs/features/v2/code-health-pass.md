# Phase A: Code Health Pass

**Status:** Draft
**Target Version:** v2
**Owner:** Ryan
**Last Updated:** 2026-05-29

> **Purpose.** Survey `src/core/` against the [mechanics-refactor.md](mechanics-refactor.md) decisions and against general OO / extensibility standards. Output is a categorized findings list + a recommended sequence of pre-Phase-B refactor commits. Each finding is sized to be fixable as one focused commit, or defers cleanly into Phase B's planned work.
>
> Reads `v2-requirements.md` §4.1 as the brief; uses `mechanics-refactor.md` §11 decisions as the lens.

---

## 1. Scope & method

**Scope.** Engine-core only: `src/core/**/*.ts`. UI (`src/ui/`) and tests are out of scope for this pass and tracked as a follow-up survey (§7 OQ 2).

**Method.** Read every file in `src/core/`. For each candidate-issue location, classify into one of four categories:

- **A — Pre-Phase-B refactor.** Small focused commit *now*; makes Phase B easier without locking in Phase B's abstractions.
- **B — Phase B will address.** Real issue, but fixing it is the Phase B work. Listed so the survey is complete; no separate commit.
- **C — Defer.** Real but not blocking Phase B and not core-health critical. Captured so it's not lost.
- **D — Strength.** Pattern that already works; flagged so Phase B preserves it rather than rewriting it.

Each finding has a short name, a file:line reference, and one sentence of "why this matters."

---

## 2. Category A — Pre-Phase-B refactor candidates

Three commits worth shipping as Phase A's concrete output. Each is small (≈ 50–150 LOC), behavior-preserving, and tightens an abstraction *without* committing to a specific Phase B design.

### A1. Encapsulate `VisionState` mutations

[Game.ts:241-266](../../../src/core/Game.ts#L241-L266) reaches into `state.visionState.individualLists`, `revealed`, `teamLists`, and `firedThisTurn` directly to clean up after `deleteUnit`. `VisionState` ([VisionState.ts](../../../src/core/VisionState.ts)) is a plain interface with no methods.

**Refactor.** Add `VisionState.removeUnit(id: UnitId): void` (and possibly `clearTurnFlags()` if it earns its keep). `Game.deleteUnit` calls the new method; the four-line internal cleanup becomes one line.

**Why this matters.** Phase B Axis 2 swaps `VisionCalculator.discover`'s internals for a contributor pipeline — and that pipeline reads from VisionState. Having VisionState own its own mutations *now* means Phase B doesn't have to retrofit encapsulation while it's also changing the discover algorithm. Independent of Phase B design.

### A2. Per-unit move snapshot/restore interface

Game.ts has three `instanceof Infantry` checks ([Game.ts:177-185](../../../src/core/Game.ts#L177-L185), [Game.ts:211-213](../../../src/core/Game.ts#L211-L213), [Game.ts:235-237](../../../src/core/Game.ts#L235-L237)) to handle Infantry's `dugIn` state across move / undo / revert. `MoveHistoryEntry.priorDugIn` ([GameState.ts:23](../../../src/core/GameState.ts#L23)) is an optional field that exists *because* one subclass has more move-time state than the base class.

**Refactor — Shape 3 (opaque `subclassData`).** Introduce `Unit.captureMoveSnapshot(): UnitMoveSnapshot` and `Unit.applyMoveSnapshot(snap)`. Snapshot shape:

```ts
interface UnitMoveSnapshot {
  position: Point;
  goneToGround: boolean;
  subclassData: unknown;
}
```

Base Unit captures position + goneToGround; subclasses override two protected hooks (`captureSubclassMoveData(): unknown`, `applySubclassMoveData(data: unknown)`) to plug in their own state. Infantry's override owns the `{ dugIn }` shape and casts on receive — one bounded cast site per subclass. `MoveHistoryEntry` becomes `{ unitId, snapshot }` — no per-subclass conditional in Game.

**Why this matters.** Phase B's contributor model will add more per-unit-type state (modifier effects, ruleset-specific flags). The `instanceof` pattern doesn't scale; this commit establishes the per-subclass snapshot shape now so Phase B inherits a clean base. Shape 3 is Phase B-compatible without anticipating its model — `subclassData: unknown` becomes `subclassData: { modifierSnapshots: ... }` later as a same-field renaming. Compatible with the eventual data-driven unit model in [mechanics-refactor.md §13.1](mechanics-refactor.md#131-file-organization-r3). Shape decision recorded in §7.

### A3. Extract terrain-vision geometry into named helpers

[terrainCatalog.ts](../../../src/core/map/terrainCatalog.ts) inlines geometry per catalog entry — `Building.blocksRay` does `segmentEdgeIntersectionCount(...) >= 2`, `TallWoods.blocksRay` does `segmentLengthInsidePolygon(...) > limit`, etc. `graceAsymmetricApplies` is the only extracted helper; the rest live as inline closures inside catalog entries.

**Refactor.** Create `terrainPrimitives.ts` (still in `src/core/map/` — staying location-neutral pending the R3 directory move). Extract: `concealsTargetInside`, `concealsAlongRayInsideSegment` (parameterized by grace distance), `concealsWhenRayCrosses`, `blocksRayOnNEdgeCrossings`, `blocksRayPastDepthXInside`, `blocksRayOnCrossing`. Each catalog entry becomes a 1-line call into a primitive with a parameter, not inline geometry.

**Why this matters.** Direct prep for [mechanics-refactor.md §6.2.1](mechanics-refactor.md#621-terrain-vision-primitives-r2). Makes R2 ("modular terrain-vision interactions") a renaming exercise during Phase B rather than a real extraction. Risk: locking the primitive names slightly early — but the names in §6.2.1 are placeholder anyway, and renaming inside one file is cheap.

---

## 3. Category B — Phase B will address (informational)

Findings that are real but where the fix is exactly the Phase B work described in [mechanics-refactor.md](mechanics-refactor.md). Tracked here so the survey is complete; no separate commit.

### Vision-rule hardcoding (Phase B Axis 2)

- **B1. `discover` hardcodes single-highest pooling + GtG stacking rule.** [VisionCalculator.ts:39-57](../../../src/core/VisionCalculator.ts#L39-L57) is the WWII composition rule baked into engine. Becomes the contributor pipeline per [§6.2](mechanics-refactor.md#62-target-shape-sketch) / D2.
- **B2. `Unit.getInherentConcealmentModifier` is a contributor in disguise.** [Unit.ts:80-87](../../../src/core/units/Unit.ts#L80-L87) — the "inherent concealment" hook is a one-source-only contributor pretending to be a Unit method. Becomes a registered contributor in Phase B.
- **B3. `Unit.getVision` / `getIntrinsicStealth` hardcode Recon's effects.** [Unit.ts:61-78](../../../src/core/units/Unit.ts#L61-L78) — adding a new modifier means editing Unit. Becomes a modifier registry.
- **B4. `goneToGround` lives on base Unit.** [Unit.ts:35](../../../src/core/units/Unit.ts#L35) — GtG is a WWII rule, not a universal unit property. Becomes ruleset-specific state.
- **B5. Recon checks scattered in Game.** Three sites ([Game.ts:159](../../../src/core/Game.ts#L159), [Game.ts:188](../../../src/core/Game.ts#L188), [Game.ts:322](../../../src/core/Game.ts#L322)) read `hasModifier("Recon")` to decide GtG behavior. Becomes per-modifier behavior registered with the contributor pipeline.

### Turn-flow hardcoding (Phase B Axis 1)

- **B6. Phase sequence encoded as method bodies.** [Game.ts:56-67](../../../src/core/Game.ts#L56-L67), [Game.ts:103-123](../../../src/core/Game.ts#L103-L123), [Game.ts:132-136](../../../src/core/Game.ts#L132-L136), [Game.ts:305-310](../../../src/core/Game.ts#L305-L310), [Game.ts:335-347](../../../src/core/Game.ts#L335-L347) — each transition is hand-coded with hardcoded next-phase assignments. Becomes a flow-node graph per [§5.2](mechanics-refactor.md#52-target-shape-sketch).
- **B7. Vision-phase triggers hardwired into specific transitions.** `runVisionPhase` is called from `endAddRemoveUnits`, `endMove`, `endTurn` directly. Becomes a flow-node trigger per D6.
- **B8. `GamePhase` as closed union.** [GameState.ts:32-44](../../../src/core/GameState.ts#L32-L44) — string-literal union ties engine-core to WWII's specific phase names. Becomes data.

### Substrate hardcoding (Phase B Axis 3, scoped per D5)

- **B9. Direct `{x, y}` reads throughout engine.** Position arithmetic happens directly on Point fields in [VisionCalculator.ts:42-56](../../../src/core/VisionCalculator.ts#L42-L56), [TerrainPolygon.ts](../../../src/core/map/TerrainPolygon.ts), [TerrainWall.ts](../../../src/core/map/TerrainWall.ts), and most of [geometry.ts](../../../src/core/map/geometry.ts). Engine reads position through substrate primitives per D5.
- **B10. Distance + ray-traversal hosted on `GameMap`.** [GameMap.ts:49-80](../../../src/core/map/GameMap.ts#L49-L80) — `isRayBlocked` and `getConcealmentModifiersAlongRay` mix substrate (ray traversal) with catalog (terrain rules). Splits in Phase B per [§7.2](mechanics-refactor.md#72-target-shape-scoped--see-11-d5).

### Engine-core vs ruleset (Phase B R3)

- **B11. No directory split.** WWII subclasses (`Infantry`, `Tank`), WWII catalog entries, and WWII config values all live in `src/core/`. The directory move per [§13.1](mechanics-refactor.md#131-file-organization-r3) is a substantial relocation done as part of Phase B step 2.
- **B12. `types.ts` enumerates WWII concepts.** [types.ts:14-22](../../../src/core/types.ts#L14-L22) — `UnitType`, `Modifier`, `WallType`, `PolygonTerrainType` are WWII-specific string-literal unions. Engine-core needs generic types; the WWII ruleset registers its specific names. Phase B work.
- **B13. `Rules` interface is typed by WWII enums.** [rules.ts:31-42](../../../src/core/rules.ts#L31-L42) — `unitTypeStats: Record<UnitType, …>` etc. tie the rules object's shape to WWII. Becomes a per-ruleset rules slot.

---

## 4. Category C — Defer (post-Phase-B or later)

Real but neither blocking Phase B nor critical core-health. Listed so they're not lost.

- **C1. `Game.createUnit` switches on `params.type === "Tank"` to pick subclass.** [Game.ts:419-422](../../../src/core/Game.ts#L419-L422) — small switch; Phase B's unit-data model will subsume this naturally.
- **C2. `GameMap` catalog dispatch iterates polygons and walls in separate loops.** [GameMap.ts:49-80](../../../src/core/map/GameMap.ts#L49-L80) — fine for current map sizes; could unify into a single "terrain features" list but no payoff in V1 or V2.
- **C3. `runVisionPhase` builds `unitsById` / `unitsByTeam` per call.** [VisionCalculator.ts:78-88](../../../src/core/VisionCalculator.ts#L78-L88) — O(n) per phase, fine at current scale. Perf, not shape.
- **C4. `requirePhase` and `requireOwnUnit` throw stringly-typed errors.** [Game.ts:383-401](../../../src/core/Game.ts#L383-L401) — no typed error hierarchy. Likely never matters until a UI surface needs to discriminate.

---

## 5. Category D — Strengths to preserve

Patterns the refactor should keep, not replace.

- **D1. Terrain catalog pattern.** [terrainCatalog.ts](../../../src/core/map/terrainCatalog.ts) is already a registry — one entry per kind, visual + rules co-located, accessed by lookup. Phase B's "primitive extraction" (A3) is additive, not a replacement.
- **D2. Runtime-mutable rules + subscription.** [rules.ts](../../../src/core/rules.ts) — `getRules()` + `subscribeRules()` + `resetRules()` is a clean separation of "tunable values" from code. Phase B's per-ruleset configuration can layer above this rather than replace it.
- **D3. `WorkingMap` vs `GameMap` separation.** [WorkingMap.ts](../../../src/core/map/WorkingMap.ts) — "editable plain-data shape" vs "live runtime object" with explicit converters. Phase B could apply the same pattern elsewhere (e.g. ruleset config) but the existing surface here stays.
- **D4. `VisionCalculator.runVisionPhase` algorithm structure.** [VisionCalculator.ts:60-110](../../../src/core/VisionCalculator.ts#L60-L110) — three named phases (cleanup, fire actions, cascade), each broken into well-named private methods. The shape is solid; Phase B swaps `discover`'s internals but leaves this orchestrator alone.
- **D5. `graceAsymmetricApplies` helper.** [terrainCatalog.ts:77-84](../../../src/core/map/terrainCatalog.ts#L77-L84) — the one already-extracted geometry helper, sitting outside the catalog entries. A3 generalizes the pattern.
- **D6. `Game` action methods validate phase + ownership at entry.** [Game.ts:383-401](../../../src/core/Game.ts#L383-L401) — `requirePhase` / `requireOwnUnit` are a clean entry-validation pattern. Phase B's flow-node action dispatch should adopt the same shape.

---

## 6. Recommended refactor commit sequence (Category A)

Ordered for safety — each commit is independently revertable and individually testable:

1. **A1. Encapsulate VisionState mutations.** Smallest surface, lowest risk. ~50 LOC, no behavior change.
2. **A3. Extract terrain-vision primitives.** Self-contained inside `terrainCatalog.ts` + new `terrainPrimitives.ts`. ~150 LOC, no behavior change. Existing terrain tests are the safety net.
3. **A2. Per-unit move snapshot/restore.** Largest of the three; touches `Unit`, `Infantry`, `MoveHistoryEntry`, and three Game methods. ~150 LOC. Movement-undo tests are the safety net.

After these three land, Phase A is complete and Phase B step 1 (lay abstractions) can begin.

---

## 7. Recorded decisions

**D1 — Ship the three Category A commits as Phase A's concrete output.** A1, A2, A3 land in the order given in §6, each as its own commit, each behavior-preserving with existing tests as the safety net.

**D2 — UI and tests surveys are scheduled as Phase A-2 and Phase A-3.** Engine-core survey (this doc) lands first. UI survey (`src/ui/`) follows once A1/A2/A3 are merged. Tests survey (`tests/`) follows the UI survey. Each produces its own short report + its own refactor commits. Phase B does not start until all three Phase A passes are complete.

**D3 — A2 uses Shape 3 (opaque `subclassData`).** Picked over the typed-per-subclass shape (conflicts with Phase B's data-driven unit model) and the `extra: Record<string, unknown>` shape (invites scattered string-key access). Reasoning:
- Phase B compatibility: `subclassData: unknown` becomes `subclassData: { modifierSnapshots: ... }` later as a same-field renaming. No structural commitment.
- Bounded cast risk: one cast per subclass, all in one `applySubclassMoveData` method per class.
- Minimal vocabulary commitment: "subclass data" is generic enough not to anticipate Phase B's modifier-as-contributor model.

The three rejected shapes are documented in conversation context for posterity.

**D4 — "Primitive" naming is locked.** `terrainPrimitives.ts` and the primitive names from [mechanics-refactor.md §6.2.1](mechanics-refactor.md#621-terrain-vision-primitives-r2) become firm anchors. The source code itself is the canonical definition of each term — long-form comments / TSDoc inside the primitives module are where the meaning lives, with `mechanics-refactor.md §14` as a pointer to the code. This pre-empts the [§11 D7](mechanics-refactor.md#11-recorded-decisions) naming pass for terrain primitives specifically; other placeholder terms (contributor, substrate, flow node) still revisit per D7.
