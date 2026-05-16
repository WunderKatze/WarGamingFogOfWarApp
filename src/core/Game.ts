import { GameState, type GamePhase, type GameStateInit } from "./GameState.js";
import type { Modifier, Point, UnitId, UnitSize, UnitType } from "./types.js";
import { Infantry } from "./units/Infantry.js";
import { Tank } from "./units/Tank.js";
import { Unit } from "./units/Unit.js";
import { VisionCalculator } from "./VisionCalculator.js";

export interface CreateUnitParams {
  type: UnitType;
  name: string;
  position: Point;
  size?: UnitSize;
  modifiers?: Iterable<Modifier>;
  /** Only used for Infantry; ignored for Tank. */
  dugIn?: boolean;
}

/**
 * Orchestrates the game's state machine — deployment, movement-turn phases,
 * and the vision-phase trigger points per requirements §3.4.
 *
 * Action methods validate the current phase and throw if called out of order,
 * so the UI can rely on phase to gate which controls are available.
 */
export class Game {
  readonly state: GameState;
  readonly visionCalculator: VisionCalculator;

  private nextUnitIdCounter = 1;

  constructor(init: GameStateInit) {
    this.state = new GameState(init);
    this.visionCalculator = new VisionCalculator(init.map);
  }

  // --- Deployment phase ---

  /**
   * Places a newly-created unit during the active player's deployment.
   * Infantry created here defaults to `dugIn: true` per §3.2 unless overridden.
   */
  deployUnit(params: CreateUnitParams): Unit {
    this.requirePhase("Deploy");
    const unit = this.buildUnit(params, /* defaultDugIn */ true);
    this.state.units.push(unit);
    return unit;
  }

  /**
   * Active player signals they're done placing initial units. Advances to a
   * Transition; from there `startTurn` will resume Deploy for the next
   * undeployed player, or begin movement turns once everyone has deployed.
   */
  endDeployment(): void {
    this.requirePhase("Deploy");
    this.state.deployedPlayers.add(this.state.getActivePlayer());

    if (this.state.isDeploymentComplete()) {
      // Movement turns begin with players[0] (the first deployer).
      this.state.activePlayerIndex = 0;
    } else {
      this.state.activePlayerIndex = this.findNextUndeployedPlayer();
    }
    this.state.phase = "Transition";
  }

  // --- Transition ---

  /**
   * Active player taps "Start Turn" from the Transition screen. Begins either
   * their initial deployment or their movement turn (running the pre-move
   * vision phase) depending on game state.
   */
  startTurn(): void {
    this.requirePhase("Transition");
    // Cross-turn notices (vision-rules-changed, future debug-used) are read
    // by TransitionView and consumed here so they don't bleed into the next
    // player's turn.
    this.state.rulesChangedThisTurn = false;
    if (!this.state.isDeploymentComplete()) {
      this.state.phase = "Deploy";
      return;
    }
    this.state.turnNumber += 1;
    this.state.phase = "Move";
    this.runVisionPhase(new Set());
  }

  // --- Move phase ---

  /**
   * Mid-game unit creation (reserves entering the board, infantry disembarking).
   * Infantry defaults to `dugIn: false` per §3.2 unless overridden.
   */
  createUnit(params: CreateUnitParams): Unit {
    this.requirePhase("Move");
    const unit = this.buildUnit(params, /* defaultDugIn */ false);
    this.state.units.push(unit);
    return unit;
  }

  moveUnit(unitId: UnitId, newPosition: Point): void {
    this.requirePhase("Move");
    const unit = this.requireOwnUnit(unitId);
    this.state.moveHistory.push({ unitId, priorPosition: unit.getPosition() });
    unit.setPosition(newPosition);
  }

  /**
   * Pops the most recent entry from `moveHistory` and restores that unit's
   * prior position. If the popped entry's unit no longer exists (it was
   * deleted since), silently skips it and pops the next one, until either a
   * living unit is restored or the stack is empty.
   *
   * Does **not** run the vision phase — vision only runs at the
   * `startTurn`/`endMove`/`endTurn` cadence per requirements §3.4.
   */
  undoLastMove(): void {
    this.requirePhase("Move");
    while (this.state.moveHistory.length > 0) {
      const entry = this.state.moveHistory.pop()!;
      const unit = this.state.getUnitById(entry.unitId);
      if (unit) {
        unit.setPosition(entry.priorPosition);
        return;
      }
    }
  }

  /**
   * Snap a single unit back to its position at the start of the current Move
   * phase, surgically removing all of that unit's entries from `moveHistory`
   * while leaving every other unit's history intact. No-op if the unit has
   * made no moves this phase.
   *
   * Use case: player has moved several units, then wants to undo just one
   * of them without rolling back everything that came after.
   */
  revertUnitMoves(unitId: UnitId): void {
    this.requirePhase("Move");
    const unit = this.requireOwnUnit(unitId);
    const earliest = this.state.moveHistory.find((e) => e.unitId === unitId);
    if (!earliest) return;
    unit.setPosition(earliest.priorPosition);
    this.state.moveHistory = this.state.moveHistory.filter((e) => e.unitId !== unitId);
  }

  deleteUnit(unitId: UnitId): void {
    this.requirePhase("Move");
    this.requireOwnUnit(unitId);
    this.state.units = this.state.units.filter((u) => u.id !== unitId);
    this.state.visionState.individualLists.delete(unitId);
    this.state.visionState.revealed.delete(unitId);
    for (const teamList of this.state.visionState.teamLists.values()) {
      teamList.delete(unitId);
    }
    for (const list of this.state.visionState.individualLists.values()) {
      list.delete(unitId);
    }
    this.state.firedThisTurn.delete(unitId);
  }

  toggleDugIn(unitId: UnitId): void {
    this.requirePhase("Move");
    const unit = this.requireOwnUnit(unitId);
    if (!(unit instanceof Infantry)) {
      throw new Error(`toggleDugIn: unit ${unitId} is not Infantry`);
    }
    unit.setDugIn(!unit.dugIn);
  }

  endMove(): void {
    this.requirePhase("Move");
    this.state.moveHistory = [];
    this.state.phase = "FireDeclare";
    this.runVisionPhase(new Set());
  }

  // --- Fire declaration ---

  toggleFire(unitId: UnitId): void {
    this.requirePhase("FireDeclare");
    this.requireOwnUnit(unitId);
    if (this.state.firedThisTurn.has(unitId)) {
      this.state.firedThisTurn.delete(unitId);
    } else {
      this.state.firedThisTurn.add(unitId);
    }
  }

  /**
   * Active player ends their turn. Applies fire actions, runs the vision-phase
   * reveal cascade, hands off to the next player via a Transition.
   */
  endTurn(): void {
    this.requirePhase("FireDeclare");
    this.runVisionPhase(this.state.firedThisTurn);
    this.state.firedThisTurn = new Set();
    this.state.activePlayerIndex = this.state.getNextPlayerIndex();
    this.state.phase = "Transition";
  }

  /**
   * Records that a vision-rule value was changed during this turn so the
   * next player's Transition screen can show a notice. Idempotent — flipping
   * the flag back to true after it's already true is a no-op. Called by the
   * UI's RulesProvider whenever it dispatches a rule edit. Independent of
   * phase: rule changes during Deploy / Move / FireDeclare all surface on
   * the same next-Transition.
   */
  markRulesChanged(): void {
    this.state.rulesChangedThisTurn = true;
  }

  // --- Internals ---

  private requirePhase(expected: GamePhase): void {
    if (this.state.phase !== expected) {
      throw new Error(
        `Invalid phase: expected ${expected}, got ${this.state.phase}`,
      );
    }
  }

  private requireOwnUnit(unitId: UnitId): Unit {
    const unit = this.state.getUnitById(unitId);
    if (!unit) throw new Error(`Unknown unit: ${unitId}`);
    const active = this.state.getActivePlayer();
    if (unit.teamId !== active) {
      throw new Error(
        `Active player ${active} cannot act on unit ${unitId} owned by ${unit.teamId}`,
      );
    }
    return unit;
  }

  private buildUnit(params: CreateUnitParams, defaultDugIn: boolean): Unit {
    const id = this.generateUnitId();
    const teamId = this.state.getActivePlayer();
    const common = {
      id,
      teamId,
      name: params.name,
      position: params.position,
      ...(params.size !== undefined && { size: params.size }),
      ...(params.modifiers !== undefined && { modifiers: params.modifiers }),
    };
    if (params.type === "Tank") {
      return new Tank(common);
    }
    return new Infantry({ ...common, dugIn: params.dugIn ?? defaultDugIn });
  }

  private generateUnitId(): UnitId {
    return `u${this.nextUnitIdCounter++}`;
  }

  private findNextUndeployedPlayer(): number {
    const start = this.state.getNextPlayerIndex();
    for (let i = 0; i < this.state.players.length; i++) {
      const idx = (start + i) % this.state.players.length;
      const p = this.state.players[idx]!;
      if (!this.state.deployedPlayers.has(p)) return idx;
    }
    throw new Error("findNextUndeployedPlayer: all players already deployed");
  }

  private runVisionPhase(firedIds: ReadonlySet<UnitId>): void {
    const before = new Set(this.state.visionState.revealed);
    this.visionCalculator.runVisionPhase(this.state.visionState, this.state.units, firedIds);
    const after = this.state.visionState.revealed;
    this.state.recentReveals = {
      added: [...after].filter((id) => !before.has(id)),
      removed: [...before].filter((id) => !after.has(id)),
    };
  }
}
