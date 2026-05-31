# Phase A-2: UI Code Health Pass

**Status:** Draft
**Target Version:** v2
**Owner:** Ryan
**Last Updated:** 2026-05-30

> **Purpose.** Survey `src/ui/` against the [mechanics-refactor.md](mechanics-refactor.md) decisions and the same OO / extensibility standards used in the engine-core pass ([code-health-pass.md](code-health-pass.md)). Output is a categorized findings list + a recommended sequence of pre-Phase-B UI refactor commits.
>
> Sibling to [code-health-pass.md](code-health-pass.md) (Phase A engine-core). Tests are out of scope here; covered in Phase A-3.

---

## 1. Scope & method

**Scope.** `src/ui/**/*.{ts,tsx}` — components, hooks, canvas, views, providers.

**Method.** Same four-category triage as the engine-core pass:

- **A — Pre-Phase-B refactor.** Small focused commit *now*; makes Phase B easier without locking in Phase B's abstractions.
- **B — Phase B will address.** Real issue, but the fix is the Phase B work. Tracked for completeness; no separate commit.
- **C — Defer.** Real but not blocking Phase B and not core-health critical.
- **D — Strength.** Pattern that already works; flagged so Phase B preserves it.

### 1.1 Architectural principle: rules logic lives in engine-core

This pass is graded against a stronger architectural principle than the engine-core pass needed to be:

> **No rule's *outcome* is computed across the engine ↔ UI boundary.** Every rule decision (does this stealth multiplier apply? what's the effective composition? is this unit detected? what counts as a valid move?) is reached entirely inside `src/core/`. The UI consumes engine-derived results and renders them; the UI never *re-derives* a rule outcome, even partially, even "just for display."

The principle is about *rule outcomes*, not the broader fact that UI and engine collaborate. Game pieces inherently span both — Dug-in is the canonical example. Distinguishing the four legitimate UI ↔ engine interactions from the one that's the actual violation:

| Pattern | What it looks like | Verdict |
|---|---|---|
| **Rule input** | UI captures user intent that becomes engine state. *Pen's "Dug-in" checkbox → `deployUnit({ dugIn: true })`.* | Fine. UI's job. |
| **Rule reflection** | UI knows about a rule's *structure* for UX purposes. *Pen disables the dug-in checkbox when penType is Tank, because dug-in is Infantry-only.* | Soft smell. Should ideally come from the engine ("what modifiers / flags apply to this unit type?"), but the engine still enforces; UI's gating is a UX courtesy. Phase B fixes via the modifier registry. Tracked under B3, B5 below. |
| **Rule display** | UI renders an engine-computed result. *"D" badge appears because `unit.dugIn === true`. GtG badge appears because `game.isGoneToGround(unit) === true`.* | Fine. UI's job. |
| **Rule outcome** | UI *computes* the answer to a rule question. *InfoMenu calculates `total_stealth = intrinsic × position × (gtg ? gtg_mult : 1)`, applying the "GtG only stacks when concealed" rule.* | **Hard violation.** This is B7. |

Dug-in cycles through three of these patterns and a fourth is just engine-internal:
- **Input:** pen captures the player's choice.
- **Display:** "D" badge renders the resulting flag.
- **Reflection:** pen disables the checkbox for non-Infantry; InfoMenu only renders the toggle for Infantry.
- **Outcome (engine-side, no leak):** `Infantry.getInherentConcealmentModifier()` returns the multiplier; `VisionCalculator` pools it.

That's a well-shaped interaction even though it spans both layers. The leak is when the *outcome* — "what's the multiplier the player should see?" — is recomputed UI-side instead of read from the engine.

**The risk the strict version of this principle guards against:** a rule's outcome ending up half in `VisionCalculator` and half in `InfoMenu`. When Phase B changes the rule (e.g. swaps single-highest pooling for sum), the engine site updates and the UI site silently drifts. The two surfaces disagree, the bug is hard to find, and "what's the actual rule?" becomes a question with multiple answers depending on which file you read first.

**The soft version (reflection)** is real but lower-stakes — disagreement here typically surfaces as "the checkbox was enabled but the engine rejected my call," not silent drift. Phase B will close those gaps as it formalizes the modifier registry; pre-Phase-B churn isn't worth it (the engine doesn't yet expose "what does this unit type support?" as a registry, and inventing that API now would compete with Phase B's design).

Hard-violation findings: §3 B7. Soft-violation (rule-reflection) findings: §3 B3. Strengths that already honor the principle: §5 D-UI1, D-UI2.

---

## 2. Category A — Pre-Phase-B UI refactor candidates

Two commits worth shipping. UI is leaner-than-engine on Category A because most of the WWII coupling is exactly the Phase B work (Axis 2 modifier model, R3 ruleset split), and refactoring it pre-Phase-B would lock in shapes Phase B should pick.

### U1. Extract `useVisibleUnits` hook

`getVisibleUnits(game, showAllUnits)` is **literally word-for-word duplicated** in three views:

- [MoveView.tsx:16-23](../../../src/ui/views/MoveView.tsx#L16-L23)
- [FireDeclareView.tsx:12-19](../../../src/ui/views/FireDeclareView.tsx#L12-L19)
- [AddRemoveUnitsView.tsx:28-35](../../../src/ui/views/AddRemoveUnitsView.tsx#L28-L35)

Each computes the same set: own-team units + enemy units on the active team's vision team-list (or all units in debug mode).

**Refactor.** Move to a `useVisibleUnits()` hook in `src/ui/hooks/`. The hook reads `useGameContext` and `useDebugContext` internally, so view callers just call `const visible = useVisibleUnits();` — no parameters.

**Why this matters.** Three identical definitions of "which units the active player can see right now" is a divergence trap — if vision-display rules ever evolve (e.g. a future "spotter" mode), one view will be missed. Extracting also tightens the lens: Phase B's modifier-driven detection model may want to add nuance here (e.g. "show units detected by Recon scouts even if not on my team list"), and a single call-site makes that one edit instead of three.

### U2. Extract `<UnitPen>` component (with `UNIT_SIZES` and form styles co-located)

The largest single duplication in the codebase. Each of three views has a near-identical "Pen" UI: name input, type select, size select, Recon checkbox, dug-in checkbox, autoName helper, click-handler that dispatches a `deployUnit`/`createUnit` with the same pen-fields-to-args mapping.

- [DeploymentView.tsx:31-119](../../../src/ui/views/DeploymentView.tsx#L31-L119) (~90 LOC including state + JSX + handler)
- [MoveView.tsx:63-129](../../../src/ui/views/MoveView.tsx#L63-L129) (~70 LOC)
- [AddRemoveUnitsView.tsx:52-74](../../../src/ui/views/AddRemoveUnitsView.tsx#L52-L74) (~25 LOC for state/handler) + [AddRemoveUnitsView.tsx:96-147](../../../src/ui/views/AddRemoveUnitsView.tsx#L96-L147) (~50 LOC for JSX)

`UNIT_SIZES: readonly UnitSize[] = ["Squad", "Platoon", "Company", "Battalion"]` is declared identically in all three. The `labelStyle` / `checkboxLabelStyle` / `selectStyle` / `textInputStyle` style objects are repeated in all three too.

**Refactor.** New `src/ui/components/UnitPen.tsx`:

```tsx
interface UnitPenProps {
  ownUnitCount: number;            // for autoName
  onPlace: (params: CreateUnitParams) => void;  // dispatcher-agnostic
  // DeploymentView extras (opt-in):
  cloneFromUnit?: Unit | undefined;  // pre-populates the pen
  inCloneRhythm?: boolean;
  onPenFieldChanged?: () => void;    // to break clone rhythm
}
```

The pen owns its own state (penType / penSize / penRecon / penDugIn / penName), the JSX, the styles, and `UNIT_SIZES`. The three views shrink dramatically (DeploymentView gains the clone-rhythm hooks; MoveView gates rendering on its `addPrimed` flag; AddRemoveUnitsView is the simplest case).

The two `deployUnit` vs `createUnit` distinctions stay in the caller's `onPlace` handler — the pen doesn't know which engine method to call, only what params to assemble.

**Why this matters.** Three ~90-LOC blocks of nearly-identical form code collapse to one. More importantly, **B-category findings about WWII hardcoding (B1 below) collapse from 3 sites to 1** — when Phase B makes unit types data-driven, the `<option value="Infantry"> / <option value="Tank">` list only needs to become a registry-driven iteration in *one* place, not three. UnitPen is therefore a strong Phase B amplifier even before Phase B starts.

---

## 3. Category B — Phase B will address (informational)

### B1. WWII type / modifier strings hardcoded in UI options and labels

Three sites hardcode `<option value="Infantry">` and `<option value="Tank">`:

- [DeploymentView.tsx:194-199](../../../src/ui/views/DeploymentView.tsx#L194-L199)
- [MoveView.tsx:253-260](../../../src/ui/views/MoveView.tsx#L253-L260)
- [AddRemoveUnitsView.tsx:108-117](../../../src/ui/views/AddRemoveUnitsView.tsx#L108-L117)

`"Recon"` modifier string appears as a literal in 7+ places ([DeploymentView.tsx:218](../../../src/ui/views/DeploymentView.tsx#L218), [MoveView.tsx:279](../../../src/ui/views/MoveView.tsx#L279), [AddRemoveUnitsView.tsx:136](../../../src/ui/views/AddRemoveUnitsView.tsx#L136), [DeploymentView.tsx:236-238](../../../src/ui/views/DeploymentView.tsx#L236-L238), [InfoMenu.tsx:142](../../../src/ui/components/InfoMenu.tsx#L142), …). Becomes registry-driven iteration once Phase B's modifier model lands. U2 (UnitPen) collapses 3 of these sites to 1, but the engine-side fix is Phase B.

### B2. `RulesEditor` is fully WWII-coupled

[RulesEditor.tsx](../../../src/ui/components/RulesEditor.tsx) names every rule field by its WWII concept: "Unit type — Infantry" + "Unit type — Tank" sections ([RulesEditor.tsx:276-304](../../../src/ui/components/RulesEditor.tsx#L276-L304)), Recon-specific Modifiers section ([RulesEditor.tsx:306-325](../../../src/ui/components/RulesEditor.tsx#L306-L325)), terrain sections enumerating Building / TallWoods / ShortTerrain / Short Wall / Tall Wall ([RulesEditor.tsx:327-368](../../../src/ui/components/RulesEditor.tsx#L327-L368)).

Phase B will make the editor data-driven from the registered ruleset (iterate over `unit types`, `modifiers`, `terrain kinds`). This is squarely Axis 2 + R3 work — exactly what [mechanics-refactor.md §9](mechanics-refactor.md#9-non-goals-out-of-scope-for-this-refactor) lists as "rules editor for the new abstractions" being out of V2 scope, so the editor stays WWII-shaped for V2 but is the clearest example of UI-side ruleset coupling.

### B3. `instanceof Infantry` sites in UI

Three remaining sites mirror the engine-side `instanceof Infantry` pattern we just eliminated via A2:

- [DeploymentView.tsx:150](../../../src/ui/views/DeploymentView.tsx#L150) — `setPenDugIn(selectedOwn instanceof Infantry ? selectedOwn.dugIn : true)` (clone handler)
- [InfoMenu.tsx:166](../../../src/ui/components/InfoMenu.tsx#L166) — `unit instanceof Infantry &&` (renders dugIn checkbox)
- [unitStatusBadges.ts:21](../../../src/ui/canvas/unitStatusBadges.ts#L21) — `u instanceof Infantry && u.dugIn` (computes badge set)

Each is asking a different question ("does this unit have a dugIn state to clone?" / "should I render a dugIn checkbox?" / "does this unit display the D badge?"). Cleaning them up requires the same shape decision Phase B will make for modifier-driven badges and per-modifier UI controls. Not worth a pre-Phase-B commit because the right abstraction depends on the modifier-as-contributor model Phase B introduces.

### B4. Phase-name string comparisons in UI

- [App.tsx:93-94](../../../src/ui/App.tsx#L93-L94) — `phaseDisplay(phase)` maps `"AddRemoveUnits"` → `"Add/Remove Units"`. Display name belongs on the flow-node definition (per [§5.2](mechanics-refactor.md#52-target-shape-sketch)).
- [App.tsx:136-147](../../../src/ui/App.tsx#L136-L147) — `ViewRouter` switches on `game.state.phase` to pick a view. Becomes data-driven: each flow-node carries a reference to its view.
- [MoveView.tsx:220](../../../src/ui/views/MoveView.tsx#L220) — `g.state.phase === "Move"` in the undo keyboard handler (redundant — MoveView only renders during Move phase anyway, but the explicit check exists).
- [InfoMenu.tsx:54](../../../src/ui/components/InfoMenu.tsx#L54) — `if (game.state.phase === "Transition") return null;`. Becomes a flow-node-level "should the info menu render here" property.

All Phase B Axis 1 (flow-node) work.

### B5. Direct VisionState reads in views

Views reach directly into `game.state.visionState.teamLists` / `game.state.visionState.revealed` from MoveView, FireDeclareView, AddRemoveUnitsView, DiscoveryVisualizerOverlay, InfoMenu. After A1 the engine encapsulated VisionState's *mutations*; reads stay open. Per Phase B, VisionState's read API may evolve (new contributors may produce derived views) — but as long as direct field-read works, no pre-Phase-B refactor needed. Phase B's discover-pipeline shape will inform whether a `useVisible(...)`-style facade is warranted then.

### B6. `RulesEditor`'s setter helpers spread the WWII enum shape

[RulesEditor.tsx:170-199](../../../src/ui/components/RulesEditor.tsx#L170-L199) — `setUnitStat`, `setModifierEffect`, `setPolygonStealth` are typed against `UnitType`, `Modifier`, `PolygonTerrainType`. These enums are themselves WWII-specific ([code-health-pass.md B12](code-health-pass.md)). Will follow the engine-side type generalization in Phase B.

### B7. UI re-implements the vision pipeline's intermediate math

The most important §1.1 violation: vision-rule logic is currently split across the engine ↔ UI boundary.

The engine exposes only `VisionCalculator.discover() → boolean` ("can A detect B?"). The UI needs more than yes/no: InfoMenu shows a unit's effective stealth + per-source breakdown; DiscoveryVisualizerOverlay draws detection rings whose radii depend on effective stealth; both need intermediate values that the engine computes but doesn't expose. So the UI re-derives them.

Three concrete sites:

- **[InfoMenu.tsx:119-131](../../../src/ui/components/InfoMenu.tsx#L119-L131)** re-implements the stealth composition rule: `total = intrinsic × position_stealth × (gtg_applies ? gtg_mult : 1)`. The "GtG only stacks when concealed (highestMod > 1)" rule is duplicated here from [VisionCalculator.ts:49](../../../src/core/VisionCalculator.ts#L49).
- **[effectiveStealth.ts:40-61](../../../src/ui/canvas/effectiveStealth.ts#L40-L61)** duplicates the single-highest pooling rule. Position-based instead of per-ray (the UI's read context doesn't have an observer), but the algorithm and the rule it encodes are the same as [VisionCalculator.ts:47](../../../src/core/VisionCalculator.ts#L47).
- **[discoveryRings.ts](../../../src/ui/canvas/discoveryRings.ts)** applies the §4 invariant directly (`radius = vision / effective_stealth`) plus a `treatAsJustMoved` flag that shadows the engine's "moving clears dug-in" rule ([Game.ts moveUnit](../../../src/core/Game.ts) → `unit.onMoved()` via A2).

**Fix.** Phase B's contributor pipeline naturally produces these intermediate values — its job is to compose them. Once it lands, the engine should expose a public read API:

- `effectiveStealth(unit, position): { value, breakdown: ContributorReading[] }` — answers "what's this unit's stealth at this position, and which contributors made it that?"
- `detectionRange(observer, target, options?): inches` — answers "from how far would this observer detect this target?"

UI consumes these, no longer composes them itself. InfoMenu's breakdown row becomes a render of the returned `ContributorReading[]`; discoveryRings becomes radius lookups; effectiveStealth.ts deletes.

**Why not pre-Phase-B (Category A) instead.** A "move effectiveStealth.ts into core, share with VisionCalculator" refactor was tempting, but the two functions aren't actually the same — VisionCalculator works per-ray, effectiveStealth.ts works per-position. Unifying them requires the same shape decision Phase B's contributor pipeline makes (per-context contributor activation), so the refactor either anticipates Phase B's design or solves only half the problem. The full fix is Phase B work.

**Bounded for now.** The current duplication is *bounded*: the shared `getStealthAtPosition` helper means InfoMenu and DiscoveryVisualizerOverlay can't diverge on the pooling rule (D-UI2 strength). The drift risk is engine ↔ UI, not UI ↔ UI. That keeps the bug surface small until Phase B closes it.

---

## 4. Category C — Defer (post-Phase-B or later)

- **C1. `useGame.ts` version-counter pattern.** [useGame.ts:21-30](../../../src/ui/hooks/useGame.ts#L21-L30) bumps a counter on every dispatch to trigger React re-renders, because Game mutates its state in place. Works fine; a future "Game emits change events" refactor would be cleaner, but it's an engine-side concern that doesn't fight Phase B.
- **C2. Form-style duplication across non-pen surfaces.** Beyond what U2 absorbs, there are more localized style-object repeats (e.g. small panels in GameMenu, DebugPanel). Could collapse to a `<FormField>` / `<FieldRow>` primitive set. Low-priority hygiene.
- **C3. `phaseDisplay` is an inline arrow with one branch.** [App.tsx:93-94](../../../src/ui/App.tsx#L93-L94). Will become flow-node data per B4; not worth a separate commit.
- **C4. `Header` mixes phase rendering with active-player chrome.** [App.tsx:96-125](../../../src/ui/App.tsx#L96-L125) is a single component doing two unrelated things. Splitting is hygiene, not blocking.
- **C5. `useGameContext`-vs-`useGame` naming.** `useGame.ts` is the hook that owns the Game instance; `useGameContext.tsx` is the React-context bridge. Naming is fine but a fresh reader has to disambiguate. Rename candidate (e.g. `useGameInstance` + `useGame`); skip until a broader rename pass.

---

## 5. Category D — Strengths to preserve

- **D-UI1. Catalog pattern flows through cleanly to InfoMenu.** [InfoMenu.tsx:194-221](../../../src/ui/components/InfoMenu.tsx#L194-L221) — `TerrainDisplay` reads `entry.displayName`, `entry.stealthMultiplier`, `entry.ruleDescription` directly from `terrainCatalog`. Adding a new terrain kind doesn't touch this component. Exactly the shape Phase B should aim for everywhere.
- **D-UI2. `getStealthAtPosition` shared helper.** [effectiveStealth.ts](../../../src/ui/canvas/effectiveStealth.ts) — pulled out of `InfoMenu` so [DiscoveryVisualizerOverlay](../../../src/ui/canvas/DiscoveryVisualizerOverlay.tsx) and `InfoMenu` can't diverge on what "stealth at this position" means. The exact pattern Phase B's contributor pipeline will expose as a public read API.
- **D-UI3. Sidebar primitives + theme.ts.** [Sidebar.tsx](../../../src/ui/components/Sidebar.tsx) (Sidebar / SidebarButton / SidebarSection) + [theme.ts](../../../src/ui/theme.ts) are already extracted shared chrome. Most views compose them rather than rolling their own.
- **D-UI4. `useRulesContext` as runtime-rules ↔ React bridge.** [useRulesContext.tsx](../../../src/ui/hooks/useRulesContext.tsx) cleanly wraps the core `getRules` / `setRules` / `subscribeRules` + version-bumping. Mirrors the engine-side pattern from [D2 strength](code-health-pass.md#5-category-d--strengths-to-preserve) one level up.
- **D-UI5. Single `UnitToken` component.** [UnitToken.tsx](../../../src/ui/canvas/UnitToken.tsx) renders any Unit — no per-subclass token variants. The visual differentiation (NATO symbol, color, badges) comes from props derived from unit data, not from subclass branching. Phase B's data-driven unit model fits this neatly.
- **D-UI6. Provider hierarchy is well-organized.** [App.tsx:70-87](../../../src/ui/App.tsx#L70-L87) — GameProvider → RulesProvider → DebugProvider → MapEditorProvider → SelectionProvider → DiscoveryVisualizerProvider. Each provider's dependencies are honored by the nesting order (e.g. RulesProvider needs GameProvider for `dispatch`). Stays.
- **D-UI7. `useDiscoveryVisualizerContext`-style settings provider pattern.** Recent addition; cleanly separates settings (provider) from rendering (overlay + panel). Future UI features should adopt this shape.

---

## 6. Recommended refactor commit sequence (Category A)

Two commits, ordered for safety:

1. **U1. `useVisibleUnits` hook.** Smallest surface, lowest risk. Three call sites collapse to one. ~30 LOC net.
2. **U2. `<UnitPen>` component.** Larger surface; touches three views plus a new component file. ~250 LOC of duplication collapses into one component. Bring `UNIT_SIZES` and form styles inside `UnitPen`'s scope.

After these land, Phase A-2 is complete and Phase A-3 (tests survey) begins.

---

## 7. Open questions for review

1. **Sign off on U1 + U2 as Phase A-2's output?** Or trim to just U1 because U2 is bigger and the Phase B unit-types refactor will rewrite the pen anyway?
2. **U2 scope: clone rhythm in or out?** DeploymentView's `inCloneRhythm` + `breakCloneRhythm` pattern is unique to deployment. Three options:
   - **(a)** `UnitPen` includes the clone-rhythm hooks (`cloneFromUnit`, `onPenFieldChanged`) as opt-in props. DeploymentView wires them; MoveView/AddRemoveUnitsView don't.
   - **(b)** `UnitPen` is rhythm-agnostic; DeploymentView wraps it with its own clone-state shell.
   - **(c)** Skip DeploymentView in U2; only collapse MoveView + AddRemoveUnitsView. Defer DeploymentView until the V2 [enhanced unit creation / deployment](v2-requirements.md#51-enhanced-unit-creation--deployment) feature (Phase C §5.1) refactors it anyway.

   Recommendation: **(a)** — keeps the pen's API honest (clone is a real pen concern, not a deployment-only one), and a future "clone in mid-game" feature won't need a third path.
3. **`useVisibleUnits` location.** New `src/ui/hooks/useVisibleUnits.ts` (new file) or fold into an existing hooks file? New file matches the existing one-hook-per-file convention.
4. **Phase A-3 (tests) scope check.** Tests survey is mostly "is there test coverage for X?" + "are the existing tests well-shaped?" The current test count (195) is high enough that the survey is real work. Tighter scope, less detail in the report, or full pass like A-1/A-2?
