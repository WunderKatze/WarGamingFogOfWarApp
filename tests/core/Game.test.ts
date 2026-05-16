import { describe, expect, it } from "vitest";
import { Game } from "../../src/core/Game.js";
import { GameMap } from "../../src/core/map/GameMap.js";
import type { Point } from "../../src/core/types.js";
import { Infantry } from "../../src/core/units/Infantry.js";
import { Tank } from "../../src/core/units/Tank.js";

const p = (x: number, y: number): Point => ({ x, y });

const makeGame = (mapWidth = 200, mapHeight = 200) =>
  new Game({
    map: new GameMap({ width: mapWidth, height: mapHeight }),
    players: ["A", "B"],
  });

describe("Game — constructor", () => {
  it("starts in the Deploy phase with the first player active", () => {
    const g = makeGame();
    expect(g.state.phase).toBe("Deploy");
    expect(g.state.getActivePlayer()).toBe("A");
    expect(g.state.turnNumber).toBe(0);
    expect(g.state.units).toEqual([]);
  });

  it("rejects fewer than 2 players", () => {
    expect(
      () => new Game({ map: new GameMap({ width: 100, height: 100 }), players: ["solo"] }),
    ).toThrow(/at least 2 players/);
  });
});

describe("Game — deployment flow", () => {
  it("deployUnit places a unit owned by the active player with an auto-generated id", () => {
    const g = makeGame();
    const u = g.deployUnit({ type: "Tank", name: "M4", position: p(10, 10) });
    expect(u).toBeInstanceOf(Tank);
    expect(u.teamId).toBe("A");
    expect(u.id).toBeTruthy();
    expect(g.state.units).toEqual([u]);
  });

  it("Infantry deployed during deployment defaults to dugIn=true", () => {
    const g = makeGame();
    const u = g.deployUnit({ type: "Infantry", name: "1st Pl", position: p(5, 5) });
    expect(u).toBeInstanceOf(Infantry);
    expect((u as Infantry).dugIn).toBe(true);
  });

  it("Infantry dugIn can be overridden at deployment", () => {
    const g = makeGame();
    const u = g.deployUnit({
      type: "Infantry", name: "Standing", position: p(5, 5), dugIn: false,
    });
    expect((u as Infantry).dugIn).toBe(false);
  });

  it("deployUnit throws when called outside Deploy phase", () => {
    const g = makeGame();
    g.endDeployment(); // → Transition
    expect(() => g.deployUnit({ type: "Tank", name: "M4", position: p(0, 0) }))
      .toThrow(/Invalid phase/);
  });

  it("endDeployment advances to a Transition for the next undeployed player", () => {
    const g = makeGame();
    g.deployUnit({ type: "Tank", name: "M4", position: p(10, 10) });
    g.endDeployment();
    expect(g.state.phase).toBe("Transition");
    expect(g.state.getActivePlayer()).toBe("B");
    expect(g.state.deployedPlayers.has("A")).toBe(true);
  });

  it("after the final player ends deployment, the next Transition belongs to players[0]", () => {
    const g = makeGame();
    g.endDeployment(); // A done
    g.startTurn();     // → B's Deploy
    g.endDeployment(); // B done
    expect(g.state.phase).toBe("Transition");
    expect(g.state.getActivePlayer()).toBe("A");
    expect(g.state.isDeploymentComplete()).toBe(true);
  });
});

describe("Game — startTurn from Transition", () => {
  it("during deployment, startTurn enters Deploy for the next player", () => {
    const g = makeGame();
    g.endDeployment();
    g.startTurn();
    expect(g.state.phase).toBe("Deploy");
    expect(g.state.getActivePlayer()).toBe("B");
  });

  it("after deployment, startTurn enters Move, increments turn number, and runs the pre-move vision phase", () => {
    const g = makeGame();
    g.deployUnit({ type: "Tank", name: "A1", position: p(0, 0) });
    g.endDeployment();
    g.startTurn(); // → B's Deploy
    g.deployUnit({ type: "Tank", name: "B1", position: p(20, 0) });
    g.endDeployment();
    // Now A's first movement turn
    g.startTurn();
    expect(g.state.phase).toBe("Move");
    expect(g.state.turnNumber).toBe(1);
    // Pre-move vision phase ran: A1 and B1 are close enough to mutually discover
    const aList = g.state.visionState.individualLists.get("u1");
    expect(aList?.has("u2")).toBe(true);
  });
});

describe("Game — Move phase", () => {
  function setupAtMove(): Game {
    const g = makeGame();
    g.deployUnit({ type: "Tank", name: "A1", position: p(0, 0) });
    g.endDeployment();
    g.startTurn();
    g.deployUnit({ type: "Tank", name: "B1", position: p(200, 200) });
    g.endDeployment();
    g.startTurn(); // A's movement turn
    return g;
  }

  it("moveUnit updates the unit's position", () => {
    const g = setupAtMove();
    g.moveUnit("u1", p(5, 5));
    expect(g.state.getUnitById("u1")?.getPosition()).toEqual({ x: 5, y: 5 });
  });

  it("moveUnit refuses to move an enemy unit", () => {
    const g = setupAtMove();
    expect(() => g.moveUnit("u2", p(50, 50))).toThrow(/cannot act on unit/);
  });

  it("createUnit (mid-game) defaults Infantry to dugIn=false", () => {
    const g = setupAtMove();
    const u = g.createUnit({ type: "Infantry", name: "Reserves", position: p(2, 2) });
    expect((u as Infantry).dugIn).toBe(false);
    expect(g.state.units).toContain(u);
  });

  it("deleteUnit removes the unit and purges it from vision state", () => {
    const g = setupAtMove();
    expect(g.state.units.find((u) => u.id === "u1")).toBeDefined();
    g.deleteUnit("u1");
    expect(g.state.units.find((u) => u.id === "u1")).toBeUndefined();
    expect(g.state.visionState.individualLists.has("u1")).toBe(false);
    expect(g.state.visionState.revealed.has("u1")).toBe(false);
  });

  it("toggleDugIn flips Infantry dugIn", () => {
    const g = makeGame();
    const inf = g.deployUnit({ type: "Infantry", name: "I", position: p(0, 0) });
    g.endDeployment();
    g.startTurn();
    g.deployUnit({ type: "Tank", name: "B1", position: p(200, 200) });
    g.endDeployment();
    g.startTurn();
    expect((inf as Infantry).dugIn).toBe(true);
    g.toggleDugIn(inf.id);
    expect((inf as Infantry).dugIn).toBe(false);
  });

  it("toggleDugIn throws for Tanks", () => {
    const g = setupAtMove();
    expect(() => g.toggleDugIn("u1")).toThrow(/not Infantry/);
  });

  it("endMove transitions to FireDeclare and runs the pre-fire vision phase", () => {
    const g = setupAtMove();
    g.endMove();
    expect(g.state.phase).toBe("FireDeclare");
  });
});

describe("Game — move history and undo", () => {
  function setupAtMove(): Game {
    const g = makeGame();
    g.deployUnit({ type: "Tank", name: "A1", position: p(0, 0) });
    g.endDeployment();
    g.startTurn();
    g.deployUnit({ type: "Tank", name: "B1", position: p(200, 200) });
    g.endDeployment();
    g.startTurn();
    return g;
  }

  it("moveUnit pushes the unit's prior position onto moveHistory", () => {
    const g = setupAtMove();
    g.moveUnit("u1", p(5, 5));
    expect(g.state.moveHistory).toEqual([
      { unitId: "u1", priorPosition: { x: 0, y: 0 } },
    ]);
  });

  it("undoLastMove restores the unit's prior position and pops the entry", () => {
    const g = setupAtMove();
    g.moveUnit("u1", p(5, 5));
    g.undoLastMove();
    expect(g.state.getUnitById("u1")?.getPosition()).toEqual({ x: 0, y: 0 });
    expect(g.state.moveHistory).toEqual([]);
  });

  it("undoLastMove walks back through multiple moves in LIFO order", () => {
    const g = setupAtMove();
    g.moveUnit("u1", p(5, 5));
    g.moveUnit("u1", p(10, 10));
    g.moveUnit("u1", p(15, 15));
    g.undoLastMove();
    expect(g.state.getUnitById("u1")?.getPosition()).toEqual({ x: 10, y: 10 });
    g.undoLastMove();
    expect(g.state.getUnitById("u1")?.getPosition()).toEqual({ x: 5, y: 5 });
    g.undoLastMove();
    expect(g.state.getUnitById("u1")?.getPosition()).toEqual({ x: 0, y: 0 });
    expect(g.state.moveHistory).toEqual([]);
  });

  it("undoLastMove on an empty history is a no-op", () => {
    const g = setupAtMove();
    expect(() => g.undoLastMove()).not.toThrow();
    expect(g.state.moveHistory).toEqual([]);
  });

  it("undoLastMove skips entries for units that have since been deleted", () => {
    const g = setupAtMove();
    const inf = g.createUnit({ type: "Infantry", name: "I", position: p(1, 1) });
    g.moveUnit("u1", p(5, 5));     // entry for u1
    g.moveUnit(inf.id, p(9, 9));   // entry for infantry (top of stack)
    g.deleteUnit(inf.id);          // infantry's entry is now an orphan
    g.undoLastMove();              // should skip the orphan and restore u1
    expect(g.state.getUnitById("u1")?.getPosition()).toEqual({ x: 0, y: 0 });
    expect(g.state.moveHistory).toEqual([]);
  });

  it("endMove clears moveHistory", () => {
    const g = setupAtMove();
    g.moveUnit("u1", p(5, 5));
    g.moveUnit("u1", p(10, 10));
    g.endMove();
    expect(g.state.moveHistory).toEqual([]);
  });

  it("undoLastMove throws when called outside Move phase", () => {
    const g = setupAtMove();
    g.endMove(); // → FireDeclare
    expect(() => g.undoLastMove()).toThrow(/Invalid phase/);
  });

  it("revertUnitMoves snaps a unit to its position at the start of the Move phase", () => {
    const g = setupAtMove();
    g.moveUnit("u1", p(5, 5));
    g.moveUnit("u1", p(10, 10));
    g.moveUnit("u1", p(15, 15));
    g.revertUnitMoves("u1");
    expect(g.state.getUnitById("u1")?.getPosition()).toEqual({ x: 0, y: 0 });
    expect(g.state.moveHistory).toEqual([]);
  });

  it("revertUnitMoves only removes the target unit's entries, leaving others intact", () => {
    const g = setupAtMove();
    const inf = g.createUnit({ type: "Infantry", name: "I", position: p(1, 1) });
    g.moveUnit("u1", p(5, 5));      // u1's first move
    g.moveUnit(inf.id, p(2, 2));    // infantry's move (interleaved)
    g.moveUnit("u1", p(10, 10));    // u1's second move
    g.revertUnitMoves("u1");
    expect(g.state.getUnitById("u1")?.getPosition()).toEqual({ x: 0, y: 0 });
    // Infantry untouched at its post-move position; its entry still on the stack.
    expect(g.state.getUnitById(inf.id)?.getPosition()).toEqual({ x: 2, y: 2 });
    expect(g.state.moveHistory).toEqual([
      { unitId: inf.id, priorPosition: { x: 1, y: 1 } },
    ]);
  });

  it("revertUnitMoves on a unit with no moves this phase is a no-op", () => {
    const g = setupAtMove();
    expect(() => g.revertUnitMoves("u1")).not.toThrow();
    expect(g.state.getUnitById("u1")?.getPosition()).toEqual({ x: 0, y: 0 });
    expect(g.state.moveHistory).toEqual([]);
  });

  it("revertUnitMoves refuses an enemy unit", () => {
    const g = setupAtMove();
    expect(() => g.revertUnitMoves("u2")).toThrow(/cannot act on unit/);
  });

  it("revertUnitMoves throws when called outside Move phase", () => {
    const g = setupAtMove();
    g.moveUnit("u1", p(5, 5));
    g.endMove();
    expect(() => g.revertUnitMoves("u1")).toThrow(/Invalid phase/);
  });
});

describe("Game — FireDeclare phase and end of turn", () => {
  // Units placed far apart so neither can discover the other; firing is the
  // only way to put something into Revealed.
  function setupAtFireDeclare(): Game {
    const g = makeGame(2000, 200);
    g.deployUnit({ type: "Tank", name: "A1", position: p(0, 0) });
    g.endDeployment();
    g.startTurn();
    g.deployUnit({ type: "Tank", name: "B1", position: p(1500, 0) });
    g.endDeployment();
    g.startTurn(); // A's move
    g.endMove();
    // Sanity: nobody discovered anybody, nobody is revealed yet.
    expect(g.state.visionState.revealed.size).toBe(0);
    return g;
  }

  it("toggleFire adds and removes from the firedThisTurn set", () => {
    const g = setupAtFireDeclare();
    g.toggleFire("u1");
    expect(g.state.firedThisTurn.has("u1")).toBe(true);
    g.toggleFire("u1");
    expect(g.state.firedThisTurn.has("u1")).toBe(false);
  });

  it("toggleFire refuses enemy units", () => {
    const g = setupAtFireDeclare();
    expect(() => g.toggleFire("u2")).toThrow(/cannot act on unit/);
  });

  it("endTurn reveals fired units, advances to next player's Transition, and clears the fire set", () => {
    const g = setupAtFireDeclare();
    g.toggleFire("u1");
    g.endTurn();
    expect(g.state.visionState.revealed.has("u1")).toBe(true);
    expect(g.state.firedThisTurn.size).toBe(0);
    expect(g.state.phase).toBe("Transition");
    expect(g.state.getActivePlayer()).toBe("B");
  });

  it("recentReveals records the units newly revealed by this turn's fire actions", () => {
    const g = setupAtFireDeclare();
    g.toggleFire("u1");
    g.endTurn();
    expect(g.state.recentReveals.added).toContain("u1");
  });
});

describe("Game — end-to-end happy path", () => {
  it("plays one full round and returns control to the first player", () => {
    const g = makeGame();
    // Deployment
    g.deployUnit({ type: "Tank", name: "A1", position: p(0, 0) });
    g.endDeployment();
    g.startTurn();
    g.deployUnit({ type: "Tank", name: "B1", position: p(20, 0) });
    g.endDeployment();
    // A's turn
    g.startTurn();
    expect(g.state.turnNumber).toBe(1);
    expect(g.state.getActivePlayer()).toBe("A");
    g.moveUnit("u1", p(5, 0));
    g.endMove();
    g.endTurn();
    // B's turn
    g.startTurn();
    expect(g.state.turnNumber).toBe(2);
    expect(g.state.getActivePlayer()).toBe("B");
    g.moveUnit("u2", p(15, 0));
    g.endMove();
    g.endTurn();
    // Back to A
    expect(g.state.phase).toBe("Transition");
    expect(g.state.getActivePlayer()).toBe("A");
  });
});

describe("Game — rules-changed flag", () => {
  it("rulesChangedThisTurn defaults to false on a new game", () => {
    const g = makeGame();
    expect(g.state.rulesChangedThisTurn).toBe(false);
  });

  it("markRulesChanged sets the flag to true", () => {
    const g = makeGame();
    g.markRulesChanged();
    expect(g.state.rulesChangedThisTurn).toBe(true);
  });

  it("markRulesChanged is idempotent", () => {
    const g = makeGame();
    g.markRulesChanged();
    g.markRulesChanged();
    expect(g.state.rulesChangedThisTurn).toBe(true);
  });

  it("startTurn clears the flag (so the next player's turn starts fresh)", () => {
    const g = makeGame();
    g.deployUnit({ type: "Infantry", name: "A1", position: p(10, 10) });
    g.endDeployment();
    g.startTurn();
    g.deployUnit({ type: "Infantry", name: "B1", position: p(20, 20) });
    g.endDeployment();
    g.markRulesChanged();
    expect(g.state.rulesChangedThisTurn).toBe(true);
    g.startTurn();
    expect(g.state.rulesChangedThisTurn).toBe(false);
  });

  it("markRulesChanged works in any phase (Deploy, Move, FireDeclare)", () => {
    const g = makeGame();
    expect(g.state.phase).toBe("Deploy");
    g.markRulesChanged();
    expect(g.state.rulesChangedThisTurn).toBe(true);

    g.deployUnit({ type: "Infantry", name: "A1", position: p(10, 10) });
    g.endDeployment();
    g.startTurn();
    g.deployUnit({ type: "Infantry", name: "B1", position: p(20, 20) });
    g.endDeployment();
    g.startTurn();
    expect(g.state.phase).toBe("Move");
    g.markRulesChanged();
    expect(g.state.rulesChangedThisTurn).toBe(true);

    g.endMove();
    expect(g.state.phase).toBe("FireDeclare");
    g.markRulesChanged();
    expect(g.state.rulesChangedThisTurn).toBe(true);
  });
});

describe("Game — debug-used flag", () => {
  it("debugUsedThisTurn defaults to false on a new game", () => {
    const g = makeGame();
    expect(g.state.debugUsedThisTurn).toBe(false);
  });

  it("markDebugUsed sets the flag to true and is idempotent", () => {
    const g = makeGame();
    g.markDebugUsed();
    g.markDebugUsed();
    expect(g.state.debugUsedThisTurn).toBe(true);
  });

  it("startTurn clears both cross-turn flags", () => {
    const g = makeGame();
    g.deployUnit({ type: "Infantry", name: "A1", position: p(10, 10) });
    g.endDeployment();
    g.startTurn();
    g.deployUnit({ type: "Infantry", name: "B1", position: p(20, 20) });
    g.endDeployment();
    g.markDebugUsed();
    g.markRulesChanged();
    expect(g.state.debugUsedThisTurn).toBe(true);
    expect(g.state.rulesChangedThisTurn).toBe(true);
    g.startTurn();
    expect(g.state.debugUsedThisTurn).toBe(false);
    expect(g.state.rulesChangedThisTurn).toBe(false);
  });
});
