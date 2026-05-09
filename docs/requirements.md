# Requirements — WarGaming Fog of War App

**Status:** Draft  
**Last Updated:** 2026-05-09  
**Author:** Ryan

---

## 1. Overview

A companion app for physical tabletop war games that adds fog of war as a managed mechanic. Two players use the app alongside their physical table — the app tracks unit positions, calculates visibility, and tells players which units to place or remove from the table each turn.

---

## 2. Game Concept

### 2.1 Genre & Inspiration
Tabletop war game companion app. The physical game uses tape-measure distances (not a grid), so the app uses freeform (x, y) coordinates to match.

### 2.2 Setting & Theme
System-agnostic for v1 — not tied to a specific historical period or ruleset.

### 2.3 Scale
Each unit represents an individual vehicle or infantry element. The map represents a tabletop battlefield.

---

## 3. Players & Platform

### 3.1 Players
- [ ] Single player (vs AI)
- [x] Local multiplayer (hotseat — same device)
- [ ] Online multiplayer
- [ ] Play-by-email / async

**Number of players per game:** 2

### 3.2 Target Platform
- [x] Web browser (primary)
- [ ] Windows desktop
- [ ] Mac desktop
- [ ] Mobile (iOS / Android)

Developed as a web app. Designed to work on tablet (touch) for play at the table, and mouse/keyboard on laptop/desktop for development and general use. Mobile native app is a future consideration — the web app should be responsive enough to support it.

### 3.3 Persistence
- [ ] No save — session only
- [x] Local save files (v1)
- [ ] Cloud saves / account system (future)

Games and maps are saved as JSON files exported from the browser and loaded back in. The JSON schema is designed to be database-ready so v1 files can be migrated to a server without structural changes.

---

## 4. Tech Stack & Architecture

### 4.1 Tech Stack

| Layer | Choice |
|---|---|
| Framework | React + TypeScript |
| Map / Canvas | Konva.js |
| Save format | JSON file export/import |
| Backend (future) | Node.js + PostgreSQL |

### 4.2 Architecture

All core game mechanics are implemented as object-oriented TypeScript classes, independent of the UI layer. This ensures they are unit-testable in isolation and can be extended or refactored without touching the UI.

**Core classes (approximate):**

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

---

## 5. Core Features

- Freeform map setup via photo import (mark terrain over photo) or in-app drawing (build terrain, then set up table to match)
- Unit placement, naming, and management per player
- Per-turn fog of war calculation with spot/unspot notifications
- Hotseat turn flow with transition screen between players
- Firing declaration that forces unit visibility
- Save and load games and maps as JSON files

---

## 6. Game Mechanics

### 6.1 Map / Board

The map is freeform (no grid). Terrain is represented as:

- **Polygons** — area terrain (forests, hills, building footprints, etc.)
- **Line segments** — walls, with a type of **Short** or **Tall**

#### Terrain Vision Effects

| Terrain | Type | Effect |
|---|---|---|
| Tall wall | Line segment | Fully blocks — ray passing over is blocked |
| Building | Polygon | 3x stealth for units inside; fully blocked if ray intersects two edges |
| Tall woods | Polygon | 3x stealth; fully blocked if ray travels more than 4" through the polygon |
| Short terrain (wheat fields, shallow woods, etc.) | Polygon | 2x stealth |
| Short wall | Line segment | 2x stealth |

**Modifier stacking:** only the single highest modifier applies — modifiers do not stack.  
**Partial coverage:** the ray only needs to pass through terrain for the modifier to apply — the unit does not need to be fully inside it.

#### Map Setup Workflows

1. **Photo-first:** players photograph the physical table, load the image into the app, then use a drawing tool to mark terrain polygons and wall segments over the photo.
2. **Draw-first:** players use the in-app drawing tool to create the terrain, then set up the physical table to match.

Both workflows produce the same internal terrain representation.

---

### 6.2 Units

#### Unit Types (v1)

| Type | Notes |
|---|---|
| Infantry | Can dig in for a stealth bonus |
| Tank | |

#### Unit Properties

- **Name** — player-assigned at deployment
- **Type** — Infantry or Tank
- **Recon** — optional modifier applied at unit creation
- **Dug In** — Infantry only; toggleable state; persists until the player explicitly clears it

#### Stats

All distances are in inches, matching physical tape measure distances on the table.

| Type | Base Vision | Base Stealth |
|---|---|---|
| Infantry | 48" | 1.333 (4/3) |
| Tank | 48" | 1 |

**Recon modifier:** multiplies both vision and stealth by 1.333 (4/3).

**Dug-in modifier (Infantry only):** treated as a 2x stealth modifier, pooled with terrain modifiers — the highest single modifier applies. A dug-in infantry in tall woods (3x) uses the 3x modifier.

Values are stored in configuration, not hardcoded.

#### Deployment

During the deployment phase, each player creates their units by specifying name, type, recon flag, and placing them on the map. Deployment happens before the first movement turn.

---

### 6.3 Turn Structure

#### Deployment Phase (game start)
1. Player 1 deploys all their units (name, type, recon flag, position on map)
2. Transition screen
3. Player 2 deploys all their units
4. Transition screen
5. Movement turns begin

#### Movement Turn
1. **Transition screen** — neutral screen; active player clicks "Start Turn"
2. **Move phase** — active player sees their own units and any currently spotted enemy units; moves units freely (trust-based, no move limits enforced by the app)
3. **End Move** — player signals movement is complete
4. **Vision calculation** — app recalculates visibility for all units based on final positions
5. **Fire declaration** — active player designates which of their units fired this turn; firing units are immediately marked as spotted
6. **End Turn** — transition screen shown; other player clicks "Start Turn"

Players alternate turns indefinitely until the game ends (no victory condition tracked by the app in v1).

---

### 6.4 Fog of War

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

#### App Notifications

After vision recalculation the app displays:
- **"Place on table"** — for each enemy unit newly spotted this turn
- **"Remove from table"** — for each previously spotted enemy unit now obscured by blocking terrain

#### Hidden Information

- A player never sees unspotted enemy unit positions on the map
- The transition screen between turns prevents the incoming player from seeing the outgoing player's map view

---

### 6.5 Combat

Combat is resolved physically on the table — the app does not enforce or track combat outcomes in v1.

---

## 7. User Interface

### 7.1 Views / Screens

- **Main menu** — start new game, load game
- **Map setup** — photo import or drawing tool for terrain; save/load map
- **Deployment screen** — each player places and names their units
- **Transition screen** — neutral screen between turns; shows whose turn is next; single "Start Turn" button
- **Game board (active turn)** — map showing active player's units and spotted enemy units; move controls; end move / fire declaration / end turn flow
- **Spot/unspot notification** — overlay or panel listing units to place or remove from the table

### 7.2 Controls

Supports both touch (tablet) and mouse/keyboard (laptop/desktop). All map and unit interactions must work with both input methods.

### 7.3 Visual Style

> Not yet decided.

---

## 8. Data & Content

### 8.1 Scenarios / Maps

Maps are user-created (photo-first or draw-first) and saved as JSON files. No pre-built scenarios in v1.

### 8.2 Unit Rosters

Unit types (Infantry, Tank) are predefined. Players name and place individual units per game.

---

## 9. Out of Scope (v1)

- Elevation / height-based vision
- Glimpse mechanic (briefly seeing a unit as it moves between cover mid-turn)
- More than 2 players
- Online / async multiplayer
- AI opponent
- Combat tracking or outcome enforcement
- Victory condition tracking
- Replays

---

## 10. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Target platform (web, desktop, mobile)? | Ryan | Resolved — web app, touch + mouse/keyboard |
| 2 | Persistence — save games needed for v1? | Ryan | Resolved — JSON file export/import, schema designed for future DB migration |
| 3 | Controls — touch-first or mouse/keyboard? | Ryan | Resolved — both, touch for tablet play, mouse/keyboard for development |
| 4 | Exact values for unit vision, stealth, recon bonus, dug-in bonus | Ryan | Resolved — see Section 6.2 Stats |
| 5 | Visual style of the app | Ryan | Open |

---

## 11. Glossary

| Term | Definition |
|------|-----------|
| Spotted | An enemy unit whose position is known and must be represented on the physical table |
| Unspotted | An enemy unit whose position is hidden; must be removed from the physical table |
| Dug In | Infantry state providing a 2x stealth modifier; persists until explicitly cleared by the player |
| Recon | Unit modifier multiplying vision and stealth by 4/3 |
| Ray | A straight line between two units used to calculate line of sight |
| Blocking terrain | Terrain that fully interrupts a ray (tall wall, building — two wall intersections, tall woods beyond 4") |
| Concealing terrain | Terrain that applies a stealth modifier without fully blocking the ray |
