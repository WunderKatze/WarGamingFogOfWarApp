import { GameMap } from "./map/GameMap.js";
import type { Substrate } from "./map/substrate/index.js";
import type { TerrainCatalog } from "./map/terrainCatalog.js";
import { Unit } from "./units/Unit.js";
import type { Point, TeamId, UnitId } from "./types.js";
import type {
  CompositionResult,
  ContributorReading,
  VisionConfig,
} from "./vision/index.js";
import type { VisionState } from "./VisionState.js";

export class VisionCalculator {
  constructor(
    public readonly gameMap: GameMap,
    public readonly visionConfig: VisionConfig,
    public readonly substrate: Substrate,
    public readonly terrain: TerrainCatalog,
  ) {}

  /**
   * Geometric line-of-sight check (the "See" relation in the requirements).
   * True if the ray from the observer's position to the target's position is
   * not interrupted by any sight-blocking terrain rule. Distance and stealth
   * are NOT considered.
   */
  see(observer: Unit, target: Unit): boolean {
    return !this.gameMap.isRayBlocked(
      observer.getPosition(),
      target.getPosition(),
      this.terrain,
    );
  }

  /**
   * Distance- and stealth-aware detection (the "Discover" relation in the
   * requirements). True iff:
   *   - see(observer, target) is true, AND
   *   - distance(observer, target) <= observer.vision / target.effective_stealth
   *
   * Phase B 2b-ii: effective_stealth comes from the ruleset's vision
   * pipeline — every registered contributor is run, the readings are
   * flattened, and the ruleset's composition rule pools them. For WWII
   * that's `intrinsic × pool(externals) × gtg-if-pooled`, matching the
   * existing inline math exactly (see
   * docs/features/v1/vision-rules-tweaks.md §2.3 for the WWII semantics
   * and src/rulesets/wwii/engine/vision/composition.ts for the rule).
   */
  discover(observer: Unit, target: Unit): boolean {
    if (!this.see(observer, target)) return false;
    return this.substrate.distance(observer.getPosition(), target.getPosition())
      <= this.detectionRange(observer, target);
  }

  /**
   * Effective stealth at a position — the R4 public read API.
   *
   * Runs the ruleset's vision pipeline for one observation and
   * returns the composed result: the pooled multiplier plus the
   * per-source breakdown the UI can render directly ("intrinsic ×
   * 4/3, Tall Woods × 3, GtG × 2") without re-deriving any of the
   * math. Closes the B7 finding in code-health-pass-ui.md.
   *
   * Two modes:
   *   - **With observer** (the discover path): contributors that
   *     depend on the observer (e.g. WWII's terrain in ray-based
   *     mode) get a real observer to reason from.
   *   - **Without observer** (UI's "what's this unit's stealth at
   *     this point?" calls): observer-dependent contributors fall
   *     back to position-only behavior (WWII terrain returns
   *     polygons-containing-the-point; walls drop out because they
   *     have no meaning without a ray).
   */
  effectiveStealth(
    target: Unit,
    position: Point,
    observer?: Unit,
  ): CompositionResult {
    const readings: ContributorReading[] = this.visionConfig.contributors.flatMap((c) =>
      c.contribute(target, position, this.gameMap, observer),
    );
    return this.visionConfig.compositionRule(readings);
  }

  /**
   * Detection range — the R4 public read API for "from how far can
   * this observer detect this target?" Computes the §4 threshold
   * `observer.vision / target.effective_stealth` using the
   * observer's view of the target at the target's current position.
   * Callers asking about a hypothetical target position should use
   * `effectiveStealth(target, hypotheticalPosition, observer)` and
   * divide observer.getVision() themselves.
   */
  detectionRange(observer: Unit, target: Unit): number {
    const effective = this.effectiveStealth(target, target.getPosition(), observer);
    return observer.getVision() / effective.value;
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
  ): void {
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
      this.addNewEntriesToFixedPoint(state, units, unitsByTeam);
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
            const detected = onTeamList ? this.see(friendly, enemy) : this.discover(friendly, enemy);
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
