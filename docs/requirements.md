# Requirements — WarGaming Fog of War App

**Status:** Draft  
**Last Updated:** 2026-05-09  
**Author:** Ryan

---

## 1. Overview

A companion web app for physical tabletop war games that adds fog of war as a managed mechanic. Two players use the app alongside their physical table — the app tracks unit positions, calculates visibility, and tells players which units to place or remove from the table each turn.

The physical game uses tape-measure distances, so the app uses freeform (x, y) coordinates in inches to match.

**Design philosophy:** the app is a vision engine that amplifies tabletop play. It trusts players not to cheat — there is no enforcement of move distances, deployment zones, or other rules that the players manage themselves IRL.

---

## 2. Tech Stack & Architecture

### 2.1 Tech Stack

| Layer | Choice |
|---|---|
| Framework | React + TypeScript |
| Map / Canvas | Konva.js |
| Save format | JSON files |
| Backend (future) | Node.js + PostgreSQL |

### 2.2 Architecture

All core game mechanics are implemented as object-oriented TypeScript classes, independent of the UI layer. This ensures they are unit-testable in isolation and can be extended or refactored without touching the UI.

| Class | Responsibility |
|---|---|
| `Unit` | Type, stats, position, modifier list (Recon, Engineer, …), dug-in state |
| `TerrainPolygon` | Area terrain geometry and type |
| `TerrainWall` | Wall line segment and type (short/tall) |
| `GameMap` | Map dimensions, terrain collection, optional backdrop photo + scale; exposes ray intersection methods |
| `VisionCalculator` | Given a map and unit collections, returns the detection graph and resolves spotted status |
| `GameState` | Map, players, units, turn state, spotted set — serializes to JSON |
| `Game` | Orchestrates turn flow and applies rules |

The React + Konva UI layer reads from and writes to these classes. It contains no game logic.

**Coordinate system:** top-left origin, units in inches. (For future polygon maps, the coordinate system is established by the smallest bounding rectangle of the map polygon.)

### 2.3 Persistence

Two file types, both JSON:

- **Map file** — map dimensions, terrain, optional backdrop photo (embedded as base64) and pixel-to-inch scale
- **Game file** — full game state, including an embedded copy of the map (so a game save is fully self-contained)

Files are exported from the browser and loaded back in. The JSON schema is designed to be database-ready so saved files can be migrated to a server-backed system without structural changes.

### 2.4 Platform & Controls

Web app, designed for tablet (touch) play at the table and mouse/keyboard on laptop/desktop. All map and unit interactions must work with both input methods.

---

## 3. Game Mechanics

### 3.1 Map

A map is a **configurable-size rectangle** (player sets width and height in inches at map creation time). Terrain is represented as:

- **Polygons** — area terrain (forests, hills, building footprints, etc.)
- **Line segments** — walls, with a type of **Short** or **Tall**

#### Terrain Vision Effects

| Terrain | Geometry | Effect |
|---|---|---|
| Tall wall | Line segment | Fully blocks — ray passing over is blocked |
| Building | Polygon | 3x stealth for units inside; fully blocked if ray intersects two edges |
| Tall woods | Polygon | 3x stealth; fully blocked if ray travels more than 4" through the polygon |
| Short terrain (wheat fields, shallow woods, etc.) | Polygon | 2x stealth |
| Short wall | Line segment | 2x stealth |

**Modifier stacking:** only the single highest applicable modifier applies — modifiers do not stack.  
**Partial coverage:** the ray only needs to pass through terrain for the modifier to apply — the unit does not need to be fully inside it.  
**Building edges are not implicitly walls** — the building rule (3x stealth inside, blocked after two edge intersections) is the complete abstraction of windows, doors, damage, and weak construction.

#### Map Setup Workflows

Both workflows produce the same internal terrain representation: a rectangle with polygons and wall segments.

1. **Photo-first** — players photograph the physical table, load the image as a backdrop, set the pixel-to-inch scale by drawing a reference measurement of known length, then annotate terrain features (polygons and walls) on top of the photo.
2. **Draw-first** — players use the in-app drawing tool to create the terrain on a blank rectangle, then set up the physical table to match.

#### Drawing Tool

The drawing tool supports both freeform polygons (point-by-point) and primitive shapes (rectangles); walls are drawn as line segments. Snap-to-grid is supported for precision. Specific drawing UX details may evolve during development.

---

### 3.2 Units

Two unit types: **Infantry** and **Tank**.

A unit's position is a single (x, y) point representing its center. The physical table token represents the unit's actual extent.

#### Properties

- **Name** — player-assigned at unit creation (e.g. "1st Platoon", "76mm M4 tank")
- **Type** — Infantry or Tank
- **Modifiers** — a list of modifiers applied at unit creation (currently: **Recon**)
- **Dug In** — Infantry only; toggleable state
  - Defaults to `true` for infantry created during deployment
  - Defaults to `false` for infantry created mid-game (reserves, disembarking)
  - Persists until the player explicitly clears it

#### Stats

All distances are in inches, matching tape measure distances on the table.

| Type | Base Vision | Base Stealth |
|---|---|---|
| Infantry | 48" | 1.333 (4/3) |
| Tank | 48" | 1 |

**Recon modifier:** multiplies both vision and stealth by 1.333 (4/3).

**Dug-in modifier (Infantry only):** treated as a 2x stealth modifier, pooled with terrain modifiers — only the single highest applies. A dug-in infantry in tall woods (3x) uses 3x.

Stat values are stored in configuration, not hardcoded.

---

### 3.3 Fog of War

The system distinguishes between **detection** (private knowledge in a player's app view) and **spotted status** (public — the unit must be placed on the physical table).

#### Spot Distance Formula

```
spot_distance = spotter_vision / target_effective_stealth
```

`target_effective_stealth` = target's base stealth multiplied by the highest single modifier from terrain along the ray or the target's dug-in state (if applicable).

#### Detection (private)

A unit **detects** an enemy when:
- The enemy is within the unit's spot distance, AND
- No fully blocking terrain interrupts the ray between them

Detection is private: the active player's app shows them all enemies their units detect, even if those enemies are not spotted. This enables ambush — a hidden unit can know an enemy is approaching without revealing itself.

#### Spotted Status (public)

A unit becomes **spotted** (must be placed on the physical table) when any of the following occur during end-of-move recalculation:

1. **Detected by a spotted friendly** — propagates transitively (a unit that becomes spotted via this rule then itself becomes a spotter for further propagation)
2. **Mutual detection** — if an unspotted friendly and an unspotted enemy detect each other, both become spotted
3. **Firing** — declared by the active player at the fire-declaration step; firing units immediately become spotted regardless of the vision formula

#### Unspotting

A spotted unit remains spotted until it moves behind fully blocking terrain. Moving out of detection range alone is not enough to become unspotted.

#### Player-Facing Behavior

- The active player's map view shows their own units, all enemies their units detect, and a clear visual distinction between detected-only and spotted enemies.
- After vision recalculation the app displays **"Place on table"** for each newly spotted enemy unit and **"Remove from table"** for each previously spotted enemy unit now obscured by blocking terrain.
- Detected-only enemies are never instructed to be placed on the table (that would reveal the position of the detecting unit).
- The transition screen between turns prevents the incoming player from seeing the outgoing player's map view.

---

### 3.4 Turn Structure

#### Deployment Phase (game start)
1. Player 1 deploys all their units (name, type, modifiers, position; infantry default dug-in)
2. Transition screen
3. Player 2 deploys all their units
4. Transition screen
5. Movement turns begin

Deployment zones are managed by the players IRL; the app allows placement anywhere on the map.

#### Movement Turn
Player 1 takes the first movement turn after deployment; players then alternate.

1. **Transition screen** — neutral screen; active player taps "Start Turn"
2. **Move phase** — active player sees their own units and all detected enemy units. During this phase the player may:
   - Move units freely (trust-based, no move limits enforced by the app)
   - Create new units to represent reserves entering from the board edge or infantry disembarking from transports (same name/type/modifier inputs as deployment)
   - Delete their own units to remove those destroyed in combat (each player deletes their own destroyed units on their next turn)
3. **End Move** — player signals movement is complete
4. **Vision calculation** — app recalculates detection and spotted status for all units based on final positions
5. **Fire declaration** — active player designates which of their units fired this turn; firing units are immediately marked as spotted
6. **End Turn** — transition screen shown; other player taps "Start Turn"

The app does not track victory conditions or combat outcomes.

---

## 4. User Interface

### 4.1 Screens

| Screen | Purpose |
|---|---|
| Main menu | Start new game (create new map or load map file), load saved game |
| Map setup | Photo import + calibration, or drawing tool for terrain; save/load map files |
| Deployment | Each player places and names their units |
| Transition | Neutral screen between turns; shows whose turn is next; single "Start Turn" button |
| Game board | Map with active player's units, detected enemy units, and spotted status indicators; move controls; end move / fire declaration / end turn flow |
| Spot/unspot notification | Overlay listing units to place or remove from the table |

### 4.2 Unit Visuals

Units are displayed using **NATO military symbols** (chosen by unit type) with a **player-set name tag** below.

Color is relative to the active player:
- **Black** = friendly (active player's units)
- **Red** = enemy

The same physical unit will appear black to its owner and red to the opponent.

---

## 5. Out of Scope (v1)

- Combat tracking or outcome enforcement (combat is resolved physically on the table)

---

## 6. Anticipated v2 Features

Features expected in a future version. **The v1 architecture must avoid one-way doors that would block these additions.**

| Feature | One-way doors to avoid in v1 |
|---|---|
| **Server-backed persistence and online multiplayer** | JSON save schema must be database-ready (already required, see 2.3). `GameState` serialization should not embed browser-specific data (file handles, DOM refs). |
| **Mobile native app** | Keep UI responsive from the start. Game logic classes must remain UI-framework-agnostic (already required, see 2.2). |
| **Polygon map shapes** (currently rectangles only) | `GameMap` should treat the playable area as a shape, not assume rectangular bounds in geometry checks. The coordinate system already specifies bounding-rect-derived coordinates so polygon maps slot in cleanly. |
| **Elevation / height-based vision** | Unit and terrain positions should be modeled so an elevation field can be added without restructuring. `VisionCalculator` should accept the map as input rather than hardcoding flat-plane assumptions. |
| **Unit footprints (e.g. 9-point square arrays instead of single points)** | Don't hardcode `unit.x, unit.y` access throughout the codebase — wrap unit position access so the underlying representation can change to a shape later. |
| **Glimpse mechanic (mid-move spotting)** | Vision recalculation must be a callable method on `VisionCalculator` / `Game`, not hardcoded to fire only at end-of-turn. The turn flow can call it at one point in v1 without preventing additional call sites later. |
| **More than 2 players** | `GameState` should hold a list/collection of players, not two named fields like `player1` / `player2`. Turn order should be derived from the player collection. |
| **Airplanes** — a new unit type that is always spotted, with its own vision rating and a placeholder stealth value. Placed during the active player's movement phase, removed at end of turn. When placed, the turn pauses and the other player gets a chance to mark any of their units as firing at the airplane (which spots those units), then the turn resumes with the active player. Airplanes also spot enemy units while present. | Unit model must support an "always spotted" flag rather than assuming all units obey the standard fog-of-war rules. Turn flow must support nested/interruptible phases where control briefly passes to the non-active player and returns. Unit collections must support transient units that are added and removed within a single turn. The vision system must treat any unit (including airplanes) as a potential spotter. |
| **Mines and the Engineer modifier** — mines are non-unit map entities placed as points with a stealth rating and 0" vision. Placeable at deployment or during gameplay. **All non-airplane units** spot a mine when they move over it and end on top of it (the app marks the mine spotted and a token is placed on the table). Additionally, units with the **Recon** or **Engineer** modifier (Engineer is a new modifier strictly for mine detection — does not affect vision/stealth) detect mines via normal end-of-movement vision checks. | Map entity model must support entities that are not units but participate in vision (have stealth) — terrain alone is not enough. Unit modifiers should be a list/collection rather than a fixed set of boolean fields, so adding `Engineer` alongside `Recon` is additive. Movement handling should distinguish "final position" from "path traveled" so future detection-on-path logic can be added. |

---

## 7. Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Visual style of the app (beyond NATO symbols) | Open |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Detected | An enemy unit that a friendly unit can see (private knowledge — appears in the detecting player's app view but not necessarily on the table) |
| Spotted | An enemy unit whose position is publicly known and must be represented on the physical table |
| Mutual detection | Two units (one from each player) that detect each other simultaneously — causes both to become spotted |
| Dug In | Infantry state providing a 2x stealth modifier; persists until explicitly cleared |
| Recon | Unit modifier multiplying vision and stealth by 4/3 |
| Blocking terrain | Terrain that fully interrupts a ray (tall wall, building with two wall intersections, tall woods beyond 4") |
| Concealing terrain | Terrain that applies a stealth modifier without fully blocking the ray |
