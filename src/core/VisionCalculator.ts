import { GameMap } from "./map/GameMap.js";
import { distance } from "./map/geometry.js";
import { polygonTerrainCatalog } from "./map/terrainCatalog.js";
import { getRules } from "./rules.js";
import { Unit } from "./units/Unit.js";
import type { TeamId, UnitId } from "./types.js";
import type { VisionState } from "./VisionState.js";

/**
 * Standalone Gone to Ground eligibility check (vision-rules-tweaks §2.3).
 * Pure function over a single unit + the team-keyed history snapshots
 * the Game owns. Shared between the vision pipeline (via `makeGtGEligible`)
 * and the InfoMenu display, so the two surfaces agree on who qualifies.
 */
export function isGoneToGroundEligible(
  unit: Unit,
  gameMap: GameMap,
  movedLastTurnByTeam: ReadonlyMap<TeamId, ReadonlySet<UnitId>>,
  firedLastTurnByTeam: ReadonlyMap<TeamId, ReadonlySet<UnitId>>,
): boolean {
  if (movedLastTurnByTeam.get(unit.teamId)?.has(unit.id)) return false;
  if (firedLastTurnByTeam.get(unit.teamId)?.has(unit.id)) return false;
  const pos = unit.getPosition();
  for (const poly of gameMap.polygons) {
    if (!poly.containsPoint(pos)) continue;
    const entry = polygonTerrainCatalog[poly.terrainType];
    if (entry.stealthMultiplier > 1) return true;
  }
  return false;
}

export class VisionCalculator {
  constructor(public readonly gameMap: GameMap) {}

  /**
   * Geometric line-of-sight check (the "See" relation in the requirements).
   * True if the ray from the observer's position to the target's position is
   * not interrupted by any sight-blocking terrain rule. Distance and stealth
   * are NOT considered.
   */
  see(observer: Unit, target: Unit): boolean {
    return !this.gameMap.isRayBlocked(observer.getPosition(), target.getPosition());
  }

  /**
   * Distance- and stealth-aware detection (the "Discover" relation in the
   * requirements). True iff:
   *   - see(observer, target) is true, AND
   *   - distance(observer, target) <= observer.vision / target.effective_stealth
   *
   * effective_stealth = target.intrinsicStealth × max(applicable concealment modifiers) × gtg?
   * The pool of modifiers comprises every terrain modifier along the ray and the
   * target's own inherent concealment (e.g. dug-in); only the single highest of
   * these applies. **Gone to Ground** then stacks multiplicatively on top of the
   * single-highest when `gtgEligible(target)` returns true — see
   * docs/features/vision-rules-tweaks.md §2.3.
   *
   * `gtgEligible` is optional so external callers (and tests) don't need to
   * build the predicate; omitting it means no GtG bonus.
   */
  discover(observer: Unit, target: Unit, gtgEligible?: (u: Unit) => boolean): boolean {
    if (!this.see(observer, target)) return false;

    const observerPos = observer.getPosition();
    const targetPos = target.getPosition();

    const terrainMods = this.gameMap.getConcealmentModifiersAlongRay(observerPos, targetPos);
    const inherentMod = target.getInherentConcealmentModifier();
    let highestMod = Math.max(1, inherentMod, ...terrainMods);

    if (gtgEligible?.(target)) {
      highestMod *= getRules().goneToGroundStealthModifier;
    }

    const effectiveStealth = target.getIntrinsicStealth() * highestMod;
    const visionRange = observer.getVision() / effectiveStealth;

    return distance(observerPos, targetPos) <= visionRange;
  }

  /** Build the GtG predicate by closing over the helper + the gameMap. */
  private makeGtGEligible(
    movedLastTurnByTeam: ReadonlyMap<TeamId, ReadonlySet<UnitId>>,
    firedLastTurnByTeam: ReadonlyMap<TeamId, ReadonlySet<UnitId>>,
  ): (unit: Unit) => boolean {
    return (unit) =>
      isGoneToGroundEligible(unit, this.gameMap, movedLastTurnByTeam, firedLastTurnByTeam);
  }

  /**
   * Runs the full vision phase per requirements §3.3, mutating `state` in place.
   *
   * The algorithm is structured into three phases:
   *   1. Cleanup — drop lost-sight entries, recompute team lists, then unreveal
   *      units no enemy can See.
   *   2. Apply this turn's fire actions — fired units become Revealed.
   *   3. Cascade — iteratively add new individual-list entries (Discover for
   *      new detections, See for already-known team-list entries) and apply
   *      mutual detection until the Revealed set stops growing.
   *
   * The cascade's outer loop terminates because each pass is monotonic:
   * entries are only added, never removed, and the universe is finite.
   */
  runVisionPhase(
    state: VisionState,
    units: readonly Unit[],
    firedIds: ReadonlySet<UnitId>,
    movedLastTurnByTeam: ReadonlyMap<TeamId, ReadonlySet<UnitId>> = new Map(),
    firedLastTurnByTeam: ReadonlyMap<TeamId, ReadonlySet<UnitId>> = new Map(),
  ): void {
    const gtgEligible = this.makeGtGEligible(movedLastTurnByTeam, firedLastTurnByTeam);
    const unitsById = new Map<UnitId, Unit>();
    const unitsByTeam = new Map<TeamId, Unit[]>();
    for (const u of units) {
      unitsById.set(u.id, u);
      let team = unitsByTeam.get(u.teamId);
      if (!team) {
        team = [];
        unitsByTeam.set(u.teamId, team);
      }
      team.push(u);
    }

    // Phase 1: cleanup
    this.removeLostSightEntries(state, units, unitsById);
    this.recomputeTeamLists(state, unitsById, unitsByTeam);
    this.applyUnreveal(state, unitsById, unitsByTeam);
    this.recomputeTeamLists(state, unitsById, unitsByTeam);

    // Phase 2: fire actions reveal the firing units (idempotent; safe to do once up front)
    for (const id of firedIds) {
      if (unitsById.has(id)) state.revealed.add(id);
    }
    this.recomputeTeamLists(state, unitsById, unitsByTeam);

    // Phase 3: cascade — additions + mutual detection until Revealed stabilizes
    while (true) {
      const revealedBefore = state.revealed.size;
      this.addNewEntriesToFixedPoint(state, units, unitsByTeam, gtgEligible);
      this.applyMutualDetection(state, units);
      if (state.revealed.size === revealedBefore) break;
      this.recomputeTeamLists(state, unitsById, unitsByTeam);
    }
  }

  /** Step 2: remove enemies from F's individual list when F can no longer See them. */
  private removeLostSightEntries(
    state: VisionState,
    units: readonly Unit[],
    unitsById: ReadonlyMap<UnitId, Unit>,
  ): void {
    for (const observer of units) {
      const list = state.individualLists.get(observer.id);
      if (!list || list.size === 0) continue;
      for (const enemyId of [...list]) {
        const enemy = unitsById.get(enemyId);
        if (!enemy || !this.see(observer, enemy)) {
          list.delete(enemyId);
        }
      }
    }
  }

  /** Step 3: rebuild every team list as union of its members' individual lists + revealed enemies. */
  private recomputeTeamLists(
    state: VisionState,
    unitsById: ReadonlyMap<UnitId, Unit>,
    unitsByTeam: ReadonlyMap<TeamId, readonly Unit[]>,
  ): void {
    for (const [teamId, members] of unitsByTeam) {
      const teamList = new Set<UnitId>();
      for (const member of members) {
        const ind = state.individualLists.get(member.id);
        if (ind) for (const enemyId of ind) teamList.add(enemyId);
      }
      for (const revealedId of state.revealed) {
        const r = unitsById.get(revealedId);
        if (r && r.teamId !== teamId) teamList.add(revealedId);
      }
      state.teamLists.set(teamId, teamList);
    }
  }

  /** Step 4: a Revealed unit becomes unrevealed if no enemy can See it. */
  private applyUnreveal(
    state: VisionState,
    unitsById: ReadonlyMap<UnitId, Unit>,
    unitsByTeam: ReadonlyMap<TeamId, readonly Unit[]>,
  ): void {
    for (const x of [...state.revealed]) {
      const target = unitsById.get(x);
      if (!target) {
        state.revealed.delete(x);
        continue;
      }
      let seenByAnyEnemy = false;
      for (const [otherTeamId, otherMembers] of unitsByTeam) {
        if (otherTeamId === target.teamId) continue;
        for (const enemy of otherMembers) {
          if (this.see(enemy, target)) {
            seenByAnyEnemy = true;
            break;
          }
        }
        if (seenByAnyEnemy) break;
      }
      if (!seenByAnyEnemy) state.revealed.delete(x);
    }
  }

  /**
   * Steps 5 + 6: iterate addition until no new entries are added.
   * - If E is on F's team list, F adds E iff See(F, E).
   * - If E is not on F's team list, F adds E iff Discover(F, E).
   * Adding to F's individual list also expands F's team list.
   */
  private addNewEntriesToFixedPoint(
    state: VisionState,
    units: readonly Unit[],
    unitsByTeam: ReadonlyMap<TeamId, readonly Unit[]>,
    gtgEligible: (u: Unit) => boolean,
  ): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const friendly of units) {
        let fIndList = state.individualLists.get(friendly.id);
        let fTeamList = state.teamLists.get(friendly.teamId);
        for (const [enemyTeamId, enemies] of unitsByTeam) {
          if (enemyTeamId === friendly.teamId) continue;
          for (const enemy of enemies) {
            if (fIndList?.has(enemy.id)) continue;
            const onTeamList = fTeamList?.has(enemy.id) ?? false;
            const detected = onTeamList ? this.see(friendly, enemy) : this.discover(friendly, enemy, gtgEligible);
            if (!detected) continue;

            if (!fIndList) {
              fIndList = new Set();
              state.individualLists.set(friendly.id, fIndList);
            }
            fIndList.add(enemy.id);

            if (!fTeamList) {
              fTeamList = new Set();
              state.teamLists.set(friendly.teamId, fTeamList);
            }
            fTeamList.add(enemy.id);

            changed = true;
          }
        }
      }
    }
  }

  /** Step 8: any pair on each other's individual lists → both become Revealed. */
  private applyMutualDetection(state: VisionState, units: readonly Unit[]): void {
    for (const a of units) {
      const aList = state.individualLists.get(a.id);
      if (!aList) continue;
      for (const b of units) {
        if (a.id >= b.id) continue; // each unordered pair once
        if (!aList.has(b.id)) continue;
        const bList = state.individualLists.get(b.id);
        if (bList?.has(a.id)) {
          state.revealed.add(a.id);
          state.revealed.add(b.id);
        }
      }
    }
  }
}
