import { useCallback, useRef, useState } from "react";
import { Game } from "../../core/Game.js";
import type { GameStateInit } from "../../core/GameState.js";

/**
 * React state wrapper for a Game instance.
 *
 * Game mutates its own state in place; we surface re-renders by bumping a
 * version counter every time `dispatch` runs an action. Components read
 * `game.state` directly — the version counter is just the React trigger.
 *
 * `reset` discards the current Game and constructs a fresh one from the same
 * `initFactory`, which returns the game to its starting state (Deploy phase,
 * player 0 active, no units, empty vision state).
 */
export function useGame(initFactory: () => GameStateInit) {
  const factoryRef = useRef(initFactory);
  factoryRef.current = initFactory;

  const [game, setGame] = useState(() => new Game(factoryRef.current()));
  const [, setVersion] = useState(0);

  const dispatch = useCallback(
    <R>(fn: (g: Game) => R): R => {
      const result = fn(game);
      setVersion((v) => v + 1);
      return result;
    },
    [game],
  );

  const reset = useCallback(() => {
    setGame(new Game(factoryRef.current()));
    setVersion((v) => v + 1);
  }, []);

  return { game, dispatch, reset };
}

export type Dispatch = ReturnType<typeof useGame>["dispatch"];
