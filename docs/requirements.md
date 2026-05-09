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
- [ ] Web browser
- [ ] Windows desktop
- [ ] Mac desktop
- [ ] Mobile (iOS / Android)

> Platform not yet decided — see Open Questions.

### 3.3 Persistence
- [ ] No save — session only
- [ ] Local save files
- [ ] Cloud saves / account system

> Persistence not yet decided — see Open Questions.

---

## 4. Core Features

- Freeform map setup via photo import (mark terrain over photo) or in-app drawing (build terrain, then set up table to match)
- Unit placement, naming, and management per player
- Per-turn fog of war calculation with spot/unspot notifications
- Hotseat turn flow with transition screen between players
- Firing declaration that forces unit visibility

---

## 5. Game Mechanics

### 5.1 Map / Board

The map is freeform (no grid). Terrain is represented as:

- **Polygons** — area terrain (forests, hills, building footprints, water, etc.)
- **Line segments** — walls, with a type of **Short** or **High**

#### Terrain Vision Effects

| Terrain | Effect |
|---|---|
| High wall | Fully blocks line of sight (one wall = blocked) |
| Building | Two walls along a ray = fully blocked; units *inside* get a stealth modifier |
| Short wall | Stealth modifier (concealment, does not fully block) |
| Area terrain (forest, etc.) | Stealth modifier |

**Modifier stacking:** only the single highest modifier applies — modifiers do not stack.  
**Partial coverage:** the ray only needs to pass through terrain for the modifier to apply — the unit does not need to be fully inside it.

#### Map Setup Workflows

1. **Photo-first:** players photograph the physical table, load the image into the app, then use a drawing tool to mark terrain polygons and wall segments over the photo.
2. **Draw-first:** players use the in-app drawing tool to create the terrain, then set up the physical table to match.

Both workflows produce the same internal terrain representation.

---

### 5.2 Units

#### Unit Types (v1)

| Type | Notes |
|---|---|
| Infantry | Can dig in for a stealth bonus |
| Tank | |

#### Unit Properties

- **Name** — player-assigned at deployment
- **Type** — Infantry or Tank
- **Recon** — optional modifier, gives a fixed vision bonus
- **Dug In** — Infantry only; toggleable state, provides a fixed stealth bonus; persists until the player explicitly clears it

#### Stats

Base vision and stealth values are fixed per unit type. The recon bonus and dug-in bonus are fixed values. Exact values to be decided during implementation and stored in configuration (not hardcoded).

#### Deployment

During the deployment phase, each player creates their units by specifying name, type, and placing them on the map. Deployment happens before the first movement turn.

---

### 5.3 Turn Structure

#### Deployment Phase (game start)
1. Player 1 deploys all their units (name, type, position on map)
2. Transition screen
3. Player 2 deploys all their units
4. Transition screen
5. Movement turns begin

#### Movement Turn
1. **Transition screen** — neutral screen shown between turns; active player clicks "Start Turn"
2. **Move phase** — active player sees their own units and any currently spotted enemy units; moves units freely (trust-based, no move limits enforced by the app)
3. **End Move** — player signals movement is complete
4. **Vision calculation** — app recalculates visibility for all units based on final positions
5. **Fire declaration** — active player designates which of their units fired this turn; firing units are immediately marked as spotted
6. **End Turn** — transition screen is shown; other player clicks "Start Turn"

Players alternate turns indefinitely until the game ends (no victory condition tracked by the app in v1).

---

### 5.4 Combat

Combat is resolved physically on the table — the app does not enforce or track combat outcomes in v1.

---

### 5.5 Fog of War

#### Spot Distance Formula

```
spot_distance = spotter_vision / target_effective_stealth
```

`target_effective_stealth` = target's base stealth, modified by the highest single terrain modifier along the line of sight ray (if any).

#### Visibility Rules

- Vision is recalculated at the end of each player's move phase (not in real-time during movement)
- A unit is **spotted** if it is within spot distance and no fully blocking terrain interrupts the ray
- A unit that is spotted remains spotted until it moves behind fully blocking terrain (high wall or building wall) — moving out of vision range alone is not enough to become unspotted
- Firing a unit makes it spotted regardless of vision formula; it remains spotted under the same unspot rules above

#### App Notifications

After vision recalculation the app displays:
- **"Place on table"** — for each enemy unit newly spotted this turn
- **"Remove from table"** — for each previously spotted enemy unit that is now obscured by blocking terrain

#### Hidden Information

- A player never sees enemy unit positions on the map unless those units are currently spotted
- The transition screen between turns prevents the incoming player from seeing the outgoing player's map view

---

### 5.6 Victory Conditions

Victory conditions are not tracked by the app — players determine the winner by their physical game's rules.

---

### 5.7 Other Mechanics

None for v1.

---

## 6. User Interface

### 6.1 Views / Screens

- **Main menu** — start new game, load game
- **Map setup** — photo import or drawing tool for terrain
- **Deployment screen** — each player places and names their units
- **Transition screen** — neutral screen between turns; shows whose turn is next; single "Start Turn" button
- **Game board (active turn)** — map showing active player's units and spotted enemy units; move controls; end move / fire declaration / end turn flow
- **Spot/unspot notification** — overlay or panel listing units to place or remove from the table

### 6.2 Controls

> Not yet decided — see Open Questions (touch vs. mouse/keyboard).

### 6.3 Visual Style

> Not yet decided.

---

## 7. Data & Content

### 7.1 Scenarios / Maps

Maps are user-created per session (photo-first or draw-first). No pre-built scenarios in v1.

### 7.2 Unit Rosters

Unit types (Infantry, Tank) are predefined. Players name and place individual units per game.

### 7.3 Replays & History

Not in scope for v1.

---

## 8. Out of Scope (v1)

- Elevation / height-based vision
- Glimpse mechanic (briefly seeing a unit as it moves between cover mid-turn)
- More than 2 players
- Online / async multiplayer
- AI opponent
- Combat tracking or outcome enforcement
- Victory condition tracking
- Replays

---

## 9. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Target platform (web, desktop, mobile)? | Ryan | Open |
| 2 | Persistence — save games needed for v1? | Ryan | Open |
| 3 | Controls — touch-first or mouse/keyboard? | Ryan | Open |
| 4 | Exact values for unit vision, stealth, recon bonus, dug-in bonus | Ryan | Open |
| 5 | Visual style of the app | Ryan | Open |

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| Spotted | An enemy unit whose position is known and must be represented on the physical table |
| Unspotted | An enemy unit whose position is hidden; must be removed from the physical table |
| Dug In | Infantry state providing a stealth bonus; persists until explicitly cleared by the player |
| Recon | Unit modifier granting a fixed bonus to vision distance |
| Ray | A straight line between two units used to calculate line of sight |
| Blocking terrain | Terrain that fully interrupts a ray (high wall, building — two walls) |
| Concealing terrain | Terrain that modifies a unit's effective stealth without fully blocking the ray |
