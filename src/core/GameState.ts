import { GameMap } from "./map/GameMap.js";
import type { TeamId, UnitId } from "./types.js";
import { Unit } from "./units/Unit.js";
import { createEmptyVisionState, type VisionState } from "./VisionState.js";

export type GamePhase = "Deploy" | "Transition" | "Move" | "FireDeclare";

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
