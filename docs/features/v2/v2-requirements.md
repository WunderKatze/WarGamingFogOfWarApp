# V2 Requirements

**Status:** Draft
**Owner:** Ryan
**Last Updated:** 2026-06-02

> **Purpose.** Comprehensive view of what V2 hopes to achieve so we can converge on a feature list and an execution order. **Not** a single-feature spec — this is the planning doc that births the V2 feature docs that will live alongside it in [docs/features/v2/](.).
>
> **What this app is.** A **tabletop wargame companion** — it mirrors the player's physical table, tracks the state that's hard to do in your head (fog of war, vision rules, turn flow), and offers planning aids. It does **not** replace the physical experience: units are still moved by hand on the real table, fires are still resolved by rolling real dice, casualties are still removed physically. The app helps the player *decide and remember*; the table is where things actually happen. Any V2 feature that drifts toward replacing the table (e.g., rolled combat resolution, automated damage application, simulated dice) is out of scope by construction.
>
> **How this doc evolves.** Each entry below is short by design — full scope, edge cases, decisions, and OQs live in each feature's own doc once it spins off. As features get their own Draft, link them from §10. This doc stabilizes once §3's execution order is locked.

---

## 1. V1 retrospective

V1 shipped the tabletop-companion foundation: map model + rendering, the see/discover/reveal vision pipeline (with Gone to Ground and Recon), the Deploy → Move → FireDeclare turn machine, in-app map and rules editors with named JSON saves, the InfoMenu with full stealth/vision math, and the Discovery Visualizer planning aid. See [docs/features/v1/](../v1/) for the full Complete list.

The game is *playable* end-to-end as a companion — the player can run a 2-side fog-of-war game at the table, with the app handling everything the table can't easily do.

---

## 2. V2 in one paragraph

V2 starts with a **code-health survey** (with an OO / extensibility focus). After that lands, V2 ships a small set of **refinements** to V1 surfaces that aren't quite right yet (unit deployment, terrain authoring, save/load bugs), then a set of **new general features** that fill in missing parts of the companion (transports, the Glimpse mechanic, fast movers / aircraft, area-attack / artillery blind-fire detection, detect-by-movement / mines). Every feature gets its own doc.

> **Note (2026-06-02).** V2 originally also included a **mechanics refactor** (rule-system abstraction) as a second pre-feature pass. That work was attempted and reverted; the codebase commits to remaining WWII-only. See §9 for the recorded decision and [mechanics-refactor.md §0](mechanics-refactor.md) for the full retrospective.

---

## 3. Execution order

V2 work proceeds in three serial phases (originally four — Phase B was attempted and reverted; see §9). Items within a phase can interleave; items across phases cannot.

**Phase A — Code-health pass.** ✅ Complete. Survey of current code against established software-engineering standards. Three commits landed (A1 VisionState encapsulation, A2 per-unit move snapshot, A3 terrain-vision primitives), plus the Phase A-2 UI refactor (U1 useVisibleUnits, U2 UnitPen + useUnitPen) and Phase A-3 tests pass. See §4.1.

**~~Phase B — Mechanics refactor.~~** ❌ Reverted 2026-06-02. The rule-system abstraction layer was attempted across 14 commits and reverted. The codebase commits to WWII-only; future second-ruleset support comes via fork-per-ruleset, not pre-built abstraction. Retrospective in [mechanics-refactor.md §0](mechanics-refactor.md); strategic decision recorded in §9 below.

**Phase C — Refinements to V1 features.** Three V1 surfaces that need a second pass. Each gets its own doc. See §5.

**Phase D — New general features.** Five new companion mechanics. Each gets its own doc; order within phase TBD. See §6.

---

## 4. Pre-feature work (Phase A + B)

### 4.1 Code Health Pass

A structured survey of the V1 codebase against established software-engineering standards, especially OO design. Goals:
- Identify duplicated logic that should consolidate into a class / catalog / registry.
- Identify abstractions that leak (e.g. UI types referencing core invariants).
- Identify places where the V1 shape made an "OK for now" choice that's about to bend badly under Phase B's abstraction work.

Output: a short report (its own doc) + a sequence of refactor commits. Refactors should be behavior-preserving and individually committable.

### 4.2 ~~Mechanics Refactor (rule-system abstraction)~~ — reverted

Originally planned as the second pre-feature pass. Attempted across 14 commits and reverted 2026-06-02. The retrospective lives in [mechanics-refactor.md §0](mechanics-refactor.md); the strategic shift to fork-per-ruleset is recorded in §9 below. The original description is preserved in that doc for historical context.

---

## 5. Refinements (Phase C)

Each item gets its own feature doc.

### 5.1 Enhanced unit creation / deployment

V1's Deploy phase + the deployment-stop-gap (clone, rename, reposition) work but feel rough — pen-based one-at-a-time placement isn't ergonomic for setting up a 20-unit force. Scope-TBD refinements to make initial roster build-out faster: templates, multi-place, force-list import, etc. The specific refinements get fleshed out in the feature doc.

### 5.2 Enhanced terrain deployment

Successor to draw-direct map editing. The [terrain-collection.md](terrain-collection.md) Draft (parked from earlier) is the existing scoping work for this — V2 picks it back up and ships it. Reusable terrain pieces with real-world identity (named, fixed-dimension, owned-in-N-copies), placed by dragging from a collection sidebar.

### 5.3 Save / load bug fixes

The known issues in V1's save/load surfaces. Includes the [v1/game-menu.md](../v1/game-menu.md) Import bug (the reason that doc is still Approved-not-Complete) and any related save/load issues found during the Phase A health pass. Small scope; gets its own doc mostly so it's tracked.

---

## 6. New general features (Phase D)

Each item gets its own feature doc.

### 6.1 Transport unit subclass

A unit subclass that can **carry** other units and represent that they're being carried. Companion-side state tracking — what's mounted in what, when it dismounts, what that means for the carried units' visibility and posture. Direct successor in spirit to V1's mid-game-roster stop-gap which only handled bare add/remove.

### 6.2 Glimpse mechanic

If a unit starts a move out of vision (of any enemy) and ends a move out of vision, but its *path* between start and end would have put it in vision of an enemy unit at some intermediate point, the app should **detect** that crossing and **represent it to the player**. Otherwise an observing unit would silently miss fast units driving past — the table doesn't naturally surface this, so the companion must.

### 6.3 Fast mover unit subclass

A unit subclass for things that move so fast they don't really "occupy" a position over a turn — primarily aircraft, but abstracted as "Fast mover" so other rulesets can use the same machinery. The player places one anywhere on the table, the app surfaces what it would see / be seen by during that turn, and it's removed at the end of the turn to represent leaving the field of battle.

### 6.4 Area attacks (artillery)

Area attacks are geometric — a template (circle / rectangle / template-of-the-day) covers a region. The intent is that **for visible models on the table, players resolve geometric attacks themselves** (it's table-side geometry; the companion doesn't need to compute it). But there's a critical subcase: a player might **fire blind at suspected enemy positions**, and the app needs to detect when a blind area attack actually overlaps an enemy unit and communicate that to the *defending* player — without giving the *attacking* (turn) player any information beyond "your attack landed where you said."

### 6.5 Detect by movement

A general proximity mechanic: if a unit attempts to move *through* (within some radius of) an enemy it doesn't currently see, that crossing should be detected. The detection enables a family of rules — for example, "the moving unit is stopped early and placed right in front of the enemy it tried to walk through" is a likely default response. Also a natural substrate for **land mines**: a mine is a hidden entity that triggers a detect-by-movement event when entered.

---

## 7. Carryovers from V1 (not yet scheduled into V2)

Small items deferred from V1 docs that aren't yet promoted into Phase C/D. Track here so they're not lost; promote into a phase when scheduled.

| Item | Source | Notes |
|---|---|---|
| Game-menu Debug-notice bug | [v1/game-menu.md](../v1/game-menu.md) | Separate from the Import bug captured in §5.3; possibly cleanups inside §5.3's doc. |
| Fire / weapon range visualizer | [v1/discovery-visualizer.md](../v1/discovery-visualizer.md) §6 | Same UI shape as discovery rings; a planning aid for "how close do I need to be to fire." Could ride a future minor doc. |
| Wall / ray-direction visualization | [v1/discovery-visualizer.md](../v1/discovery-visualizer.md) §6 | Ray-scan shading for walls' shadows. |
| localStorage persistence of Visualizer settings | [v1/discovery-visualizer.md](../v1/discovery-visualizer.md) §5 | Trivial; folds into any visualizer pass. |
| Photo-backdrop map editor workflow | [v1/map-editor.md](../v1/map-editor.md) | Mentioned as out-of-scope in V1; could fold into §5.2 or stay separate. |

---

## 8. Out of scope for V2

Things explicitly NOT V2 — captured so they don't accidentally creep in. All follow from the §0 companion framing.

- **Rolled combat resolution.** Fires are resolved at the physical table with physical dice. The app records who fired (already does — `firedThisTurn`) and surfaces the reveal consequence, but never simulates a roll, computes damage, or removes a unit because of combat math.
- **Automated unit removal.** Removal is the player's call, based on what happened at the table. The app doesn't decide.
- **Simulated AI opponents.** This is a 2+ human player companion; no AI side.
- **Concrete second / third rulesets — *and* the abstraction layer that would support them.** Authoring a non-WWII ruleset is V3+. The Phase B attempt at pre-building a rule-system abstraction was reverted; see §9. When V3+ wants a second ruleset, the path is fork-per-ruleset.

---

## 9. Recorded decisions

**D1 — Mechanics refactor reverted; codebase stays WWII-only (2026-06-02).** The Phase B rule-system abstraction was attempted across 14 commits and reverted. The work produced more paper abstraction than load-bearing decoupling — Axis 1 (gameflow) was declared as data but never consulted, and the "test ruleset" was a stub manufactured to make slots look exercised rather than a real second consumer. The decisive concern: every future Phase C/D feature would pay a recurring abstraction tax to support a use case (second ruleset) that's V3+ and may not happen. Forward strategy: fork-per-ruleset when V3+ wants a second wargame; extract real shared abstractions later from two-datapoint comparison. The attempt is preserved on the `archive/phase-b` branch; the retrospective lives in [mechanics-refactor.md §0](mechanics-refactor.md).

---

## 10. Open questions

1. **Game-menu Import + Debug-notice bug split.** Are both squarely §5.3, or does Debug-notice belong elsewhere?
2. **Glimpse cost model.** Per-move ray-march every cursor frame, or only on commit? Affects how snappy MoveView feels.
3. **Area-attack template authoring.** Built-in template shapes only, or player-editable templates (like terrain in the map editor)?
4. **Detect-by-movement granularity.** Path-segment intersection check, or continuous proximity sweep? Trade-off between accuracy and cost.
5. *(Add as they come up.)*

---

## 11. Index of V2 feature docs

As individual features spin off into Draft docs, list them here. Each line: doc + status + phase.

- [mechanics-refactor.md](mechanics-refactor.md) — Reverted (record of attempt) — formerly Phase B §4.2
- [terrain-collection.md](terrain-collection.md) — Draft (parked) — Phase C §5.2
- *(more to come)*
