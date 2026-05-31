# Feature: Mechanics Refactor (rule-system abstraction)

**Status:** Draft
**Target Version:** v2
**Owner:** Ryan
**Last Updated:** 2026-05-29

> **Scope note.** Architectural refactor that introduces the layers of abstraction needed for the codebase to support more than one wargame rule system. V1 was tightly coupled to a specific 1/100-scale WWII ruleset; V2 separates the "what's specific to this game" from the "what's structural to any wargame this codebase represents." Owns its own doc because it's the V2 Phase B work block and the largest single architectural change of V2. See the parent plan in [v2-requirements.md §3 / §4.2](v2-requirements.md).
>
> **Why this doc first.** This is the V2 Phase B work, but the *scoping doc* gets drafted before Phase A (the code-health survey) so the survey has a clear target to evaluate against. Knowing what abstractions we want lets the health pass spot the V1 shapes that fight them.

---

## 1. Motivation

V1 was built to be one game: a 1/100-scale WWII fog-of-war wargame. That focus paid off — the game is shippable as a tabletop companion — but the design choices specific to *that* ruleset are baked into the core:

- **Unit catalog** is enumerated: `UnitType = "Infantry" | "Tank"`, with stats hard-coded in [src/core/config.ts](../../../src/core/config.ts) and subclasses (`Infantry`, `Tank`) hand-written.
- **Modifiers** are enumerated to one value: `Modifier = "Recon"`.
- **Map terrain** is a closed enum: three polygon kinds (`Building`, `TallWoods`, `ShortTerrain`) and two wall kinds (`Short`, `Tall`). The catalog pattern in [terrainCatalog.ts](../../../src/core/map/terrainCatalog.ts) makes adding kinds cheap but doesn't yet let an alternate ruleset *replace* the set.
- **Vision rules** are this ruleset's choices baked into `VisionCalculator`: single-highest-modifier pooling, GtG ×2 stacking when concealed, edge grace, dug-in being inherent-on-Infantry-only, etc.
- **Turn flow** is a fixed sequence in [Game.ts](../../../src/core/Game.ts): `Deploy → Transition → AddRemoveUnits → Move → FireDeclare → Transition`. Each player takes a full turn before swapping.
- **Map geometry** is free-position inches; no hex / grid alternative.

A second ruleset (say: a different tabletop wargame the same engine could power) couldn't load as data — it would need a fork. The V2 refactor changes that. Going forward, the WWII ruleset is *one configuration of the engine* and other rulesets are other configurations.

The long-term vision is broader than "support a second ruleset." This app should be able to provide vision / fog-of-war capability for a variety of tabletop wargames — each with its own units, map model, and terrain concepts — without each new adaptation requiring a backtrack through engine-core code. Some V2/V3 features will reuse cleanly across rulesets; some will be WWII-specific. The refactor's job is to make that split clean and obvious so neither side obstructs the other, and so the WWII ruleset can keep evolving without dragging other rulesets through churn (and vice versa).

---

## 2. Use cases & requirements

This refactor is *for the developer maintaining or adapting this codebase*. The user stories below capture the moments where V1's lack of abstraction would bite — they're what the §3 success criteria measure against.

### 2.1 Developer use cases

- **Different turn orders.** As a developer I want to adapt this app to wargames with different turn structures — e.g. "P1 move, P2 move, P1 shoot, P2 shoot," or activation-based games where a player only activates a handful of units before turn order swaps. Maps to §5 (Axis 1).

- **Different terrain rule sets.** As a developer I want to introduce different rule sets for how terrain affects vision. Two distinct cases: (a) tweaking the WWII ruleset's terrain behavior by configuration alone, and (b) supporting other wargames that recognize the same terrain types but combine them differently (or use entirely different rules). Maps to §6 (Axis 2).

- **Modular modifiers and mechanics.** As a developer I want to keep adding modifiers and mechanics like dug-in, GtG, Recon (and future ones) without coupling them to core unit classes or to the vision pipeline. Ruleset-specific subclasses of unit / modifier are fine; engine-core code growing to accommodate each new modifier is not. Maps to §6 (Axis 2).

> **A note on over-abstraction.** The deepest level of abstraction we're targeting is: a single vision formula (§4) sitting above per-substrate primitives for position, distance, and ray-traversal. Everything *else* — terrain catalogs, contributor pipelines, modifier behaviors — is allowed to duplicate across rulesets if a shared abstraction doesn't fit cleanly. Duplication is preferable to the wrong shared abstraction. This caveat applies most sharply to Axis 3 (see §7 and §11 D5).

### 2.2 Explicit requirements

- **R1 — Hex and grid support.** Vision and movement rules must adapt to hex and square-grid systems, not only the current free-position-inches model. Mapped to §7 (Axis 3).

- **R2 — Modular terrain-vision interactions.** Vision-terrain interactions — edge-grace distance, "block LOS after X inches inside the polygon," "block LOS when a ray crosses ≥2 edges of a polygon," etc. — must be reusable pieces that any terrain catalog entry can attach to. The current catalog pattern is most of the way there; the per-kind interaction code (today inlined in each catalog entry) becomes a small set of **named primitives** that catalog entries reference by name + parameters. Adding a new terrain kind in any ruleset is then assembly, not recoding. Mapped to §6 (Axis 2).

- **R3 — Ruleset-specific code is clearly delineated (engine *and* UI).** Code that hardcodes WWII-specific choices — whether engine rules (turn order, terrain interactions, modifier behavior) *or* UI surfaces (rule-editor fields specific to WWII concepts, unit-type dropdowns, modifier-specific controls) — must live in files clearly identified as ruleset code. Both **engine-core** (`src/core/`) and **UI-core** (`src/ui/`) must contain no WWII-specific assumptions. This is the architectural principle that makes the whole refactor *visible and verifiable*: a future contributor can browse engine-core, UI-core, and the WWII folder and see exactly where each line lives, without grepping. See §13.1 for the proposed shape and §12 OQ 8 for how to enforce it.

- **R4 — Rule outcomes are computed in engine-core only.** The UI never re-derives a rule outcome — vision math, modifier composition, detection results, valid-move checks, anything the engine would also need to know to be correct. The UI captures user intent (form inputs), renders engine-computed results (badges, panel rows, ring radii), and may reflect rule *structure* for UX purposes (e.g. disabling a "Dug-in" checkbox for non-Infantry units because dug-in is Infantry-only). But it never replicates a rule's *logic* — even partially, even "just for display."
  
  The engine must therefore expose a public read API for the intermediate values the UI needs (e.g. `effectiveStealth(unit, position) → { value, breakdown }`, `detectionRange(observer, target) → inches`), not just final outcomes. The exception to R4 is pure display formatting (number rounding, label text, color choice, layout).
  
  Recorded in [code-health-pass-ui.md §1.1](code-health-pass-ui.md#11-architectural-principle-rules-logic-lives-in-engine-core), which walks through Dug-in as a worked example of the four legitimate UI ↔ engine interaction patterns and the one that's the actual violation. The B7 finding in that doc is the current hard violation Phase B must close.

---

## 3. Goals and success criteria

**Goal.** Decouple "what this specific game is" from "what shape any wargame this engine represents takes." After the refactor, the WWII ruleset is described by data + a small amount of glue — not by which subclasses exist or which enum members are defined.

**Success criteria.**

1. The current WWII ruleset still plays end-to-end with no observable behavior change. All 195+ tests still pass against the WWII configuration.
2. A second small **test ruleset** exists in code and is exercised by at least one integration test. It does NOT need to be a fully-realized playable second wargame — it exists to prove the refactor's abstractions are real, not just paper. The minimal proof candidates are debated in §12 OQ 1; a likely shape is "WWII rules but with an alternating-by-phase turn flow" — same units, same vision, different phase sequence.
3. Adding a new unit type, terrain kind, modifier, or game-flow node doesn't require editing engine-core *or* UI-core — only data + (where needed) a single registration call. The generic UI iterates the ruleset registry and renders accordingly.
4. A new contributor can identify, by file location alone, which code is engine-core, which is UI-core (both reusable across rulesets), and which is WWII-specific. No grep required. See R3 / §13.1.
5. No rule outcome is computed UI-side (R4). Every value the UI renders that depends on a game rule comes from a public engine read API — not re-derived in a component or hook.

**Non-goals.** See §9.

---

## 4. The load-bearing invariant

One invariant survives the refactor unchanged and *defines* what "wargame the engine represents" means:

> A unit `target` is discovered by `observer` iff:
> ```
> distance(observer, target) ≤ observer.vision / target.effective_stealth
> ```
> where `effective_stealth` is some composition of intrinsic + position-derived stealth multipliers.

Every wargame this engine will represent uses this primitive. The refactor preserves the formula, generalizes everything around it (what counts as `effective_stealth`, what counts as `distance`, what other rules wrap it).

This is the line in the sand: anything that proposes to remove or replace this formula isn't a fit for this engine — it's a different engine.

---

## 5. Axis 1 — Turn / phase flow

### 5.1 Current state

[Game.ts](../../../src/core/Game.ts) hand-codes the sequence: a `GamePhase` enum in [GameState.ts](../../../src/core/GameState.ts) lists `"Deploy" | "Transition" | "AddRemoveUnits" | "Move" | "FireDeclare"`, and `Game.endDeployment / startTurn / endAddRemoveUnits / endMove / endTurn` move between them. The whole-turn / per-player cadence is wired in: `endTurn` advances `activePlayerIndex` to the next player and re-enters `Transition`.

### 5.2 Target shape (sketch)

The phase enum + transition methods get reframed as a **composable game-flow definition**:

- **Phase definitions** describe what a phase is and what's allowed in it (deploy, move, fire, etc.).
- **Transitions** describe how a phase ends and what comes next (often conditional on player action or game state).
- **Activation models** describe whose turn it is at any given phase: whole-team, single-unit-per-activation, alternating-units, etc.
- **End-of-turn triggers** describe what happens between rounds (reset GtG, run vision phase, etc.).

A game flow is then an assembly of these flow nodes, not a hand-coded class. A flow node is whichever of the four sub-types fits its role — phase, transition, activation model, or trigger. The graph metaphor is deliberate: phases are state-nodes, transitions are edges, activation models attach to phase-nodes, triggers fire on edges.

The WWII flow under this model:
```
deploy-phase → first-player-select → loop {
  add-remove-phase → move-phase → fire-declare-phase → end-of-turn (vision + reveal cascade) → swap-active-player
}
```

An alternating-by-phase flow (the candidate test ruleset) would assemble different flow nodes:
```
deploy-phase → loop {
  P1-move-phase → P2-move-phase → P1-fire-phase → P2-fire-phase → end-of-round (vision + reveal cascade)
}
```

### 5.3 What stays vs what generalizes

| Stays | Generalizes |
|---|---|
| Concept of "active player" (one player drives the UI at any moment) | What that player is allowed to do depends on the current phase, not the current code path |
| Vision phase as an end-of-something trigger | Whether "end-of-something" is end-of-turn, end-of-fire, end-of-round, etc. is a flow choice |
| `moveHistory` for undoing within an active phase | The set of "history-tracked" actions becomes per-phase-definition |

---

## 6. Axis 2 — Vision rules

### 6.1 Current state

[VisionCalculator.ts](../../../src/core/VisionCalculator.ts) `discover()` directly encodes:
- Single-highest-modifier pool (inherent + per-ray terrain mods).
- GtG ×2 stack when the per-ray highest > 1.
- Per-ray reads `unit.goneToGround`.

[Unit.ts](../../../src/core/units/Unit.ts) hard-codes Recon's vision multiplier path. Infantry hard-codes the dug-in path as the only inherent concealment source. The edge-grace and LOS-block rules are in [terrainCatalog.ts](../../../src/core/map/terrainCatalog.ts) per-terrain-kind, with the geometry inlined per entry.

### 6.2 Target shape (sketch)

The discover algorithm preserves the §4 invariant. Everything else that contributes to `effective_stealth` becomes a **stealth contributor** — a small object with one method (~`contribute(observer, target, position, map): { modifier: number; label: string } | null`) and a registered priority/composition rule.

For the WWII ruleset, the contributors are:
- Intrinsic-stealth contributor (always-on).
- Inherent contributor (dug-in for Infantry; could extend per future unit types).
- Per-position polygon contributor (the existing catalog entries).
- Per-ray wall contributor (existing).
- GtG stacking contributor (conditional on "any other contributor returned > 1").

The pooling rule (currently "single highest") is itself a configurable composition rule per ruleset — a different ruleset can pool by sum, by product, or any other combiner. Contributors don't declare their own composition; the ruleset picks one combiner once. See §11 D2. Modifiers like dug-in / GtG / Recon become contributor + activation pairings, not switch arms inside `Unit` and `VisionCalculator`.

Vision and stealth values stay on `Unit` (or its successor — see §7), but the *composition* logic moves out of `VisionCalculator` and into a configurable pipeline.

#### 6.2.1 Terrain-vision primitives (R2)

The current catalog inlines each kind's vision geometry — `appliesAsConcealment` and `blocksRay` are hand-written per entry. The refactor extracts these into a small set of **named primitives** that catalog entries reference by name + parameters:

- `concealment-when-target-inside` — Buildings.
- `concealment-along-ray-inside-segment` with asymmetric edge-grace parameter — Tall Woods, Short Terrain.
- `concealment-when-ray-crosses` — Short Walls.
- `block-ray-on-N-edge-crossings` with N parameter — Buildings.
- `block-ray-past-depth-X-inside` with depth parameter — Tall Woods.
- `block-ray-on-crossing` — Tall Walls.

A catalog entry then declares "this terrain kind composes these primitives with these parameters" rather than inlining ad-hoc geometry. Adding a new terrain kind in *any* ruleset becomes assembly, not recoding. Adding a *new* primitive is rare and engine-level. A different wargame that recognizes "Tall Woods" but treats it differently (e.g. depth limit 6″, no grace) is now a parameter change in that ruleset's catalog, not a fork.

### 6.3 What stays vs what generalizes

| Stays | Generalizes |
|---|---|
| `discover(observer, target)` returns boolean by the §4 formula | Where `effective_stealth` comes from |
| `see(observer, target)` as ray-blocking check | What blocks rays (currently: Tall walls + Tall Woods past depth limit) is per-rule-set |
| Mutual-reveal / fire-reveal / unreveal cascade in `runVisionPhase` | The set of phases that trigger a vision recompute is per-game-flow (see Axis 1) |
| Vision-terrain *primitives* (edge-grace, depth-block, edge-count-block) | Which terrain kinds use which primitives, and with what parameters |

---

## 7. Axis 3 — Map model

### 7.1 Current state

[GameMap.ts](../../../src/core/map/GameMap.ts) is rectangle + polygons + walls; positions are free-floating `{x, y}` inches. Units have `position: Point` and `setPosition(Point)`. The catalog pattern (polygonTerrainCatalog / wallTerrainCatalog) lets terrain kinds be added without touching the model.

### 7.2 Target shape (scoped — see §11 D5)

V2 abstracts the **substrate primitives** that the vision formula sits on top of, but does NOT ship hex or square-grid implementations. That's V3+. The goal here is to lay the foundation so a future grid / hex substrate can land without re-refactoring engine-core, while paying as little V2 dev cost as possible.

Three primitives extract from the WWII free-position-inches assumption:

- **Position** — how a unit's location is represented.
- **Distance** — how distance between two positions is measured (for the §4 formula).
- **Ray traversal** — how a vision ray walks the map (for ray-blocking and terrain-along-ray checks).

The §4 vision formula stays substrate-agnostic. Everything *above* these primitives (units, contributors, the discover algorithm) reads only "position," "distance(a, b)," and "ray-from-a-to-b" — never `{x, y}` arithmetic directly.

Everything *below* the formula — terrain catalogs, contributor pipelines, ray geometry — is allowed to differ per substrate. If a future hex substrate finds the WWII polygon catalog doesn't fit and ships its own cell-based terrain model, that's a tolerable outcome; we accept duplication beneath the formula rather than force a shared abstraction that doesn't pay rent. See over-abstraction note in §2.1 and §10 Risks.

For V2 the only substrate implementation is the existing free-position-inches model — adapted to read through the new primitives instead of directly poking `{x, y}`. No hex / grid code lands; just the seam that lets it land later.

### 7.3 What stays vs what generalizes

| Stays | Generalizes |
|---|---|
| Terrain catalog *pattern* (one entry per kind; visual + rules in one place) | Each substrate can have its own catalog if needed; sharing across substrates is allowed but not required |
| Vision rays as a primitive | How a ray traverses the substrate (line through inches vs. line through cells) — a substrate-level primitive |
| Move / preview / undo concepts | Snap behavior (free vs cell-snap) and distance unit (inches vs cells vs hexes) — a substrate-level primitive |

### 7.4 Explicit non-goals for V2

- Hex substrate implementation.
- Square-grid substrate implementation.
- Any UI for picking / switching substrates.
- A second terrain catalog shape (cell-based) for grid/hex.

All of the above are V3+. V2 ships only the seam.

---

## 8. Sequencing within this refactor

Phase B is one block in the V2 execution order, but it has its own internal staging. Suggested order (TBD in OQ 3):

1. **Lay the abstractions** (interfaces + factories + registries) without removing anything. Old WWII code still works by being one implementation of each new interface.
2. **Migrate the WWII code into those abstractions** one axis at a time, moving each migrated piece into `src/rulesets/wwii/` per R3 / §13.1. After each migration, all tests still pass.
3. **Add the test ruleset** as a second implementation. New integration tests prove the abstractions hold both rulesets.
4. **Remove redundant V1 paths** that are now subsumed by the new abstractions.

Each stage is its own commit (or small commit series). The refactor stays behavior-preserving for the WWII ruleset throughout.

---

## 9. Non-goals (out of scope for this refactor)

- **Authoring a second fully-realized ruleset.** The test ruleset proves the abstraction works; it does NOT need to be a complete, playable second wargame. That's V3+.
- **Hex / grid map UI.** The map-substrate abstraction lands; the actual hex/grid renderer + editor work is a separate later feature.
- **Rules editor for the new abstractions.** Players still configure the WWII ruleset through today's named-rule-sets editor. UI for "configure a different turn flow" is out of scope.
- **Backwards-compatible save format.** V1 save files (rule sets, map JSON) keep loading; V2 save files (full game state, per the separate save/load feature) get their own format that already accounts for the new abstractions.

---

## 10. Edge cases / risks

- **Over-abstraction (general).** Easy to design beautiful interfaces that nobody else ever instantiates. The test ruleset is the cure: every abstraction must be exercised by both rulesets, or it's premature. Implementation should push back on any "elegant" generalization that doesn't pay rent right now.
- **Over-abstraction in Axis 3 (map substrate).** The most likely place for this refactor to over-design. The target is *position-as-primitive + distance-as-primitive + ray-traversal-as-primitive* and the §4 vision formula sitting on top — nothing deeper. If a future hex/grid implementation needs its own contributor pipeline or its own terrain catalog because the shared abstractions don't quite fit, that's a tolerable outcome — duplication beats the wrong shared abstraction. Watch for scope creep during implementation; see §11 D5.
- **Under-abstraction.** Easy to leave the WWII assumptions just-below-the-surface. The test ruleset has to differ on something for each axis (turn flow, vision composition, or substrate) to keep us honest.
- **Phase B blocks Phase C/D for too long.** Staging (§8) lets us land in pieces, but if the refactor sprawls, the C/D features queue. Need a clear ship-criterion (§3 success criteria).
- **GtG, dug-in, Recon — V1 idioms might bleed.** The current rule writeups (`vision-rules-tweaks.md`, `vision-recon-tweaks.md`) describe them as universal facts when they're actually WWII-ruleset choices. The doc rewrites that come with this refactor should reframe them as "this ruleset's vision contributors."
- **R3 (delineation) decays over time.** Enforcement is by convention, not automated (§11 D8). The trade-off is that future PRs can sneak WWII-specific assumptions back into engine-core if no one notices. Mitigation: a periodic **boundary audit** — scan engine-core for imports of `src/rulesets/`. Cadence and ownership TBD; tracked in §12.
- **Test ruleset's scope creep.** Tempting to make it real. The test ruleset is a proof-of-abstraction artifact, not a playable game; aim for a couple hundred lines. See §11 D1.

---

## 11. Recorded decisions

**D1 — Test ruleset shape.** Option (d): a small "alt-WWII" that differs on every axis. Axis 1 = an alternating-by-phase turn flow; Axis 2 = a different stealth-pooling rule (e.g. sum instead of single-highest); Axis 3 = exercises the substrate primitives (free-position-inches with a deliberately-different distance metric is enough — no grid/hex implementation required, per D5). Keep it small — a couple hundred lines, not a playable game.

**D2 — Stealth composition is configurable.** The pooling rule is part of the ruleset configuration. WWII registers "single highest." Other rulesets can register "sum," "product," or any other combiner. Contributors don't declare composition; the ruleset picks one combiner once and the pipeline reads it at compose time.

**D3 — Internal staging order.** Approved as listed in §8: lay abstractions → migrate WWII into them → add test ruleset → remove dead V1 paths. Each stage is its own commit or small commit series. Stays behavior-preserving for the WWII ruleset throughout.

**D4 — Ruleset configuration lives in source code.** Engine-core source files contain the high-level classes (units, vision formula, game data scaffolding) and the shared abstractions (flow nodes, contributors, primitives, substrate). Per-ruleset source files (e.g. `src/rulesets/wwii/`) contain child classes, contributor pipelines, terrain catalogs, rule configurations, and any ruleset-specific game-state extensions. The codebase is *not* ruleset-agnostic at the file level — but the split is explicit and a meaningful share of components is engine-core, not WWII-specific. No JSON-loaded-from-disk ruleset format in V2.

**D5 — Axis 3 scope: punt grid/hex, keep the seam.** No hex / grid map implementations in V2. Abstract *only* position, distance, and ray-traversal as substrate primitives so the §4 vision formula sits cleanly above the substrate. The WWII free-position-inches model becomes one implementation of the primitives. V3+ can then add hex / grid implementations without re-refactoring engine-core. Vision rules and terrain catalogs are allowed to duplicate per substrate if shared abstractions don't fit — duplication beats the wrong shared abstraction.

**D6 — Vision-phase wiring belongs in game-flow.** "When does discover run?" is an Axis 1 concern. The discover algorithm itself stays composable per Axis 2; the trigger (end-of-fire, end-of-round, end-of-activation, etc.) is part of the game-flow definition.

**D7 — Naming: defer.** Concrete naming for "contributor / primitive / substrate / flow node / activation model / etc." is placeholder-only in this doc. The Definitions section (§14) is the single place those terms get tracked and revisited. Name once the implementation actually exercises each abstraction.

**D8 — R3 enforcement: by convention.** No ESLint rule, no CI import-graph check, no tsconfig project references in V2. The clean directory split (§13.1) plus reviewer attention is the front line. Mitigation against drift: a periodic **boundary audit** — `grep` engine-core for imports of `src/rulesets/` — owned by whoever's doing the next nontrivial refactor in the affected area. Cadence is a follow-up (§12).

---

## 12. Remaining follow-ups

The OQs are all answered (§11). Two threads stay open as implementation-time concerns:

1. **Naming pass.** Per D7, the placeholder terms — contributor, primitive, substrate, flow node, activation model — get revisited during implementation. Each new abstraction is added to §14 with a one-line gloss as it lands. A naming pass happens before §8 step 3 (adding the test ruleset), so the second implementation isn't built against names we'll rename a week later.

2. **R3 boundary-audit cadence.** Per D8, enforcement is by convention plus a periodic audit. To pick: who owns the audit and how often. Plausible options:
   - On-demand only (audit when adding a new ruleset or doing a major refactor in `src/core/`).
   - Quarterly heartbeat (a recurring audit even with no refactor in flight).
   - Per-PR ad-hoc (reviewer pings on suspicious imports).

   Default to *on-demand* unless drift gets observed; revisit if a boundary violation slips through.

---

## 13. Implementation notes

*Skeleton — fills in as decisions land.*

### 13.1 File organization (R3)

The single most important architectural artifact of this refactor is a clear directory split between **engine-core**, **UI-core**, and **ruleset-specific** code (R3 applies to both engine and UI layers). Concretely (proposed shape — exact names TBD):

```
src/
  core/                ← engine-core: knows nothing about any ruleset
    ruleset/           ← ruleset interfaces + registry + loader
    gameflow/          ← flow node types: phase / transition / activation / trigger
    vision/
      contributors/    ← contributor interfaces (not WWII contributors)
      primitives/      ← terrain-vision primitives (R2): edge-grace, depth-block, …
    map/
      substrate/       ← map-substrate abstraction (if Axis 3 lands per OQ 5)
  ui/                  ← UI-core: knows nothing about any ruleset
    canvas/            ← generic rendering (UnitToken, MapCanvas, overlays)
    components/        ← generic chrome (Sidebar, GameMenu, UnitPen, RulesEditor shell, …)
    hooks/             ← generic state plumbing (useGame, useGameContext, useRulesContext)
    views/             ← generic phase views (rendered per flow node)
    theme.ts
  rulesets/
    wwii/              ← everything WWII-specific (engine + UI)
      engine/
        units/         ← Infantry, Tank
        modifiers/     ← Recon, dug-in, GtG behaviors as contributors
        terrain/       ← WWII catalog entries: Building / TallWoods / ShortTerrain / Tall / Short
        gameflow/      ← Deploy → Move → FireDeclare flow assembled from core flow nodes
        index.ts       ← assembles the WWII engine half and registers it
      ui/              ← WWII-specific UI components, if any (V2 may not need many — most
                          UI generalizes via the registry; this folder exists for ruleset-specific
                          quirks like a bespoke editor for WWII-only knobs)
    test-ruleset/      ← the proof-of-abstraction ruleset (§3 success criterion 2)
```

Two load-bearing import rules:

1. **`src/core/*` never imports from `src/rulesets/*` or `src/ui/*`.** Engine-core is the lowest layer; nothing above it leaks down.
2. **`src/ui/*` never imports from `src/rulesets/*`.** UI-core renders whatever the ruleset registry exposes; it never references WWII-specific names directly. (Importing from `src/core/*` is fine — that's the engine API the UI consumes.)

The reverse (rulesets importing from core / ui) is fine and expected. Enforcement is by convention (§11 D8) — no lint rule, no CI check; reviewer attention plus a periodic boundary audit (§12) is the front line.

This is what makes R3 — and the whole refactor — visible and verifiable. A developer adapting the engine to a new wargame copies `src/rulesets/wwii/` (both `engine/` and `ui/`) as a starting point, edits within their own ruleset folder, and never touches `src/core/` or `src/ui/`.

### 13.2 Files most affected

**Engine-core:**
- [src/core/Game.ts](../../../src/core/Game.ts) — state machine, becomes assembled from gameflow blocks.
- [src/core/GameState.ts](../../../src/core/GameState.ts) — phase enum gets superseded.
- [src/core/VisionCalculator.ts](../../../src/core/VisionCalculator.ts) — `discover()` becomes "run contributor pipeline + apply §4 formula." Also exposes new read API (per R4): `effectiveStealth`, `detectionRange`, contributor breakdown.
- [src/core/rules.ts](../../../src/core/rules.ts) — rule-set loader entry point.
- [src/core/units/Unit.ts](../../../src/core/units/Unit.ts) — `getVision()` / `getIntrinsicStealth()` stay; concrete subclasses (`Infantry`, `Tank`) move to `src/rulesets/wwii/engine/units/`.
- [src/core/map/terrainCatalog.ts](../../../src/core/map/terrainCatalog.ts) — splits three ways: the catalog *shape* (interfaces) stays in `src/core/`, the WWII entries move to `src/rulesets/wwii/engine/terrain/`, and the vision-interaction geometry stays in `src/core/vision/primitives/` (already extracted by A3).

**UI:**
- [src/ui/canvas/effectiveStealth.ts](../../../src/ui/canvas/effectiveStealth.ts) — deletes; UI consumes the engine's new `effectiveStealth` read API (R4 / B7 fix).
- [src/ui/canvas/discoveryRings.ts](../../../src/ui/canvas/discoveryRings.ts) — composition logic removed; reads `effectiveStealth` and `detectionRange` from the engine.
- [src/ui/components/InfoMenu.tsx](../../../src/ui/components/InfoMenu.tsx) — stealth-breakdown composition removed; renders the engine-returned breakdown.
- [src/ui/components/RulesEditor.tsx](../../../src/ui/components/RulesEditor.tsx) — generic shell stays in `src/ui/components/`; WWII-named fields (Infantry/Tank/Recon/Building/…) become iterations over the registered ruleset, or the WWII ruleset provides a custom editor under `src/rulesets/wwii/ui/`.
- [src/ui/components/UnitPen.tsx](../../../src/ui/components/UnitPen.tsx) — to be created by Phase A-2 U2; iterates registered unit types and modifiers from the active ruleset rather than hardcoding Infantry/Tank/Recon/Dug-in.
- [src/ui/views/*.tsx](../../../src/ui/views/) — phase enum references replaced by flow-node references; otherwise mostly unchanged.

### 13.3 Tests
- All existing tests pass unchanged against the WWII ruleset.
- A new `tests/core/ruleset/` directory holds the test-ruleset-driven integration tests.
- Per-axis unit tests for each new abstraction (contributors, gameflow blocks, substrate, terrain primitives).

---

## 14. Definitions

> Placeholder terms used throughout this doc. Names are not final (§11 D7) — this section is where each abstraction gets a one-line gloss as it lands in code, so we can revisit naming once the shape is real.
>
> **Source code is the firm anchor.** Each term gets its full definition (purpose, invariants, examples) in TSDoc / module-level comments inside the module that implements it. This table is an index pointing back into the code, not the canonical definition. When a name changes, the code's comment changes first and this table follows. Recorded in [code-health-pass.md §7 D4](code-health-pass.md#7-recorded-decisions).

| Term (placeholder) | One-line gloss |
|---|---|
| **Contributor** (stealth contributor) | A small object that, given an observer + target + position + map, returns either a stealth multiplier with a label or null. Composed by the ruleset's pooling rule into `effective_stealth` for the §4 formula. |
| **Composition rule** (pooling rule) | How a ruleset combines multiple contributors' outputs into a single `effective_stealth`. WWII uses "single highest"; other valid choices include sum, product, weighted sum. Per ruleset, picked once. |
| **Primitive** (terrain-vision primitive) | A reusable, parameterized geometry rule for how a terrain kind affects sight or concealment. Examples: `concealment-along-ray-inside-segment` with grace param, `block-ray-past-depth-X-inside` with depth param. A catalog entry references primitives by name + parameters rather than inlining geometry. |
| **Substrate** (map substrate) | The map's coordinate system. Currently free-position inches; future candidates are square grid and hex grid. Defines position, distance, and ray-traversal — the three primitives the §4 vision formula sits on top of. |
| **Flow node** (game-flow node) | One of the four sub-types that compose a game flow: a **phase** (state — deploy, move, fire), a **transition** (edge — how one phase ends and what comes next), an **activation model** (property of a phase — whose turn / how many units), or an **end-of-trigger handler** (event — vision recompute, GtG reset, etc.). A game flow is a graph of these for a specific ruleset. |
| **Activation model** | The rule for whose turn it is at any given phase: whole-team, single-unit-per-activation, alternating-units, initiative-driven, etc. One of the four flow-node sub-types. |
| **Ruleset** | A bundle of game-specific code — units, contributors, catalogs, game-flow assembly, *and any ruleset-specific UI* — that registers itself with the engine. WWII is one ruleset; the test ruleset is another. Lives under `src/rulesets/<name>/`, split into `engine/` and `ui/` subfolders. |
| **Engine-core** | Code that knows nothing about any specific ruleset. Defines interfaces, flow nodes, primitives, substrate, contributors, the vision formula, and the registry. Lives under `src/core/`. Never imports from `src/rulesets/` or `src/ui/`. |
| **UI-core** | Generic React + Konva surfaces that render whatever the active ruleset registers. Sidebar, MapCanvas, UnitToken, generic phase views, hook plumbing, theme — none of it references WWII concepts by name. Lives under `src/ui/`. Never imports from `src/rulesets/`. |

When a term gets a final name during implementation, update its row here and grep the rest of the doc to replace the placeholder.
