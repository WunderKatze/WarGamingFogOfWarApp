import { GameMap } from "./map/GameMap.js";
import type { Point, TeamId, UnitId } from "./types.js";
import { Unit } from "./units/Unit.js";
import { createEmptyVisionState, type VisionState } from "./VisionState.js";

/**
 * One entry in the per-Move-phase undo stack. Records the unit and the
 * position it occupied immediately before the move that's being recorded.
 * A multi-segment waypoint path produces a single entry whose
 * `priorPosition` is the pre-path position.
 */
export interface MoveHistoryEntry {
  unitId: UnitId;
  priorPosition: Point;
}

export type GamePhase =
  | "Deploy"
  | "Transition"
  /**
   * Pre-Move roster cleanup phase (add bailouts / reinforcements, remove
   * casualties) that runs once between each Transition and Move. The
   * pre-Move vision phase fires at the end of this phase, NOT at startTurn,
   * so adds/removes here participate in the same vision recompute.
   * See docs/features/mid-game-roster.md §2.3.
   */
  | "AddRemoveUnits"
  | "Move"
  | "FireDeclare";

export interface RecentReveals {
  added: UnitId[];
  removed: UnitId[];
}

export interface GameStateInit {
  map: GameMap;
  /** Ordered list of player team ids. Player at index 0 deploys and moves first. */
  players: readonly TeamId[];
}

/**
 * Container for the game's mutable state. Read-mostly from the UI; mutated only
 * by Game's action methods.
 *
 * `phase` and `activePlayerIndex` together encode the state machine position.
 * After `endDeployment`, `activePlayerIndex` advances and `phase` becomes
 * `Transition`; on `startTurn` it becomes either `Deploy` (next deployer)
 * or `Move` (after the last deployer has finished).
 */
export class GameState {
  readonly map: GameMap;
  readonly players: readonly TeamId[];

  units: Unit[] = [];
  visionState: VisionState = createEmptyVisionState();

  phase: GamePhase = "Deploy";
  activePlayerIndex = 0;
  turnNumber = 0;

  /** Units that the active player has marked as firing during the current FireDeclare phase. */
  firedThisTurn = new Set<UnitId>();

  /** Reveal events from the most recent vision phase, for the UI to display notifications. */
  recentReveals: RecentReveals = { added: [], removed: [] };

  /** Team ids that have finished their initial deployment. */
  deployedPlayers = new Set<TeamId>();

  /**
   * Set true once the player who goes first has been chosen via
   * `chooseFirstPlayer` (the post-deployment "who-goes-first" Transition
   * variant per docs/features/deployment-stop-gap.md §2.5). Stays true
   * for the rest of the game. Until set, the post-deployment Transition
   * renders the selection buttons instead of Start Turn.
   */
  firstPlayerChosen = false;

  /**
   * Per-Move-phase undo stack: each entry records a unit's position prior to
   * a committed move. Cleared on `endMove`. See feature
   * docs/features/movement-preview-and-undo.md.
   */
  moveHistory: MoveHistoryEntry[] = [];

  /**
   * Set when any vision-rule value mutated during the active player's turn.
   * Drives the "Vision Rules changed this turn" notice on the next player's
   * Transition screen, then cleared by `startTurn`. See feature
   * docs/features/game-menu.md.
   */
  rulesChangedThisTurn = false;

  /**
   * Set when Debug Mode (Show All Units) was toggled on at any point during
   * the active player's turn. Drives the "previous player used Debug Mode"
   * notice on the next player's Transition screen, then cleared by
   * `startTurn`. The toggle itself is session-only UI state — this flag is
   * the *audit* that survives into the next turn.
   */
  debugUsedThisTurn = false;

  constructor(init: GameStateInit) {
    if (init.players.length < 2) {
      throw new Error("GameState requires at least 2 players");
    }
    this.map = init.map;
    this.players = [...init.players];
  }

  getActivePlayer(): TeamId {
    return this.players[this.activePlayerIndex]!;
  }

  /** Index of the next player in rotation (wraps around). */
  getNextPlayerIndex(): number {
    return (this.activePlayerIndex + 1) % this.players.length;
  }

  /** True once every player has finished their initial deployment. */
  isDeploymentComplete(): boolean {
    return this.players.every((p) => this.deployedPlayers.has(p));
  }

  getUnitById(id: UnitId): Unit | undefined {
    return this.units.find((u) => u.id === id);
  }
}
