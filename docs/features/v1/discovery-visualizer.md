# Feature: Discovery Visualizer

**Status:** Complete
**Target Version:** v1
**Owner:** Ryan
**Last Updated:** 2026-05-25

> **Scope note.** A planning aid: two color-coded circles drawn around the player's own units that answer the two questions the player asks every Move phase — "what would an enemy *threat* detect me at?" (red, incoming) and "what would *I* detect that threat at?" (green, outgoing). The threat is a lens the player picks (an archetype + a posture) rather than a fixed set of rings, so the map shows exactly what the player is currently thinking about.
>
> **In scope, secondary.** The InfoMenu gains two new fields — intrinsic stealth and vision distance — so a player who knows the mechanics can do the math themselves when the visualizer's lens doesn't fit.

---

## 1. Motivation

Discovery in this game is `distance ≤ observer.vision / target.effective_stealth`. The numbers matter — a Recon Tank at 85.3″ vision sees a dug-in Infantry in Tall Woods (×3) at ~21″, but sees a plain Tank in the open at the full 85.3″. Players who don't have those products memorized end up making bad calls.

The earlier draft of this feature tried to answer everything at once — five concentric rings per unit covering every possible target-stealth value. It was too noisy, too abstract (rings labeled "÷4″ instead of "Tank-in-Building"), and didn't naturally surface the question the player actually asks: *given a specific threat I'm worried about, where am I detected and where can I detect?*

The reframe in this draft anchors the rings on the player's own units (so the answer is always "for *my* unit, vs the threat I'm thinking about") and lets the player pick one threat at a time (a "lens"). Two rings per unit cover both directions. Switching lenses is a one-tap operation; the panel never tries to show more than the player asked for.

### 1.1 User stories

The four planning questions players reported:

1. **Movement planning, vision footprint.** "As a player planning my movement phase I need to have a sense of what my units can see and what they would miss before and after their movement."
2. **Hunting a suspected hidden enemy.** "I'm fearful that a particular type of enemy unit is hiding in some terrain. I need to know where my unit can move to reveal them."
3. **Sneaking past suspected positions.** "I suspect certain general locations hold enemy troops. I need to know how much distance to keep from them to best avoid discovery."
4. **Closing to firing range** (future). "When engaging an enemy's revealed unit, I need to know how close I must move to be in firing range." — Out of scope here (vision feature), but the same UI shape will apply when fire-range lands.

Stories 1–3 all reduce to the same question shape — *"from position X, what's the detection range between unit Y and unit Z?"* — varying only in which of X/Y/Z is real (on the map) vs hypothetical (in the player's head). Anchoring rings on own units handles X and Z naturally (X = my unit's position, Z = my unit); the lens handles Y (the hypothetical threat).

---

## 2. User-facing behavior

### 2.1 Control panel

A small floating panel anchored to the **upper-right** of the screen, titled **Discovery Visualizer**. Visible during gameplay phases (Move, FireDeclare, AddRemoveUnits); hidden during Transition and while the map editor is open, mirroring the InfoMenu / GameMenu rule.

```
┌──────────────────────────────────────┐
│ Discovery Visualizer                 │
│                                      │
│ Show on   ▾ [ Selected Unit       ]  │
│ Threat    ▾ [ Tank                ]  │
│ Posture   ▾ [ Open                ]  │
│ ☐ Gone to Ground                     │
│ ☑ Copy unit info from hovered enemy  │
│                                      │
│ Tip: red = enemy sees me, green = I  │
│ see them. Move a unit to preview.    │
└──────────────────────────────────────┘
```

### 2.2 "Show on" (scope)

Three options:

- **Off** — panel configured but no rings render. Useful for muting without losing the lens state.
- **Selected Unit** (default) — rings render around the unit currently selected (InfoMenu lock or hover-as-fallback).
- **All my units** — rings render around every own unit. Use case: identifying blind spots in coverage. Visual density is expected; players can fall back to Selected mode when it's too busy. (We may add a "outgoing rings only in All mode" toggle after playtest if the dual-ring density turns out too noisy — see §6.)

### 2.3 "Threat" (lens archetype)

A dropdown of every unit type defined in the rules (Tank, Infantry, with per-type Recon variants — generated from `getRules().unitTypeStats` × the Recon modifier), plus a special **"None — abstract divisors"** option for advanced users.

- For a named archetype (Tank, Recon Infantry, etc.), both incoming and outgoing rings render — see §2.5.
- For **None — abstract divisors**, only the outgoing ring renders (we don't know the hypothetical observer's vision), shown as concentric circles at every distinct reachable stealth multiplier. Under current rules those are ×1, ×2, ×3, ×4, ×6 — so the outgoing ring is actually 5 concentric circles around my unit, one per reachable stealth value. Labels read `÷N (M″)`.

The threat list is regenerated whenever rules change (new unit type in v2 = automatically in the dropdown — no code edit).

### 2.4 "Posture" + Gone to Ground (lens posture)

The "lens posture" describes what posture the player assumes the *hypothetical threat* is in — it affects the outgoing ring's math (the threat's effective stealth) and does NOT affect the incoming ring (which uses my unit's *real* state — see §2.5).

**The dropdown's options are derived programmatically from the rules**, not hard-coded to a fixed list of terrain types. The derivation:

1. Always include **Open** (×1) as the baseline.
2. Walk every cover-providing source in the rules: `polygonStealthModifier.*`, `dugInStealthModifier`, `shortWallStealthModifier`. Skip values ≤ 1.
3. Group sources by their multiplier value. One dropdown entry per distinct value, labeled with the value and the contributing terrain names.

Under current rules this yields three entries:

| Label | Modifier | Sources |
|---|---|---|
| Open | ×1 | (baseline) |
| Light cover (×2) — Short Terrain, Dug-in, Short Wall | ×2 | ShortTerrain, dugIn, ShortWall |
| Heavy cover (×3) — Building, Tall Woods | ×3 | Building, TallWoods |

If a rule edit moves Building to ×4, the dropdown auto-regroups (×3 group shrinks to just Tall Woods; new ×4 entry appears for Building). Adding a new terrain type with a novel modifier value adds a new entry. No code or doc change needed.

The **Gone to Ground** checkbox stacks an additional ×`goneToGroundStealthModifier` (currently ×2) on top of the posture modifier — but only when the posture modifier > 1, matching the per-ray "concealed" rule from vision-rules-tweaks §2.3. So GtG in Open does nothing; GtG in any cover doubles the effective stealth.

The Infantry-only "Dug-in" disabling rule from earlier sketches doesn't apply here — the dropdown picks a *modifier value*, not a specific terrain kind. The "Dug-in" mention in the Light-cover label is informational (it's one of the things that produces ×2); selecting Light cover doesn't imply the threat is specifically dug-in.

When the threat archetype is **"None — abstract divisors,"** the posture / GtG controls are hidden — divisor mode shows every reachable value directly, so posture is implicit in the ring choice.

### 2.5 Ring rendering

Per shown own unit, two rings:

- **Incoming ring** (red, semi-transparent stroke): radius = `archetype.vision / my_unit.effective_stealth_at_render_position`. "Inside this circle, the threat detects me." The denominator reads my unit's *real* effective stealth at its current render position — including terrain at that spot, inherent dug-in if applicable, and ×GtG when concealed. This **auto-updates during move-preview**: the anchor moves with the cursor, and the would-be post-move state is used — dug-in is treated as cleared (vision-rules-tweaks §2.1) and GtG is treated as cleared except for Recon (vision-recon-tweaks §2.2). If the move is canceled, the rings revert to the unit's actual flags on the next render. So preview rings show what the player will actually have after committing the move, not the stale pre-move stealth.
- **Outgoing ring** (green, semi-transparent stroke): radius = `my_unit.vision / threat.effective_stealth_from_lens`. "Inside this circle, I detect the threat." The denominator comes from the lens (posture × GtG modifier × archetype intrinsic stealth).

Asymmetries jump out visually as the gap between the two rings (e.g. against a Recon Tank, the red ring is bigger than the green — they see me first). When both rings coincide, it's a symmetric matchup.

Rings are labeled with the radius in inches, oriented horizontally on the ring's right side.

Implementation note: rings are cheap Konva `Circle`s with `listening={false}` and `Text` labels; performance is not a concern even in All-units mode.

### 2.6 Copy unit info from hovered enemy

When the **"Copy unit info from hovered enemy"** checkbox is on (default), hovering a revealed enemy temporarily overrides the lens with that enemy's *actual* state — its real archetype, its real posture (real terrain at its position, real dug-in/GtG flags). The rings on nearby own units recompute against the real enemy. On hover-out, rings revert to the manually-selected lens.

This is the path for User Story 1's "concrete answer" mode — the player doesn't have to know how to set the lens to match the enemy on the table; they just hover.

When the checkbox is off, hover does nothing — useful when the player has set up a specific lens scenario and doesn't want it disturbed by mouse movement.

### 2.7 Default state on first open

- **Show on:** Off — the visualizer doesn't render until the player opts in (avoids surprising visual clutter on first map view).
- **Threat:** Infantry (plain). Most common threat type; Recon-Infantry / Recon-Tank are one toggle away.
- **Posture:** ×3 cover (the heavy-cover tier — Building / Tall Woods in current rules). Conservative threat assumption.
- **Gone to Ground:** on. Paired with the cover posture this gives the most pessimistic threat estimate by default; opting OFF reveals where the player has more reach than they thought.
- **Copy unit info from hovered enemy:** on.

Defaults persist across phases within a session via React state; reset on each page load. (localStorage persistence is a stretch goal — see §5.)

---

## 3. InfoMenu addition (in-scope, separate from rings)

The InfoMenu's unit-display row gains a **Vision** field and folds the unit's **intrinsic stealth** into the existing Stealth line as a contributing factor. Shown for both own units and revealed/detected enemies (consistent with vision-rules-tweaks §4 dec. 6, which already exposes posture state on revealed enemies).

- **Vision:** `unit.getVision()` in inches. Display-only.
- **Stealth (combined):** the total effective stealth = `intrinsic × position-stealth × GtG (when concealed)`. The display shows the combined total first, with a parenthesized breakdown of every factor that's not ×1. So a Tank in the open shows just `Stealth ×1`; a dug-in Infantry in a Building (Recon trait or no) with GtG shows `Stealth ×9 (×1.33 intrinsic × ×3 Building × ×2 GtG)`.

Why combined rather than two separate fields: the player's question is "how hard am I to spot," which is the discover-calc denominator — a single number. Splitting "intrinsic" out as a separate field made the player do the multiplication themselves; better to do it for them and show the breakdown for those who want to see where the number came from.

Example row:

```
Pos (12.3, 45.6) · Detected · Vision 85.3″ · Stealth ×6 (×1.33 intrinsic × ×3 Building × ×2 GtG)
```

If the row becomes too long, wrap to a second line (existing `detailRowStyle` already uses `flexWrap: "wrap"`).

---

## 4. Edge cases

| Scenario | Behavior |
|---|---|
| **Show on Selected** with no unit selected | Panel still renders; no rings draw. Tip text becomes "Select a unit to see rings." |
| **All my units** with many own units | Visual clutter is expected. Falls back to Selected mode on player action. We may pare to outgoing-only-in-All-mode after playtest (see §6 OQ 1). |
| **Show on All** + Copy-from-hover + hovered revealed enemy | All own units' rings switch to the hovered-enemy-derived lens. Snaps back on hover-out. |
| **Move-preview anchoring** | Rings re-anchor to the live render position (consistent with InfoMenu's existing preview-position override). Incoming ring also recomputes my-unit-effective-stealth at the preview position (e.g. ring shrinks if preview is inside a Building). |
| **Recon stealth = 1 means archetype Recon Tank has same intrinsic stealth as Tank** | Correct — the Recon Tank's stealth multiplier was dropped in vision-recon-tweaks. The Recon variants in the archetype list still differ via the vision multiplier (×4/3), so their incoming ring is larger than the plain variants'. |
| **None — abstract divisors mode + Copy-from-hover + hover revealed enemy** | Copy-from-hover is suppressed in abstract mode (no archetype to switch to). Hover does nothing. |
| **Rule edit mid-Move that changes vision / stealth values** | Rings re-render live via `useRulesContext` (the panel and overlay subscribe). |
| **Posture dropdown's selected multiplier disappears after a rule edit** | E.g. player had ×4 selected, then rules change so no terrain has ×4. The posture auto-resets to Open (×1, always available). |
| **Unit goes from revealed to no-longer-revealed mid-turn while hovered** | Copy-from-hover override drops on next render; rings revert to the lens. |
| **InfoMenu vision / intrinsic-stealth fields for an enemy that's only "detected" (not revealed)** | Shown — the player has detection of the unit, so they know its type and (transitively) its vision/intrinsic-stealth. Consistent with showing the unit type in the existing display. |

---

## 5. Recorded decisions

1. **All-units mode renders both rings per unit.** Ship with full info-density and pare back (likely to outgoing-only) after playtest if it turns out too noisy. The blind-spot use case the mode exists for is fundamentally outgoing-vision, so the fallback target is clear if needed.
2. **Direction-coded ring colors.** Incoming = red (`#c04040`-ish), outgoing = green (`#2d8e2d`-ish), semi-transparent stroke. Direction coding beats friend/foe coding here because the rings are always on own units; the meaningful information is which way detection flows.
3. **Ring labels on the right side, oriented horizontally**, just outside the ring. Distance only ("21.3″"); no per-ring "incoming/outgoing" prefix (color carries that).
4. **Abstract-divisors mode shows all 5 reachable rings** (×1, ×2, ×3, ×4, ×6 with current rules). It's already the advanced opt-in mode; players who choose it want the full picture.
5. **Posture dropdown collapses entries with the same modifier value, programmatically.** One entry per distinct cover-modifier value, with the contributing terrain names in the label. Auto-regroups when rules change; no code or doc churn when a new terrain kind lands.
6. **No visual cue when copy-from-hover is overriding the lens.** Rings just update to reflect the hovered enemy. Skip the dashed-stroke distinction in v1; revisit if testers report confusion about which lens the rings reflect.
7. **InfoMenu intrinsic-stealth + vision additions live in this doc**, not a separate one. They serve the same "make vision math visible" goal as the rings, and one without the other feels incomplete.

---

## 6. Out of scope

- **Wall / ray-direction visualization.** Walls' effect is per-ray and can't be cleanly represented as a circle. A future "ray-scan" mode could shade walls' shadow into the ring; not in v1.
- **Per-position lens auto-detection beyond the auto-update hover.** No "compute the strongest threat near each own unit and use *that* as the lens." Player picks the lens; the tool answers.
- **localStorage persistence** of the panel's state. Per-session is enough for v1.
- **Fire / weapon-range circles.** This is a vision-detection tool. A fire-range overlay is the natural sibling feature and lands separately.
- **Animated transitions** when settings change. Static rings re-render instantly.
- **Distance grid lines** outside the rings. The map editor's snap-to-grid covers position-comparison use cases.
- **Comparing two own units' rings with explicit overlap regions / Venn-style shading.** All-units mode is the closest current answer; explicit overlap geometry is overkill.
- **A separate lens per visualized unit.** One lens applies to all shown units. Per-unit lenses would multiply the controls.

---

## 7. Open questions

*None outstanding — all 7 questions answered into §5 decisions 1–7.*

---

## 8. Implementation notes

### 8.1 Component layout

- New `DiscoveryVisualizerPanel` component in [src/ui/components/](src/ui/components/). Renders the four controls + tip, anchored upper-right.
- New `DiscoveryVisualizerOverlay` Konva component rendered via the existing `MapCanvas.overlay` prop. Reads lens settings from a small context provider.
- New `DiscoveryVisualizerProvider` (similar shape to `DebugProvider`, `MapEditorProvider`): holds the lens state as React state, exposes setters. Mounted alongside the other providers in `App.tsx`.

### 8.2 Settings shape

```ts
type Scope = "off" | "selected" | "all";
type Archetype = { kind: "none" } | { kind: "unit"; unitType: UnitType; recon: boolean };

interface DiscoveryVisualizerSettings {
  scope: Scope;
  archetype: Archetype;
  /**
   * Player-selected cover-modifier value for the threat. The dropdown's
   * available values are derived live from the rules (see §2.4 dec. 5).
   * 1 means "Open" (always present). If a rule edit removes the currently-
   * selected value from the available set, the settings reset to 1.
   */
  postureModifier: number;
  goneToGround: boolean;
  copyFromHover: boolean;
}

/** Build the dropdown option list from the current rules. */
function availablePostureModifiers(rules: Rules): Array<{
  modifier: number;
  label: string;          // e.g. "Light cover (×2) — Short Terrain, Dug-in, Short Wall"
  sources: string[];      // display names of contributing terrain kinds
}>;
```

### 8.3 Ring computation

A pure module [src/ui/canvas/discoveryRings.ts](src/ui/canvas/discoveryRings.ts) (new file):

```ts
export interface Ring { radiusInches: number; label: string; color: "incoming" | "outgoing"; }

/** Outgoing + incoming rings for one own unit against an archetype lens. */
export function ringsForUnit(
  unit: Unit,
  position: Point,            // live render position (preview-aware)
  map: GameMap,
  lens: ResolvedLens,         // archetype + posture-derived effective stealth + GtG
): Ring[];

/** Special case: abstract-divisors mode — outgoing rings only at reachable multipliers. */
export function abstractDivisorRings(unit: Unit): Ring[];
```

`ResolvedLens` includes the archetype's vision and intrinsic stealth, plus the posture-derived effective-stealth multiplier (posture modifier × ×GtG when applicable).

The incoming ring's denominator (`my_unit.effective_stealth_at_position`) reuses the same logic as the InfoMenu's existing `getStealthAtPosition` helper — extract to a shared module so both call sites share one implementation.

### 8.4 Konva overlay

The overlay walks the visible units (per `scope` + the copy-from-hover override), maps each through `ringsForUnit`, and renders a `Group` containing `Circle` (stroked, semi-transparent, `listening={false}`) + `Text` labels. Position = unit's render position (honors the move-preview override the same way `UnitToken` does).

### 8.5 Hiding rules

Hide the panel and overlay during Transition phase and while the map editor is open. Same pattern as `InfoMenu` / `GameMenu` — `useMapEditorContext().isOpen` + `game.state.phase === "Transition"` short-circuits the render.

### 8.6 InfoMenu changes

In [src/ui/components/InfoMenu.tsx](src/ui/components/InfoMenu.tsx) `UnitDisplay`, add two `<span>` entries to the existing `detailRow`:

```tsx
<span>Vision {unit.getVision().toFixed(1)}″</span>
<span>·</span>
<span>Intrinsic stealth ×{unit.getIntrinsicStealth().toFixed(2).replace(/\.?0+$/, "")}</span>
```

Position these before the existing position-stealth line so the player reads "what's intrinsic to the unit" → "what applies at this position" left-to-right.

### 8.7 Tests

- New pure `discoveryRings.test.ts`: assertion patterns over scaled config values per vision-recon-tweaks §2.4 hygiene rule. Cover archetype-lens both rings, posture × GtG stacking, abstract-divisors mode.
- Shared-helper tests for the extracted `getStealthAtPosition` move with the extraction.
- No Konva-level visual tests; rendering is unit-test-light per project convention.
- InfoMenu test coverage stays light (no existing test for it); the field-display changes are trivial.
