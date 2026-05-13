import { GameMap } from "../core/map/GameMap.js";
import { TerrainPolygon } from "../core/map/TerrainPolygon.js";
import { TerrainWall } from "../core/map/TerrainWall.js";
import { useGame } from "./hooks/useGame.js";
import { GameProvider, useGameContext } from "./hooks/useGameContext.js";
import { SelectionProvider } from "./hooks/useSelectionContext.js";
import { theme } from "./theme.js";
import { DeploymentView } from "./views/DeploymentView.js";
import { FireDeclareView } from "./views/FireDeclareView.js";
import { MoveView } from "./views/MoveView.js";
import { TransitionView } from "./views/TransitionView.js";

function buildDemoMap(): GameMap {
  return new GameMap({
    width: 96,
    height: 60,
    polygons: [
      new TerrainPolygon({
        id: "b1",
        terrainType: "Building",
        vertices: [
          { x: 30, y: 12 }, { x: 42, y: 12 }, { x: 42, y: 22 }, { x: 30, y: 22 },
        ],
      }),
      new TerrainPolygon({
        id: "tw1",
        terrainType: "TallWoods",
        vertices: [
          { x: 55, y: 30 }, { x: 75, y: 28 }, { x: 78, y: 45 }, { x: 60, y: 48 },
        ],
      }),
      new TerrainPolygon({
        id: "st1",
        terrainType: "ShortTerrain",
        vertices: [
          { x: 6, y: 38 }, { x: 28, y: 36 }, { x: 30, y: 52 }, { x: 8, y: 54 },
        ],
      }),
    ],
    walls: [
      new TerrainWall({
        id: "wt1",
        from: { x: 48, y: 4 }, to: { x: 48, y: 18 },
        wallType: "Tall",
      }),
      new TerrainWall({
        id: "ws1",
        from: { x: 14, y: 14 }, to: { x: 26, y: 14 },
        wallType: "Short",
      }),
    ],
  });
}

export function App() {
  const { game, dispatch, reset } = useGame(() => ({
    map: buildDemoMap(),
    players: ["A", "B"],
  }));

  return (
    <GameProvider value={{ game, dispatch, reset }}>
      <SelectionProvider>
        <Header />
        <PhaseRouter />
        <RestartButton />
      </SelectionProvider>
    </GameProvider>
  );
}

function RestartButton() {
  const { reset } = useGameContext();
  const handleClick = () => {
    if (window.confirm("Restart game? All units and turn progress will be lost.")) {
      reset();
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        position: "fixed",
        bottom: theme.spacing.lg,
        left: theme.spacing.lg,
        padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
        background: "rgba(255,255,255,0.92)",
        color: theme.colors.text,
        border: `1px solid ${theme.colors.sidebarBorder}`,
        borderRadius: theme.radius.sm,
        fontSize: theme.fontSize.sm,
        cursor: "pointer",
        zIndex: 1000,
      }}
    >
      Restart game
    </button>
  );
}

function Header() {
  const { game } = useGameContext();
  const { phase, turnNumber } = game.state;
  const active = game.state.getActivePlayer();
  return (
    <header
      style={{
        padding: `${theme.spacing.md}px ${theme.spacing.xl}px`,
        background: theme.colors.headerBg,
        color: theme.colors.headerText,
        display: "flex",
        alignItems: "center",
        gap: theme.spacing.xl,
        fontSize: theme.fontSize.base,
      }}
    >
      <strong>WarGaming Fog of War</strong>
      <span style={{ opacity: 0.6 }}>·</span>
      <span>Phase: <strong>{phase}</strong></span>
      <span style={{ opacity: 0.6 }}>·</span>
      <span>Active: <strong>Team {active}</strong></span>
      {turnNumber > 0 && (
        <>
          <span style={{ opacity: 0.6 }}>·</span>
          <span>Turn <strong>{turnNumber}</strong></span>
        </>
      )}
    </header>
  );
}

function PhaseRouter() {
  const { game } = useGameContext();
  switch (game.state.phase) {
    case "Deploy":
      return <DeploymentView />;
    case "Transition":
      return <TransitionView />;
    case "Move":
      return <MoveView />;
    case "FireDeclare":
      return <FireDeclareView />;
  }
}
