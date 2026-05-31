# Phase A-3: Tests Code Health Pass

**Status:** Draft
**Target Version:** v2
**Owner:** Ryan
**Last Updated:** 2026-05-30

> **Purpose.** Tight, gap-focused survey of `tests/` against the [mechanics-refactor.md](mechanics-refactor.md) decisions. Output: a coverage map of what current tests protect, the critical gaps Phase B's behavior preservation needs filled, and a recommended sequence of pre-Phase-B test commits.
>
> Last in the Phase A series. After this lands, Phase B begins. Sibling docs: [code-health-pass.md](code-health-pass.md) (engine-core), [code-health-pass-ui.md](code-health-pass-ui.md) (UI).

---

## 1. Scope & method

**Scope.** `tests/**/*.{ts,tsx}` — all 11 test files, 195 tests total.

**Method.** Tighter than the engine + UI passes (per OQ 4 in the UI doc). For each file: what does it protect, what's the Phase B impact (will Phase B rewrite the tested code? if so, the tests are behavior-preservation guardrails), what's missing. No file-by-file quality grading — the existing tests are well-shaped from inspection. Focus is gap identification.

Same four-category triage:

- **A — Pre-Phase-B test commits.** New test files that fill a critical gap *now*; small focused commits.
- **B — Phase B will address.** Tests that will need updates / additions when Phase B lands. Listed for completeness; no separate commit pre-Phase-B.
- **C — Defer.** Genuine gaps but not blocking Phase B and not high-value.
- **D — Strength.** Existing test coverage Phase B can lean on for behavior preservation.

---

## 2. Coverage map

```
tests/
  core/
    Game.test.ts                       64 tests   Game state machine + all action methods
    VisionCalculator.test.ts           26 tests   see(), discover(), runVisionPhase pipeline
    map/
      GameMap.test.ts                  26 tests   isRayBlocked, getConcealmentModifiersAlongRay
      geometry.test.ts                 21 tests   distance, segmentIntersection, point-in-polygon, segmentLength
      WorkingMap.test.ts               10 tests   plain-data round-trips + JSON parsing
      TerrainPolygon.test.ts            6 tests   construction + getEdges + containsPoint
      TerrainWall.test.ts               2 tests   construction
    units/
      Infantry.test.ts                  8 tests   stats, Recon, dug-in, toggle, position, type
      Tank.test.ts                      4 tests   stats, Recon, no inherent concealment
  ui/
    canvas/
      discoveryRings.test.ts           20 tests   ring computation + treatAsJustMoved (incl. Recon-keeps-GtG)
    components/
      nextCloneName.test.ts             8 tests   clone-name auto-bump
                                      ───────
                                       195 tests   (167 core, 28 ui)
```

**Phase B impact summary.** The vision pipeline tests (VisionCalculator + GameMap, 52 tests) are the most load-bearing — Phase B Axis 2 rewrites `discover()` into a contributor pipeline and these tests are the behavior-preservation contract. Game.test.ts (64) is the second tier — Phase B Axis 1 rewrites the state machine into a flow-node graph; these tests pin down the WWII flow's observable behavior. Both protect [success criterion 1](mechanics-refactor.md#3-goals-and-success-criteria) ("all 195+ tests still pass against the WWII configuration").

---

## 3. Category A — Pre-Phase-B test commits

Two small commits that fill genuine gaps before Phase B starts.

### T1. Tests for `useUnitPen` hook

The pen hook landed today (U2) with no dedicated tests. Behavior was preserved transitively through engine tests + manual smoke, which is OK for the refactor itself but leaves real logic uncovered: `autoName()`, `buildParams(position)`, `loadFromUnit(unit)`, `clearName()`, the "non-Infantry leave dugIn alone" branch in loadFromUnit.

**Refactor.** New `tests/ui/hooks/useUnitPen.test.ts` (~10-15 tests) using `@testing-library/react`'s `renderHook` — added as a dev dependency for this commit (§7 D2). Cover each helper + the loadFromUnit branches (Infantry source preserves dugIn; non-Infantry source keeps the pen's existing dugIn; name not touched).

**Why this matters.** Phase B will rewrite the WWII-specific unit options (Infantry/Tank dropdown, Recon checkbox) into registry-driven iteration. The hook's `buildParams` / `loadFromUnit` shape may evolve. Tests pin the current contract so Phase B's rework is behavior-preserving for the existing flow.

### T2. Tests for `rules.ts` subscription + reset mechanics

The runtime-mutable rules singleton ([rules.ts](../../../src/core/rules.ts)) has subtle behaviors that are currently tested *only transitively* through Game.test.ts fixtures: `subscribeRules` / `notify`, `setRules` shallow-merge semantics, `resetRules` restoring the deep `defaultRules` snapshot, the `structuredClone` of nested objects on reset (otherwise subsequent mutations bleed into the defaults).

**Refactor.** New `tests/core/rules.test.ts` (~8-12 tests). Cover:
- `getRules` returns a fresh reference after `setRules` (so React subscribers can compare)
- `setRules` shallow-merges (only top-level keys replace; nested objects must be passed fully)
- `subscribeRules` fires on `setRules` and `resetRules`; returned unsubscribe stops notifications
- `resetRules` restores `defaultRules` even after nested-field mutation (deep-clone integrity)
- `defaultRules` itself stays frozen (Object.freeze assertion)

**Why this matters.** Phase B will reshape the `Rules` interface ([code-health-pass.md B13](code-health-pass.md)) — `unitTypeStats: Record<UnitType, …>` becomes per-ruleset slots. The subscribe / set / reset mechanics need to survive that reshape unchanged so the UI's RulesProvider doesn't silently break. Direct tests on the contract make that reshape safer.

---

## 4. Category B — Phase B will address (informational)

### B-T1. Vision-pipeline tests assume the single-highest pooling rule

[VisionCalculator.test.ts:156-172](../../../tests/core/VisionCalculator.test.ts#L156-L172) explicitly tests `"modifiers do NOT stack — only the single highest applies"`. [VisionCalculator.test.ts:379-446](../../../tests/core/VisionCalculator.test.ts#L379-L446) tests GtG stacking *on top of* the single-highest pool.

Per [mechanics-refactor.md §11 D2](mechanics-refactor.md#11-recorded-decisions), Phase B makes the pooling rule a configurable per-ruleset composition rule (sum, product, single-highest, …). The current tests stay valid as **WWII-ruleset tests** but need to be marked / reorganized so they aren't run as engine-agnostic invariants. Phase B work; possibly a new `tests/rulesets/wwii/` subtree.

### B-T2. Tests against `terrainCatalog` assume the WWII catalog

[GameMap.test.ts](../../../tests/core/map/GameMap.test.ts) builds tests around Building / TallWoods / ShortTerrain / Short / Tall entries — all WWII-specific. After Phase B's R3 split, the catalog *interface* lives in engine-core but the entries move to `src/rulesets/wwii/engine/terrain/`. Tests follow: either marked WWII-only or split into "catalog-shape tests (engine-core)" + "WWII catalog entry tests (in the WWII ruleset's test folder)." Phase B work.

### B-T3. `discoveryRings.test.ts` exercises UI-side composition (R4 / B7)

[discoveryRings.test.ts:109-232](../../../tests/ui/canvas/discoveryRings.test.ts#L109-L232) tests that the UI's ring computation correctly applies the §4 formula + intrinsic × position × GtG composition. These tests verify the **current** B7-violating composition logic.

After Phase B's R4 fix exposes `effectiveStealth` + `detectionRange` engine read APIs ([code-health-pass-ui.md B7](code-health-pass-ui.md)), `discoveryRings.ts` shrinks to thin calls into those APIs. The tests refactor accordingly: they stop asserting `intrinsic × position × gtg` math and start asserting "the ring radius equals what the engine returned." Phase B work.

### B-T4. `effectiveStealth.ts` has no tests

The UI's [effectiveStealth.ts](../../../src/ui/canvas/effectiveStealth.ts) implements the single-highest pooling rule UI-side (B7 violation, position-based variant). No dedicated tests; covered transitively through `discoveryRings.test.ts` and InfoMenu rendering.

This file *deletes* in Phase B (replaced by the engine's read API). Adding tests now would be redundant churn — they'd survive the refactor only to be deleted with the source file. Skip until Phase B.

### B-T5. Integration / full-game-flow tests

Game.test.ts has one "end-to-end happy path" test ([Game.test.ts:610](../../../tests/core/Game.test.ts#L610)) that plays one full round. That's it for integration coverage.

Phase B's flow-node refactor will benefit from more integration tests — multi-turn flows with vision recomputes, fire reveals across turn boundaries, the AddRemoveUnits → Move transition timing of the pre-Move vision phase. These are easier to write *after* the flow-node abstraction lands (assemble a test flow from named nodes) than against the current hand-coded state machine. Phase B work.

---

## 5. Category C — Defer

- **C-T1. View-level tests.** No tests for any of the five views (DeploymentView / MoveView / FireDeclareView / AddRemoveUnitsView / TransitionView). React-Testing-Library setup would be new infra. Views are mostly thin orchestration over the engine; the high-value paths (engine calls) are already tested. Low ROI until view-specific behavior gets richer.
- **C-T2. Hook tests beyond `useUnitPen` / `useVisibleUnits`.** `useGameContext`, `useSelectionContext`, `useRulesContext`, `useDebugContext`, `useMapEditorContext`, `useDiscoveryVisualizerContext` — minimal logic, mostly context wrappers. Not worth dedicated tests.
- **C-T3. `useVisibleUnits` tests.** The hook is 6 lines (per [U1](../../../src/ui/hooks/useVisibleUnits.ts)); the underlying `visionState.teamLists` is already covered. Skip.
- **C-T4. `ruleSetStorage.ts` tests.** localStorage persistence for named rule sets. A V2 Phase C [save/load bug fix](v2-requirements.md#53-save--load-bug-fixes) is scheduled; tests would naturally land with that work, against the bug fixes. Don't anticipate.
- **C-T5. `unitStatusBadges.ts` tests.** Trivial; transitively covered.
- **C-T6. Tests for new files from A1/A3.** `VisionState.removeUnit` is exercised by Game.test.ts "deleteUnit removes the unit and purges it from vision state." `terrainPrimitives.ts` is exercised by GameMap.test.ts (8 asymmetric-grace tests + per-terrain isRayBlocked / getConcealmentModifiersAlongRay tests). Both have integration coverage; direct unit tests would be duplication.

---

## 6. Category D — Strengths

Existing test coverage Phase B can lean on for behavior preservation.

- **D-T1. Vision pipeline coverage (52 tests across VisionCalculator + GameMap).** Gold-standard for [success criterion 1](mechanics-refactor.md#3-goals-and-success-criteria). Covers see/discover, the §4 invariant boundary cases (exactly-at-range, just-beyond), single-highest pooling, GtG stacking conditional on concealment, asymmetric edge grace (8 dedicated tests pin the contract), the full runVisionPhase algorithm (cleanup, fire, cascade, mutual-reveal, carry-over).
- **D-T2. Game.test.ts is comprehensive (64 tests).** Covers every Game action method, both happy paths and refusals (enemy units, wrong phase, blank names). Phase B's flow-node rewrite has a thorough behavior contract to preserve.
- **D-T3. Recon-keeps-GtG-on-move has dedicated tests** ([Game.test.ts:550-606](../../../tests/core/Game.test.ts#L550-L606), 4 tests). The most recent rule addition; tests went in alongside the feature. Models the right shape for Phase B additions.
- **D-T4. discoveryRings tests cover treatAsJustMoved including the Recon variant.** Shows the UI ring math is testable as a pure function. After B7's R4 fix the assertions change shape but the test structure survives.
- **D-T5. Geometry primitives have edge-case coverage** ([geometry.test.ts](../../../tests/core/map/geometry.test.ts), 21 tests). T-junctions, collinear segments, endpoint touches, axis-aligned vs not. These are the substrate primitives — Phase B Axis 3 leans on them unchanged.
- **D-T6. WorkingMap round-trip tests** ([WorkingMap.test.ts](../../../tests/core/map/WorkingMap.test.ts), 10 tests). Deep-copy assertions; parse validation for malformed input. Save/load reliability foundation.

---

## 7. Recommended commit sequence (Category A)

Two small commits:

1. **T2. rules.ts subscription / reset tests.** Smaller surface (one module's API), no React-test-infrastructure question. ~8-12 tests; ~80 LOC. Lands first.
2. **T1. useUnitPen hook tests.** May need a `renderHook` from `@testing-library/react` if not already pulled in. ~10-15 tests; ~120 LOC. Lands second.

After these land, Phase A is complete (all three passes: engine-core, UI, tests). Phase B begins.

---

## 8. Recorded decisions

**D1 — Ship T1 and T2 as Phase A-3's output.** Both pre-Phase-B test commits land in the order given in §7: T2 (rules) first, T1 (useUnitPen) second. After both land, Phase A is complete (all three passes).

**D2 — Add `@testing-library/react` as a dev dependency.** Needed by T1 for `renderHook`. Avoids the harness-component workaround pattern (cleaner test shape, follows React community convention). The library will continue to pay rent as future hooks land.

**D3 — Defer B-T5 (integration tests) to Phase B.** Per the analysis: ~60% of each multi-turn integration test would rewrite when Phase B's phase verbs reshape into flow-node transitions, and the unique value (cross-turn cascade catching) is partially covered by existing within-phase cascade tests. Phase B writes integration tests against the new flow-node API where the test shape is stable. No pre-Phase-B punch list documented either — Phase B's contributor + flow-node design will surface the right integration scenarios on its own.
