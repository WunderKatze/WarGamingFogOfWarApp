import type { GameMap } from "../../core/map/GameMap.js";
import { polygonTerrainCatalog } from "../../core/map/terrainCatalog.js";
import { getRules, type Rules } from "../../core/rules.js";
import type { PolygonTerrainType, Point, UnitType } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { getStealthAtPosition } from "./effectiveStealth.js";

/**
 * Pure ring-computation module for the Discovery Visualizer
 * (see docs/features/v1/discovery-visualizer.md).
 *
 * The renderer takes the player's settings (archetype + posture + GtG),
 * resolves them via `resolveLens`, then per visible own unit calls
 * `ringsForUnit` to get the incoming / outgoing pair to draw. No Konva or
 * React dependency — both the panel's dropdowns and the overlay's rings
 * use the same derivations so the UI never disagrees with itself.
 */

export interface Ring {
  /** Circle radius in inches (map units). */
  radiusInches: number;
  /** Label text shown adjacent to the ring (just the distance, color carries direction). */
  label: string;
  direction: "incoming" | "outgoing";
  /** Only set for abstract-divisor rings — the stealth value the divisor represents. */
  divisor?: number;
}

export type ArchetypeChoice =
  | { kind: "none" }
  | { kind: "unit"; unitType: UnitType; recon: boolean };

export interface ResolvedArchetype {
  unitType: UnitType;
  recon: boolean;
  /** Display name, e.g. "Recon Tank" or "Infantry". */
  label: string;
  vision: number;
  intrinsicStealth: number;
}

export interface ResolvedLens {
  archetype: ResolvedArchetype;
  /** Selected cover-modifier value (≥1). */
  postureModifier: number;
  /** Player-checked GtG toggle. */
  goneToGround: boolean;
  /**
   * Threat's effective stealth multiplier accounting for posture + GtG stack
   * (GtG stacks only when `postureModifier > 1`, matching the per-ray rule).
   */
  threatEffectiveStealthMultiplier: number;
}

export interface PostureOption {
  /** Multiplier value (1 = Open). */
  modifier: number;
  /** Display label, e.g. "Open" or "×2 cover (Short Terrain, Dug-in, Short Wall)". */
  label: string;
  /** Display names of sources that yield this modifier. Empty for Open. */
  sources: string[];
}

/**
 * Posture dropdown options derived from the current rules. Groups every
 * cover-providing source (polygons + dug-in + short wall) by its modifier
 * value so the dropdown auto-regroups when rules change.
 */
export function availablePostureModifiers(rules: Rules = getRules()): PostureOption[] {
  const byMod = new Map<number, string[]>();
  const add = (mod: number, label: string) => {
    if (mod <= 1) return;
    const existing = byMod.get(mod);
    if (existing) existing.push(label);
    else byMod.set(mod, [label]);
  };
  for (const [kind, mod] of Object.entries(rules.polygonStealthModifier)) {
    add(mod, polygonTerrainCatalog[kind as PolygonTerrainType].displayName);
  }
  add(rules.dugInStealthModifier, "Dug-in");
  add(rules.shortWallStealthModifier, "Short Wall");

  const options: PostureOption[] = [{ modifier: 1, label: "Open", sources: [] }];
  const sortedMods = [...byMod.entries()].sort(([a], [b]) => a - b);
  for (const [mod, sources] of sortedMods) {
    options.push({ modifier: mod, label: `×${mod} cover (${sources.join(", ")})`, sources });
  }
  return options;
}

/**
 * Threat archetype dropdown options derived from the rules. One entry per
 * unit type × Recon variant. Picks up new unit types automatically.
 */
export function availableArchetypes(rules: Rules = getRules()): ResolvedArchetype[] {
  const out: ResolvedArchetype[] = [];
  for (const unitType of Object.keys(rules.unitTypeStats) as UnitType[]) {
    for (const recon of [false, true]) {
      const stats = rules.unitTypeStats[unitType];
      const visionMult = recon ? rules.modifierEffects.Recon.visionMultiplier : 1;
      const stealthMult = recon ? rules.modifierEffects.Recon.stealthMultiplier : 1;
      out.push({
        unitType,
        recon,
        label: recon ? `Recon ${unitType}` : unitType,
        vision: stats.baseVision * visionMult,
        intrinsicStealth: stats.baseStealth * stealthMult,
      });
    }
  }
  return out;
}

/** Resolve the player's archetype choice + posture + GtG into a usable lens. Returns null in None mode. */
export function resolveLens(
  choice: ArchetypeChoice,
  postureModifier: number,
  goneToGround: boolean,
  rules: Rules = getRules(),
): ResolvedLens | null {
  if (choice.kind === "none") return null;
  const archetype = availableArchetypes(rules).find(
    (a) => a.unitType === choice.unitType && a.recon === choice.recon,
  );
  if (!archetype) return null;
  const gtgStacks = goneToGround && postureModifier > 1;
  const threatEffectiveStealthMultiplier =
    archetype.intrinsicStealth *
    postureModifier *
    (gtgStacks ? rules.goneToGroundStealthModifier : 1);
  return { archetype, postureModifier, goneToGround, threatEffectiveStealthMultiplier };
}

export interface RingsForUnitOptions {
  /**
   * When true, compute the incoming-ring stealth as if the unit has just
   * moved: skip dug-in (cleared on move, vision-rules-tweaks §2.1) and
   * skip GtG (cleared on move unless Recon, vision-recon-tweaks §2.2).
   * Used by the overlay during a live move preview so the rings reflect
   * the post-move state, not the stale pre-move flags.
   */
  treatAsJustMoved?: boolean;
}

/**
 * Incoming + outgoing rings for one own unit against the resolved lens.
 *
 * - Outgoing: `my.vision / threat.effective_stealth` — distance at which I detect the threat.
 * - Incoming: `threat.vision / my.effective_stealth_at_position` — distance at which the threat detects me.
 *   `my.effective_stealth_at_position` reads the unit's real concealment at `position`
 *   (terrain + inherent dug-in, single-highest), times the unit's intrinsic stealth,
 *   times GtG when concealed — matching the discover-calc semantics.
 *
 * Pass `options.treatAsJustMoved` during a move preview — the unit's dug-in
 * and GtG flags are flipped off for the incoming calc (Recon retains GtG).
 */
export function ringsForUnit(
  unit: Unit,
  position: Point,
  map: GameMap,
  lens: ResolvedLens,
  rules: Rules = getRules(),
  options: RingsForUnitOptions = {},
): Ring[] {
  const outgoingRadius = unit.getVision() / lens.threatEffectiveStealthMultiplier;

  const myStealth = getStealthAtPosition(
    unit,
    position,
    map,
    options.treatAsJustMoved ? { skipInherent: true } : {},
  );
  const effectiveGtg = options.treatAsJustMoved
    ? unit.hasModifier("Recon") && unit.goneToGround
    : unit.goneToGround;
  const myGtgStacks = effectiveGtg && myStealth.value > 1;
  const myEffectiveStealth =
    unit.getIntrinsicStealth() *
    myStealth.value *
    (myGtgStacks ? rules.goneToGroundStealthModifier : 1);
  const incomingRadius = lens.archetype.vision / myEffectiveStealth;

  return [
    { radiusInches: incomingRadius, label: `${formatInches(incomingRadius)}″`, direction: "incoming" },
    { radiusInches: outgoingRadius, label: `${formatInches(outgoingRadius)}″`, direction: "outgoing" },
  ];
}

/**
 * Abstract-divisors mode: outgoing-only rings at every reachable stealth
 * multiplier given the current rules. Set of divisors is derived from the
 * available posture modifiers (raw + GtG-stacked when > 1) so it auto-tracks
 * rule changes.
 */
export function abstractDivisorRings(unit: Unit, rules: Rules = getRules()): Ring[] {
  const divisors = new Set<number>([1]);
  for (const opt of availablePostureModifiers(rules)) {
    divisors.add(opt.modifier);
    if (opt.modifier > 1) divisors.add(opt.modifier * rules.goneToGroundStealthModifier);
  }
  const sorted = [...divisors].sort((a, b) => a - b);
  const vision = unit.getVision();
  return sorted.map((d) => ({
    radiusInches: vision / d,
    label: `÷${d} (${formatInches(vision / d)}″)`,
    direction: "outgoing" as const,
    divisor: d,
  }));
}

function formatInches(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}
