# Requirements — WarGaming Fog of War App

**Status:** Draft  
**Last Updated:** 2026-05-09  
**Author:** Ryan

---

## 1. Overview

A companion web app for physical tabletop war games that adds fog of war as a managed mechanic. Two players use the app alongside their physical table — the app tracks unit positions, calculates visibility, and tells players which units to place or remove from the table each turn.

The physical game uses tape-measure distances, so the app uses freeform (x, y) coordinates in inches to match.

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
| `Unit` | Type, stats, position, recon flag, dug-in state |
| `TerrainPolygon` | Area terrain geometry and type |
| `TerrainWall` | Wall line segment and type (short/tall) |
| `GameMap` | All terrain; exposes ray intersection methods |
| `VisionCalculator` | Given two units and a map, returns spot distance and spotted status |
| `GameState` | All units, map, turn state, spotted set — serializes to JSON |
| `Game` | Orchestrates turn flow and applies rules |

The React + Konva UI layer reads from and writes to these classes. It contains no game logic.

### 2.3 Persistence

Games and maps are saved as JSON files exported from the browser and loaded back in. The JSON schema is designed to be database-ready so saved files can be migrated to a server-backed system without structural changes.

### 2.4 Platform & Controls

Web app, designed for tablet (touch) play at the table and mouse/keyboard on laptop/desktop. All map and unit interactions must work with both input methods.

---

## 3. Game Mechanics

### 3.1 Map

Freeform (no grid). Terrain is represented as:

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

#### Map Setup Workflows

1. **Photo-first:** players photograph the physical table, load the image into the app, then draw terrain polygons and wall segments over the photo.
2. **Draw-first:** players use the in-app drawing tool to create the terrain, then set up the physical table to match.

Both workflows produce the same internal terrain representation.

---

### 3.2 Units

Two unit types: **Infantry** and **Tank**.

#### Properties

- **Name** — player-assigned at unit creation
- **Type** — Infantry or Tank
- **Recon** — optional modifier applied at unit creation
- **Dug In** — Infantry only; toggleable state; persists until the player explicitly clears it

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

#### Spot Distance Formula

```
spot_distance = spotter_vision / target_effective_stealth
```

`target_effective_stealth` = target's base stealth multiplied by the highest single modifier from terrain along the ray or the target's dug-in state (if applicable).

#### Visibility Rules

- Vision is recalculated at the end of each player's move phase
- A unit is **spotted** if it is within spot distance and no fully blocking terrain interrupts the ray
- A spotted unit remains spotted until it moves behind fully blocking terrain — moving out of vision range alone is not enough to become unspotted
- Firing a unit makes it spotted regardless of the vision formula; it remains spotted under the same unspot rules

#### Player-Facing Behavior

- A player never sees unspotted enemy unit positions on the map
- After vision recalculation the app displays "Place on table" for each newly spotted enemy unit and "Remove from table" for each previously spotted enemy unit now obscured by blocking terrain
- The transition screen between turns prevents the incoming player from seeing the outgoing player's map view

---

### 3.4 Turn Structure

#### Deployment Phase (game start)
1. Player 1 deploys all their units (name, type, recon flag, position)
2. Transition screen
3. Player 2 deploys all their units
4. Transition screen
5. Movement turns begin

#### Movement Turn
1. **Transition screen** — neutral screen; active player taps "Start Turn"
2. **Move phase** — active player sees their own units and any currently spotted enemy units. During this phase the player may:
   - Move units freely (trust-based, no move limits enforced by the app)
   - Create new units to represent reserves entering from the board edge or infantry disembarking from transports (same name/type/recon inputs as deployment)
   - Delete their own units to remove those destroyed in combat (each player deletes their own destroyed units on their next turn)
3. **End Move** — player signals movement is complete
4. **Vision calculation** — app recalculates visibility for all units based on final positions
5. **Fire declaration** — active player designates which of their units fired this turn; firing units are immediately marked as spotted
6. **End Turn** — transition screen shown; other player taps "Start Turn"

Players alternate turns indefinitely; the app does not track victory conditions or combat outcomes.

---

## 4. User Interface

| Screen | Purpose |
|---|---|
| Main menu | Start new game, load game |
| Map setup | Photo import or drawing tool for terrain; save/load map |
| Deployment | Each player places and names their units |
| Transition | Neutral screen between turns; shows whose turn is next; single "Start Turn" button |
| Game board | Map with active player's units and spotted enemy units; move controls; end move / fire declaration / end turn flow |
| Spot/unspot notification | Overlay listing units to place or remove from the table |

---

## 5. Out of Scope (v1)

These are features explicitly excluded from v1 to prevent over-engineering. They are *not* anticipated v2 features (see Section 6 for those).

- Combat tracking or outcome enforcement (combat is resolved physically on the table)

---

## 6. Anticipated v2 Features

Features expected in a future version. **The v1 architecture must avoid one-way doors that would block these additions.**

| Feature | One-way doors to avoid in v1 |
|---|---|
| **Server-backed persistence and online multiplayer** | JSON save schema must be database-ready (already required, see 2.3). `GameState` serialization should not embed browser-specific data (file handles, DOM refs). |
| **Mobile native app** | Keep UI responsive from the start. Game logic classes must remain UI-framework-agnostic (already required, see 2.2). |
| **Elevation / height-based vision** | Unit and terrain positions should be modeled so an elevation field can be added without restructuring. `VisionCalculator` should accept the map as input rather than hardcoding flat-plane assumptions. |
| **Glimpse mechanic (mid-move spotting)** | Vision recalculation must be a callable method on `VisionCalculator` / `Game`, not hardcoded to fire only at end-of-turn. The turn flow can call it at one point in v1 without preventing additional call sites later. |
| **More than 2 players** | `GameState` should hold a list/collection of players, not two named fields like `player1` / `player2`. Turn order should be derived from the player collection. |
| **Airplanes** — a new unit type that is always spotted, with its own vision rating and a placeholder stealth value. Placed during the active player's movement phase, removed at end of turn. When placed, the turn pauses and the other player gets a chance to mark any of their units as firing at the airplane (which spots those units), then the turn resumes with the active player. Airplanes also spot enemy units while present. | Unit model must support an "always spotted" flag rather than assuming all units obey the standard fog-of-war rules. Turn flow must support nested/interruptible phases where control briefly passes to the non-active player and returns. Unit collections must support transient units that are added and removed within a single turn. The vision system must treat any unit (including airplanes) as a potential spotter, not just standard ground units. |
| **Mines** — a non-unit map entity placed as a point with a stealth rating and 0" vision. Placeable at deployment or during gameplay. Detected with vision only by units with the **Engineer** or **Recon** modifier (a new unit modifier strictly for mine detection — does not affect vision/stealth). Detection for other units occurs when an any unit attempts to move through a mine and ends its move on top of it; the app then marks the mine as spotted and a physical token is placed on the table (engineers can detect mines by moving into them if they didn't detect them with vision) | Map entity model must support entities that are not units but participate in vision (have stealth) — terrain alone is not enough. Unit modifiers should be a list/collection rather than a fixed set of boolean fields, so adding `Engineer` alongside `Recon` is additive. Movement handling should distinguish "final position" from "path traveled" so future detection-on-path logic can be added. |

---

## 7. Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Visual style of the app | Open |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Spotted | An enemy unit whose position is known and must be represented on the physical table |
| Unspotted | An enemy unit whose position is hidden; must be removed from the physical table |
| Dug In | Infantry state providing a 2x stealth modifier; persists until explicitly cleared |
| Recon | Unit modifier multiplying vision and stealth by 4/3 |
| Blocking terrain | Terrain that fully interrupts a ray (tall wall, building with two wall intersections, tall woods beyond 4") |
| Concealing terrain | Terrain that applies a stealth modifier without fully blocking the ray |
