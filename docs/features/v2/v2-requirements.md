# V2 Requirements

**Status:** Draft
**Owner:** Ryan
**Last Updated:** 2026-05-25

> **Purpose.** Comprehensive view of what V2 hopes to achieve so we can converge on a feature list and an execution order. **Not** a single-feature spec — this is the planning doc that births the V2 feature docs that will live alongside it in [docs/features/v2/](.).
>
> **What this app is.** A **tabletop wargame companion** — it mirrors the player's physical table, tracks the state that's hard to do in your head (fog of war, vision rules, turn flow), and offers planning aids. It does **not** replace the physical experience: units are still moved by hand on the real table, fires are still resolved by rolling real dice, casualties are still removed physically. The app helps the player *decide and remember*; the table is where things actually happen. Any V2 feature that drifts toward replacing the table (e.g., rolled combat resolution, automated damage application, simulated dice) is out of scope by construction.
>
> **How this doc evolves.** Sections start sparse with seed entries. As we converge, candidate features get §4 expansions, OQs get answered into §6 decisions, and §7 fills in. Once §7 is locked, individual features spin off into their own `docs/features/v2/<feature>.md` and this doc becomes the table of contents.

---

## 1. V1 retrospective

What V1 actually shipped (for context — full details in [docs/features/v1/](../v1/)):

- **Map model & rendering** — polygons + walls with terrain-typed stealth and LOS rules; Konva canvas with pan/zoom.
- **Vision pipeline** — see / discover / mutual-detection / reveal cascade; per-team vision lists; Gone to Ground stealth stacking; Recon trait (vision multiplier + GtG-keeps-on-move).
- **Game state machine** — Deploy → Transition → AddRemoveUnits → Move → FireDeclare → Transition, with first-player select and per-turn cross-turn flags.
- **Editing surfaces** — map editor (draw-direct polygons/walls, save/load JSON), rules editor with named rule sets (save/load JSON), info menu with stealth+vision math.
- **Planning aids** — Discovery Visualizer (incoming/outgoing rings against a chosen threat lens).
- **Debug** — show-all-units toggle with cross-turn audit notice.

**V1 set the foundation as a usable tabletop companion.** Players can deploy, move (with preview), declare fire (which feeds reveal), and end turn — the app tracks what the table can't easily track (fog of war, per-ray discovery math, GtG persistence). V2 is where the companion gets richer: more state to track, more planning aids, better authoring, and persistence across sessions.

---

## 2. V2 themes

*High-level directions V2 is pursuing. Edit / add / strike as we converge. Every theme below must respect the "companion, not replacement" framing in §0.*

1. **State the app tracks for the player.** Things that are hard to remember at the table — order/posture markers (overwatch, suppression, etc. — recorded *by* the player, not derived), casualty / removed-unit history, turn-by-turn audit trail.
2. **Logistics & roster depth.** Reinforcements / transports — companion-side tracking for off-board reserves and unit-carrying-unit relationships. Successor to V1's mid-game-roster stop-gap.
3. **More planning aids.** Fire-range visualizer (same shape as the discovery rings), wall/ray-direction visualization, multi-unit "where can my whole force see" overlays.
4. **Persistence.** Save / load full game state, not just rule sets and maps. Resume a paused game; share a snapshot for bug reports.
5. **Terrain authoring quality of life.** The [terrain-collection model](terrain-collection.md) supersedes draw-direct.
6. **(Add or strike as needed.)**

---

## 3. Carryovers from V1

Known items that were deliberately punted or left incomplete in V1 and need V2 disposition:

| Item | Source | Notes |
|---|---|---|
| Game-menu Import + Debug-notice bugs | [v1/game-menu.md](../v1/game-menu.md) is Approved-not-Complete | Two small bugs deferred from V1; fix and flip Complete, or roll into a broader Game Menu V2 pass. |
| Terrain Collection model | [terrain-collection.md](terrain-collection.md) | Draft, parked. Decide if this lands early in V2 (replaces draw-direct) or middle/late. |
| Fire / weapon range visualizer | [v1/discovery-visualizer.md](../v1/discovery-visualizer.md) §6 Out of Scope | Same UI shape as discovery rings; lands when fire combat lands. |
| Wall / ray-direction visualization | [v1/discovery-visualizer.md](../v1/discovery-visualizer.md) §6 Out of Scope | Ray-scan mode that shades walls' shadows; nice-to-have. |
| localStorage persistence of Visualizer settings | [v1/discovery-visualizer.md](../v1/discovery-visualizer.md) §6 | Trivial; lands whenever convenient. |

---

## 4. Candidate features

*One entry per V2 idea. Format: short pitch + status. Promote a candidate to its own `docs/features/v2/<name>.md` when scope is converged enough to write a Draft.*

### 4.1 Casualty / removal tracking
*To be defined.* Today `deleteUnit` is a one-shot — removing a unit erases it. The companion should remember what was removed and when (turn, position, possibly cause as recorded by the player). Supports post-game review and the "did that unit fire last turn" question.

### 4.2 Order / posture markers
*To be defined.* Beyond GtG / dug-in, real wargames use orders like Overwatch, Suppressed, Pinned, Bailed-out, Reserve, etc. The companion records what the player declared at the table; no rules engine *acts* on the markers, but they're visible on tokens and surfaced in the InfoMenu so the player doesn't have to remember.

### 4.3 Reinforcements / transport
*To be defined.* Successor to V1's mid-game-roster stop-gap. Off-board reserves entering via designated map edges. Unit-carries-unit relationships (transport mounting / dismounting). Per-side reinforcement schedule the companion enforces.

### 4.4 Terrain Collection
See [terrain-collection.md](terrain-collection.md) (Draft parked). Reusable terrain pieces with real-world identity; drag-from-collection placement.

### 4.5 Save / load full game state
*To be defined.* Snapshot the entire `Game` (state + map + rules), serialize, load. Useful for resuming mid-session pauses, sharing bug repros, replaying. Interacts with versioning.

### 4.6 Fire-range visualizer
*To be defined.* Same UI shape as the discovery rings — a circle around the unit showing weapon-range distance. Note: the companion knows weapon ranges (the player configures them), but does not resolve fires.

### 4.7 Game-menu polish
Fix Import + Debug-notice bugs from V1 ([v1/game-menu.md](../v1/game-menu.md)). Possibly expand into a broader menu pass (preferences, profiles, etc.).

### 4.8 *(Add candidates as they come up.)*

---

## 5. Out of scope for V2

*Things explicitly NOT V2 — captured here so we don't accidentally let them creep in.*

- **Rolled combat resolution.** Fires are resolved at the physical table with physical dice. The app records who fired (already does — `firedThisTurn`) and surfaces the reveal consequence, but never simulates a roll, computes damage, or removes a unit because of combat math. Per §0, this is true by construction.
- **Automated unit removal.** Removal is the player's call (executed via Delete during AddRemoveUnits or Move), based on what happened at the table. The app doesn't decide.
- **Simulated AI opponents.** This is a 2+ human player companion; no AI side.

---

## 6. Open questions

1. **What's the V2 cadence?** Single big release, or rolling small features? Affects how aggressively we batch.
2. **How much of the V1 stop-gap (mid-game-roster) survives once transports/reinforcements land?** Full replacement, or augmentation?
3. **Order/posture markers — fixed vocabulary or extensible?** Hard-coded list (Overwatch, Suppressed, …) or rules-editor-defined like terrain types?
4. *(Add as they come up.)*

---

## 7. Proposed execution order

*To be filled once §4 + §6 converge.*

1. *(TBD)*
2. *(TBD)*

---

## 8. Index of V2 feature docs

Once individual V2 features get their own Draft docs, list them here:

- [terrain-collection.md](terrain-collection.md) — Draft (parked)
- *(more to come)*
