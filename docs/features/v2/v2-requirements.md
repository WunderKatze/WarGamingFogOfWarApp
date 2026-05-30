# V2 Requirements

**Status:** Draft
**Owner:** Ryan
**Last Updated:** 2026-05-26

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

V2 starts with **two ordered pre-feature passes** — a code-health survey (with an OO / extensibility focus) and a **mechanics refactor** that adds rule-system abstraction so this codebase can later serve more than just the current 1/100-scale WWII ruleset. After those land, V2 ships a small set of **refinements** to V1 surfaces that aren't quite right yet (unit deployment, terrain authoring, save/load bugs), then a set of **new general features** that fill in missing parts of the companion (transports, the Glimpse mechanic, fast movers / aircraft, area-attack / artillery blind-fire detection, detect-by-movement / mines). Every feature gets its own doc.

---

## 3. Execution order

V2 work proceeds in four serial phases. Items within a phase can interleave; items across phases cannot.

**Phase A — Code-health pass.** Survey of current code against established software-engineering standards. Focus on OO design opportunities and extensibility weaknesses (the codebase must remain extensible — particularly as Phase B introduces new abstractions). No new features land during this phase. See §4.1.

**Phase B — Mechanics refactor.** Introduces the layers of abstraction needed for the codebase to support multiple rule systems — variable vision rules, alternative map types (hex / grid), different unit base values. The current 1/100-scale WWII ruleset becomes one configuration of the refactored mechanics, not the only thing the code knows how to be. Gets its own deep-dive document. No new features land during this phase. See §4.2.

**Phase C — Refinements to V1 features.** Three V1 surfaces that need a second pass before V2 builds further on them. Each gets its own doc. See §5.

**Phase D — New general features.** Five new companion mechanics. Each gets its own doc; order within phase TBD. See §6.

---

## 4. Pre-feature work (Phase A + B)

### 4.1 Code Health Pass

A structured survey of the V1 codebase against established software-engineering standards, especially OO design. Goals:
- Identify duplicated logic that should consolidate into a class / catalog / registry.
- Identify abstractions that leak (e.g. UI types referencing core invariants).
- Identify places where the V1 shape made an "OK for now" choice that's about to bend badly under Phase B's abstraction work.

Output: a short report (its own doc) + a sequence of refactor commits. Refactors should be behavior-preserving and individually committable.

### 4.2 Mechanics Refactor (rule-system abstraction)

Currently V1's mechanics are hard-coded to one wargame — a 1/100-scale WWII ruleset. The model layer reflects that: `Unit` knows `Tank` vs `Infantry`, the rules object knows `Recon` as the one modifier, the map knows three polygon terrain kinds and two wall kinds, vision is range-divided-by-stealth with one specific GtG rule, and the turn machine is a fixed `Deploy → Move → FireDeclare → Transition` sequence with each player taking a full turn at a time.

V2 layers new abstractions on top so a different ruleset (different unit types, different map geometry like hex / grid, different base values) can be loaded as a configuration rather than a fork. This is the architectural shift that lets the WWII ruleset keep developing in parallel with future rulesets without churning each other.

The refactor has three identified axes:

1. **Turn / phase flow.** The current fixed phase sequence is one game's turn structure. Other wargames vary widely:
   - Alternating-by-phase: P1 moves, P2 moves, P1 shoots, P2 shoots.
   - Activation-based: a player activates only a handful of units before the turn order swaps.
   - Initiative-based, simultaneous, hybrid, etc.
   
   The refactor decomposes the current `Game` state-machine into a **grab bag of reusable building blocks** (phase definitions, transition rules, activation models, end-of-turn triggers) that a game flow is composed from. Authoring a new turn structure means assembling existing blocks, not editing the state-machine class.

2. **Vision rules.** Most pieces (GtG stacking, edge grace, dug-in, single-highest-modifier-pool, Recon trait, etc.) are this ruleset's choices and need to become opt-in / configurable rather than baked into `VisionCalculator`. The discover algorithm itself stays — but the modifiers and the per-phase wiring that uses them become a configuration. **The single invariant across all wargames this codebase will represent:** discovery happens when `distance ≤ observer.vision / target.effective_stealth`. That formula is the load-bearing primitive everything else slots into; the refactor preserves it, generalizes everything around it.

3. **Map model.** Free-position inches (current V1 model) is one geometry. Hex and square-grid are alternatives. The polygon / wall catalog model already extends well — the bigger lift is the position substrate and how units snap / move on it.

This is significant scope and gets its own document. The goal here is the *separation* — concrete second/third rulesets are out of scope for V2; we just want the abstraction to exist and be exercised by at least one alternative test ruleset (likely a stripped-down "alternate turn-flow" ruleset that proves the building-block model works, not a fully-realized different game).

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
- **Concrete second / third rulesets.** Phase B builds the abstraction; actually authoring a non-WWII ruleset is V3+.

---

## 9. Open questions

1. **Does Phase A produce one report + refactor commits, or split into "survey commit" → "refactor PR(s)" → "lessons-learned commit"?** Affects how visible the survey work is in the history.
2. **Phase B scope ceiling.** How much abstraction is "enough" before we stop and let features build on it? Easy to over-build; easy to under-build and need a Phase B-2 later. The Phase B doc needs to pin this down.
3. **Game-menu Import + Debug-notice bug split.** Are both squarely §5.3, or does Debug-notice belong elsewhere?
4. **Glimpse cost model.** Per-move ray-march every cursor frame, or only on commit? Affects how snappy MoveView feels.
5. **Area-attack template authoring.** Built-in template shapes only, or player-editable templates (like terrain in the map editor)?
6. **Detect-by-movement granularity.** Path-segment intersection check, or continuous proximity sweep? Trade-off between accuracy and cost.
7. *(Add as they come up.)*

---

## 10. Index of V2 feature docs

As individual features spin off into Draft docs, list them here. Each line: doc + status + phase.

- [mechanics-refactor.md](mechanics-refactor.md) — Draft — Phase B §4.2
- [terrain-collection.md](terrain-collection.md) — Draft (parked) — Phase C §5.2
- *(more to come)*
