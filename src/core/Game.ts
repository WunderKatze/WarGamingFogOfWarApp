import { GameState, type GamePhase, type GameStateInit } from "./GameState.js";
import type { Modifier, Point, TeamId, UnitId, UnitSize, UnitType } from "./types.js";
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
    // Deployed units start "settled" — gone to ground by default. See
    // vision-rules-tweaks §2.3.
    const unit = this.buildUnit(params, /* defaultDugIn */ true, /* defaultGoneToGround */ true);
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
   * Records the player who goes first in the post-deployment "who-goes-first"
   * screen. Phase stays Transition — the normal Start-Turn screen renders for
   * the chosen player on the next render, giving a misclick a soft landing
   * (the wrong team's Transition is just a Start-Turn prompt, no map shown).
   * See docs/features/deployment-stop-gap.md §2.5.
   */
  chooseFirstPlayer(teamId: TeamId): void {
    this.requirePhase("Transition");
    if (!this.state.isDeploymentComplete()) {
      throw new Error("chooseFirstPlayer: deployment not complete");
    }
    if (this.state.firstPlayerChosen) {
      throw new Error("chooseFirstPlayer: first player already chosen");
    }
    if (this.state.turnNumber !== 0) {
      throw new Error("chooseFirstPlayer: only valid before the first turn");
    }
    const idx = this.state.players.indexOf(teamId);
    if (idx < 0) throw new Error(`chooseFirstPlayer: unknown team ${teamId}`);
    this.state.activePlayerIndex = idx;
    this.state.firstPlayerChosen = true;
  }

  /**
   * Active player taps "Start Turn" from the Transition screen. Begins
   * either their initial deployment or the pre-Move "Add/Remove Units"
   * phase depending on game state. The pre-Move vision phase does *not*
   * run here — it runs at `endAddRemoveUnits` so any roster cleanup the
   * player does first participates in the same vision recompute. See
   * docs/features/mid-game-roster.md §2.3.
   */
  startTurn(): void {
    this.requirePhase("Transition");
    // Cross-turn notices are read by TransitionView and consumed here so
    // they don't bleed into the next player's turn.
    this.state.rulesChangedThisTurn = false;
    this.state.debugUsedThisTurn = false;
    if (!this.state.isDeploymentComplete()) {
      this.state.phase = "Deploy";
      return;
    }
    this.state.turnNumber += 1;
    // Reset Gone to Ground for all of the active player's units — each
    // own-turn starts with the assumption units will be static; moves and
    // fires during the turn flip the flag back to false. See
    // docs/features/vision-rules-tweaks.md §2.3.
    const active = this.state.getActivePlayer();
    for (const unit of this.state.units) {
      if (unit.teamId === active) unit.goneToGround = true;
    }
    this.state.phase = "AddRemoveUnits";
  }

  // --- Add/Remove Units phase ---

  /**
   * Active player advances from the Add/Remove Units phase to Move,
   * triggering the pre-Move vision phase. Any units added or removed
   * during Add/Remove are included in this vision recompute.
   */
  endAddRemoveUnits(): void {
    this.requirePhase("AddRemoveUnits");
    this.state.phase = "Move";
    this.runVisionPhase(new Set());
  }

  // --- Move phase ---

  /**
   * Mid-game unit creation (reserves entering the board, infantry
   * disembarking). Infantry defaults to `dugIn: false` per §3.2 unless
   * overridden. Allowed during Move (mid-turn arrivals) or AddRemoveUnits
   * (pre-Move casualty cleanup), per docs/features/mid-game-roster.md.
   */
  createUnit(params: CreateUnitParams): Unit {
    if (this.state.phase !== "Move" && this.state.phase !== "AddRemoveUnits") {
      throw new Error(
        `createUnit requires Move or AddRemoveUnits, got ${this.state.phase}`,
      );
    }
    // Mid-game additions start "in flux" — not gone to ground until the
    // owner's next own turn (where startTurn resets the flag and a static
    // remainder of that turn leaves it true). See vision-rules-tweaks §2.3.
    const unit = this.buildUnit(params, /* defaultDugIn */ false, /* defaultGoneToGround */ false);
    this.state.units.push(unit);
    this.state.movedThisTurn.add(unit.id);
    return unit;
  }

  moveUnit(unitId: UnitId, newPosition: Point): void {
    this.requirePhase("Move");
    const unit = this.requireOwnUnit(unitId);
    // Snapshot dug-in and goneToGround alongside position so
    // undoLastMove / revertUnitMoves can restore them — per
    // docs/features/vision-rules-tweaks.md §2.1 / §2.3, moving clears
    // both, and undoing a move should restore the unit's prior state.
    const priorDugIn = unit instanceof Infantry ? unit.dugIn : undefined;
    this.state.moveHistory.push({
      unitId,
      priorPosition: unit.getPosition(),
      priorGoneToGround: unit.goneToGround,
      ...(priorDugIn !== undefined && { priorDugIn }),
    });
    unit.setPosition(newPosition);
    if (unit instanceof Infantry && unit.dugIn) unit.setDugIn(false);
    unit.goneToGround = false;
    this.state.movedThisTurn.add(unitId);
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
        unit.goneToGround = entry.priorGoneToGround;
        // Restore dug-in if it was snapshotted (Infantry only). Tank moves
        // recorded undefined for priorDugIn, so the check is a no-op.
        if (entry.priorDugIn !== undefined && unit instanceof Infantry) {
          unit.setDugIn(entry.priorDugIn);
        }
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
    unit.goneToGround = earliest.priorGoneToGround;
    if (earliest.priorDugIn !== undefined && unit instanceof Infantry) {
      unit.setDugIn(earliest.priorDugIn);
    }
    this.state.moveHistory = this.state.moveHistory.filter((e) => e.unitId !== unitId);
  }

  deleteUnit(unitId: UnitId): void {
    // Allowed in Move (mid-game losses), Deploy (fix a misclick during
    // setup, per docs/features/deployment-stop-gap.md §2.2), and
    // AddRemoveUnits (between-turn casualty cleanup, per
    // docs/features/mid-game-roster.md §2.3).
    if (
      this.state.phase !== "Move" &&
      this.state.phase !== "Deploy" &&
      this.state.phase !== "AddRemoveUnits"
    ) {
      throw new Error(
        `deleteUnit requires Move, Deploy, or AddRemoveUnits, got ${this.state.phase}`,
      );
    }
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

  /**
   * Reposition an already-deployed unit during the Deploy phase. Unlike
   * `moveUnit` (Move phase, undo-tracked via moveHistory), Deploy has no
   * undo stack — repositioning is a direct write to the unit's position.
   * See docs/features/deployment-stop-gap.md §2.1.
   */
  repositionDeployedUnit(unitId: UnitId, newPosition: Point): void {
    this.requirePhase("Deploy");
    const unit = this.requireOwnUnit(unitId);
    unit.setPosition(newPosition);
  }

  /**
   * Rename a unit owned by the active player. Trims whitespace and
   * rejects blank-after-trim. Currently Deploy-only (per stop-gap §5);
   * promote to other phases when the broader v2 deployment refactor
   * lands.
   */
  renameUnit(unitId: UnitId, newName: string): void {
    this.requirePhase("Deploy");
    const unit = this.requireOwnUnit(unitId);
    const trimmed = newName.trim();
    if (trimmed === "") {
      throw new Error("renameUnit: name cannot be empty");
    }
    unit.name = trimmed;
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
    const unit = this.requireOwnUnit(unitId);
    if (this.state.firedThisTurn.has(unitId)) {
      // Un-declaring fire: restore Gone to Ground only if the unit also
      // didn't move this turn. If they moved, gtg stays false regardless.
      this.state.firedThisTurn.delete(unitId);
      unit.goneToGround = !this.state.movedThisTurn.has(unitId);
    } else {
      this.state.firedThisTurn.add(unitId);
      unit.goneToGround = false;
    }
  }

  /**
   * Active player ends their turn. Applies fire actions, runs the vision-phase
   * reveal cascade, hands off to the next player via a Transition.
   */
  endTurn(): void {
    this.requirePhase("FireDeclare");
    this.runVisionPhase(this.state.firedThisTurn);
    // GtG is carried on Unit.goneToGround, set live during the turn by
    // moveUnit/toggleFire/etc — no per-team snapshots needed. The flags
    // persist into the opponent's turn (where vision reads them) and are
    // re-evaluated at this player's NEXT startTurn (reset to true, then
    // moves/fires flip back to false).
    this.state.firedThisTurn = new Set();
    this.state.movedThisTurn = new Set();
    this.state.activePlayerIndex = this.state.getNextPlayerIndex();
    this.state.phase = "Transition";
  }

  /**
   * Public Gone to Ground check — the badge / info-menu shorthand. The
   * actual stealth stack still only applies during a *concealed* discovery
   * (per vision-rules-tweaks §2.3), but the per-unit flag itself is the
   * eligibility part.
   */
  isGoneToGround(unit: Unit): boolean {
    return unit.goneToGround;
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

  /**
   * Records that the active player toggled Debug Mode on at any point
   * during this turn. Same idempotent flag-flip pattern as
   * `markRulesChanged` — once set, it stays set until `startTurn` clears
   * it for the next player.
   */
  markDebugUsed(): void {
    this.state.debugUsedThisTurn = true;
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

  private buildUnit(
    params: CreateUnitParams,
    defaultDugIn: boolean,
    defaultGoneToGround: boolean,
  ): Unit {
    const id = this.generateUnitId();
    const teamId = this.state.getActivePlayer();
    const common = {
      id,
      teamId,
      name: params.name,
      position: params.position,
      goneToGround: defaultGoneToGround,
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
