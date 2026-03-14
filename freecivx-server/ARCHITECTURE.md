# Freecivx Java Server — Architecture & Source Code Reference

> **Purpose:** This document describes the structure, Java source files, protocol design, and
> future development plans for `freecivx-server`. It is intended to accelerate onboarding and
> future development tasks.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Directory Layout](#2-directory-layout)
3. [Build & Run](#3-build--run)
4. [Package & Class Reference](#4-package--class-reference)
   - [net.freecivx.main](#netfreecivxmain)
   - [net.freecivx.server](#netfreecivxserver)
   - [net.freecivx.game](#netfreecivxgame)
   - [net.freecivx.data](#netfreecivxdata)
   - [net.freecivx.log](#netfreecivxlog)
5. [Protocol — Packets](#5-protocol--packets)
6. [Game Lifecycle](#6-game-lifecycle)
7. [Unit Types & Action Flags](#7-unit-types--action-flags)
8. [Ruleset Data](#8-ruleset-data)
9. [Map Generation](#9-map-generation)
10. [Known Limitations & Bugs](#10-known-limitations--bugs)
11. [Future Plans](#11-future-plans)

---

## 1. Overview

`freecivx-server` is a Freeciv-compatible multiplayer game server written in Java 21.  
It communicates with the [FreecivWorld.net](https://FreecivWorld.net) web client over **WebSocket**
using **JSON** packets whose `pid` (packet ID) numbers mirror those of the original C Freeciv server.

The server is designed for long-running, large-scale multiplayer games (MMO-style). Unlike the C
Freeciv server, it never segfaults, uses virtual threads for concurrency, and is significantly
easier to extend.

---

## 2. Directory Layout

```
freecivx-server/
├── ARCHITECTURE.md          ← this file
├── README.md                ← quick-start guide
├── civserver.sh             ← shell script to start the server
├── pom.xml                  ← Maven build descriptor (Java 21, fat-JAR via shade plugin)
└── src/
    ├── main/
    │   ├── java/net/freecivx/
    │   │   ├── main/        ← entry-point, HTTP status, metaserver publishing
    │   │   ├── server/      ← WebSocket server + packet constants
    │   │   ├── game/        ← all game-logic and data-model classes
    │   │   ├── data/        ← ruleset file parser (SectionFile)
    │   │   └── log/         ← logging abstraction
    │   └── resources/
    │       └── english.ruleset   ← example nation ruleset file
    └── test/
        └── java/net/freecivx/
            └── data/
                └── SectionFileTest.java
```

---

## 3. Build & Run

```bash
# Build a self-contained fat JAR
cd freecivx-server
mvn clean package

# Run on the default port (7800 WebSocket, 7801 HTTP status)
java -jar target/freecivx-server-1.0.jar

# Run on a custom port
java -jar target/freecivx-server-1.0.jar 7900
```

**Dependencies** (defined in `pom.xml`):

| Library | Version | Purpose |
|---|---|---|
| `org.json` | 20251224 | JSON serialisation |
| `Java-WebSocket` | 1.6.0 | WebSocket server |
| `httpclient5` | 5.6 | Metaserver HTTP POST |
| `slf4j-simple` | 2.0.17 | Logging |
| `commons-lang3` | 3.20.0 | String utilities (`StringUtils`, `StringEscapeUtils`) |
| `commons-text` | 1.15.0 | HTML escaping |
| `junit-jupiter` | 6.0.1 | Unit tests |
| `mockito-inline` | 5.2.0 | Mocking in tests |

---

## 4. Package & Class Reference

### net.freecivx.main

#### `Main.java`
Entry point. Reads an optional port number from `args[0]` (default: **7800**).  
Starts:
- HTTP status server on `port + 1` (using `HTTPStatusWebHandler`)
- WebSocket game server on `port` (using `CivServer`)
- Metaserver registration via `MetaserverClient`

#### `MetaserverClient.java`
Sends a single HTTP POST to `http://localhost:8080/freeciv-web/meta/metaserver` with the server's
host, port, type (`freecivx`), and a human-readable message. Called once at startup.

#### `HTTPStatusWebHandler.java`
Minimal HTTP handler that serves a plain-text status page on `port + 1`. Useful for health checks.

---

### net.freecivx.server

#### `CivServer.java`
The core WebSocket server. Extends `org.java_websocket.server.WebSocketServer`.

**State:**
- `ConcurrentHashMap<Long, WebSocket> clients` — maps `clientId → socket`
- `AtomicInteger clientIdGenerator` — monotonically increasing client IDs
- `Game game` — the single shared game instance

**WebSocket lifecycle:**

| Callback | Action |
|---|---|
| `onOpen` | Assigns a new `clientId`, stores socket in `clients`, sends welcome message |
| `onClose` | Removes socket from `clients` (player object remains in `game.players`) |
| `onMessage` | Dispatches on `pid` field; see packet handling below |
| `onError` | Logs the exception |
| `onStart` | Logs server ready |

**Incoming packet handling (`onMessage`):**

| Packet (`pid`) | Action |
|---|---|
| `PACKET_SERVER_JOIN_REQ` (4) | Sends `PACKET_SERVER_JOIN_REPLY`, calls `game.addConnection()` + `game.addPlayer()` |
| `PACKET_PLAYER_READY` (11) | Calls `game.startGame()` |
| `PACKET_PLAYER_PHASE_DONE` (52) | Calls `game.turnDone()` |
| `PACKET_UNIT_ORDERS` (73) | Parses order type; calls `game.moveUnit()` for `ORDER_MOVE` and `ORDER_ACTION_MOVE` |
| `PACKET_CITY_NAME_SUGGESTION_REQ` (43) | Returns a hardcoded city name (`"Paris"`) to the requesting client |
| `PACKET_WEB_GOTO_PATH_REQ` (287) | Constructs a `PathFinder`, returns path back to requesting client |
| `PACKET_UNIT_DO_ACTION` (84) | Calls `game.buildCity()` (currently the only implemented action) |
| `PACKET_UNIT_CHANGE_ACTIVITY` (222) | Calls `game.changeUnitActivity()` |
| `PACKET_CHAT_MSG_REQ` (26) | Handles `/start`, `/quit`, `/help` commands; broadcasts chat to all clients |

**Outgoing send helpers** (all send to every connected client unless noted):

| Method | Packet | Notes |
|---|---|---|
| `sendMessageAll(msg)` | PACKET_CHAT_MSG (25) | Broadcast chat / server messages |
| `sendMessage(connId, msg)` | PACKET_CHAT_MSG (25) | Private message to one client |
| `sendBeginTurnAll()` | PACKET_BEGIN_TURN (128) | |
| `sendStartPhaseAll()` | PACKET_START_PHASE (126) | |
| `sendGameInfoAll(year, turn, phase)` | PACKET_GAME_INFO (16) | |
| `sendCalendarInfoAll()` | PACKET_CALENDAR_INFO (255) | Sends AC/BC labels |
| `sendMapInfoAll(x, y)` | PACKET_MAP_INFO (17) | |
| `sendTerrainInfoAll(id, name, gfx)` | PACKET_RULESET_TERRAIN (151) | |
| `sendRulesetCityInfoAll(id, name, rule)` | PACKET_RULESET_CITY (149) | |
| `sendRuleseGovernmentAll(id, …)` | PACKET_RULESET_GOVERNMENT (145) | Missing `reqs` array — see §10 |
| `sendRulesetUnitAll(id, utype)` | PACKET_RULESET_UNIT (140) | |
| `sendRulesetUnitWebAdditionAll(id, utype)` | PACKET_WEB_RULESET_UNIT_ADDITION (260) | Sends `utype_actions` bit-vector |
| `sendUnitAll(unit)` | PACKET_UNIT_SHORT_INFO (64) | |
| `sendUnitRemove(unitId)` | PACKET_UNIT_REMOVE (62) | |
| `sendCityShortInfoAll(…)` | PACKET_CITY_SHORT_INFO (32) | |
| `sendCityInfoAll(…)` | PACKET_CITY_INFO (31) | |
| `sendExtrasInfoAll(id, name)` | PACKET_RULESET_EXTRA (232) | |
| `sendTileInfoAll(tile)` | PACKET_TILE_INFO (15) | |
| `sendConnInfoAll(id, …)` | PACKET_CONN_INFO (115) | |
| `sendPlayerInfoAll(player)` | PACKET_PLAYER_INFO (51) | |
| `sendPlayerInfoAdditionAll(no, income)` | PACKET_WEB_PLAYER_INFO_ADDITION (259) | |
| `sendNationInfoAll(id, …)` | PACKET_RULESET_NATION (148) | |
| `sendTechAll(id, …)` | PACKET_RULESET_TECH (144) | |
| `sendBordersServerSettingsAll()` | PACKET_SERVER_SETTING_CONST (165) + BOOL (166) | |
| `sendRulesetControl(n)` | PACKET_RULESET_CONTROL (155) | Sends `num_impr_types` |
| `sendRulesetBuildingAll(impr)` | PACKET_RULESET_BUILDING (150) | Includes `reqs` array |

**Utility:**
- `binaryStringToJsonArray(String)` — Converts a 120-character `"0"`/`"1"` string into a JSON
  array of bytes (MSB-first). Used to serialise `utype_actions`.

#### `Packets.java`
Constants for all packet IDs used by the server. Each constant is a `public static int`.  
See §5 for the full table.

---

### net.freecivx.game

#### `Game.java`
Central game-state manager. Holds all collections (players, units, cities, tiles, rulesets …).

**Fields:**

| Field | Type | Description |
|---|---|---|
| `year` | `long` | In-game year counter (incremented each turn) |
| `turn` | `long` | Turn counter |
| `phase` | `long` | Phase within turn (not yet used) |
| `gameStarted` | `boolean` | Guard against double-start |
| `map` | `WorldMap` | Map dimensions |
| `players` | `Map<Long, Player>` | keyed by connection ID |
| `units` | `Map<Long, Unit>` | keyed by unit ID |
| `cities` | `Map<Long, City>` | keyed by city ID |
| `techs` | `Map<Long, Technology>` | |
| `improvements` | `Map<Long, Improvement>` | |
| `terrains` | `Map<Long, Terrain>` | |
| `tiles` | `Map<Long, Tile>` | keyed by tile index |
| `governments` | `Map<Long, Government>` | |
| `nations` | `Map<Long, Nation>` | |
| `extras` | `Map<Long, Extra>` | |
| `unitTypes` | `Map<Long, UnitType>` | |
| `cityStyle` | `Map<Long, CityStyle>` | |
| `connections` | `Map<Long, Connection>` | |

**Key methods:**

| Method | Description |
|---|---|
| `initGame()` | Populates all ruleset maps; generates the map via `MapGenerator` |
| `startGame()` | Guards against re-entry; sends all ruleset/map/unit/city packets; emits `BEGIN_TURN` |
| `turnDone()` | Increments `year`/`turn`; broadcasts `GAME_INFO`, `BEGIN_TURN`, `START_PHASE` |
| `moveUnit(id, destTile, dir)` | Updates unit tile & facing; re-broadcasts `UNIT_SHORT_INFO` |
| `changeUnitActivity(id, activity)` | Updates unit activity; re-broadcasts |
| `buildCity(unitId, name, tileId)` | Creates a city, removes the settler unit, updates tile |
| `addPlayer(connId, username, addr)` | Creates `Player`; broadcasts all player info |
| `addConnection(connId, …)` | Creates `Connection` entry |

#### `Player.java`
Data model for a human player.

| Field | Type | Description |
|---|---|---|
| `connectionId` | `long` | Same as the WebSocket client ID |
| `username` | `String` | Display name (HTML-escaped) |
| `address` | `String` | Remote IP |
| `nation` | `int` | Index into `Game.nations` (randomly assigned 0–2) |
| `is_alive` | `boolean` | |
| `real_embassy` | `List<Boolean>` | Diplomatic embassy flags |

`getPlayerNo()` returns `connectionId`.

#### `Connection.java`
Lightweight struct linking a WebSocket connection to a player slot.

| Field | Type | Description |
|---|---|---|
| `id` | `long` | Client/connection ID |
| `username` | `String` | |
| `playerNo` | `long` | Player number (same as connection ID) |
| `ip` | `String` | Remote address |

#### `Unit.java`
A game unit instance.

| Field | Type | Description |
|---|---|---|
| `id` | `long` | Unique unit ID |
| `owner` | `long` | Player connection ID |
| `tile` | `long` | Tile index |
| `type` | `int` | Index into `Game.unitTypes` |
| `facing` | `int` | Direction (0–7, matching 8-direction compass) |
| `veteran` | `int` | Veteran level |
| `hp` | `int` | Current hit points |
| `activity` | `int` | Current activity (0 = idle, etc.) |
| `movesleft` | `int` | Remaining movement points this turn |
| `done_moving` | `boolean` | |
| `transported` | `boolean` | |
| `ssa_controller` | `int` | Short-sighted-AI controller flag |

#### `UnitType.java`
A unit type template (e.g. "Warriors", "Settlers").

| Field | Type | Description |
|---|---|---|
| `name` | `String` | Display name |
| `graphicsStr` | `String` | Sprite key (e.g. `"u.warriors"`) |
| `moveRate` | `int` | Movement points per turn |
| `hp` | `int` | Maximum hit points |
| `veteranLevels` | `int` | Number of veteran levels |
| `helptext` | `String` | In-game help text |
| `attackStrength` | `int` | Attack value |
| `defenseStrength` | `int` | Defense value |
| `utype_actions` | `String` | 120-bit binary string; see §7 |

#### `City.java`
A city owned by a player.

| Field | Type | Description |
|---|---|---|
| `name` | `String` | City name |
| `owner` | `long` | Player connection ID |
| `tile` | `long` | Tile index of city centre |
| `size` | `int` | Population size |
| `style` | `int` | City style index |
| `capital` | `boolean` | |
| `occupied` | `boolean` | |
| `walls` | `int` | Wall level |
| `happy` / `unhappy` | `boolean` | Happiness status |
| `improvements` | `String` | **FIXME**: should be `int[]` or `JSONArray` |
| `productionKind` | `int` | 6 = building |
| `productionValue` | `int` | Improvement ID being built |

#### `Tile.java`
A single map tile.

| Field | Type | Description |
|---|---|---|
| `index` | `long` | Linear index: `y * xsize + x` |
| `known` | `int` | Visibility bitmask |
| `terrain` | `int` | Terrain type ID |
| `resource` | `int` | Resource type ID (0 = none) |
| `extras` | `int` | Bitmask of extra types (roads, mines, huts …) |
| `height` | `int` | Elevation (used by 3-D renderer) |
| `worked` | `long` | City ID working this tile (-1 if none) |

Helper methods: `getX(mapWidth)`, `getY(mapWidth)`.

#### `WorldMap.java`
Simple struct holding `xsize` and `ysize` of the map (currently 45 × 45).

#### `MapGenerator.java`
Procedurally generates a map using Perlin-noise-style height interpolation.

- Terrain is assigned based on elevation thresholds (ocean → coast → plains → grassland → hills →
  mountains) and latitude (tundra near poles, desert in dry zones, swamp/jungle in humid zones).
- Resources are sprinkled at ~15 % probability on land tiles.
- Huts (extras bit `EXTRA_BIT_HUT = 8`) appear at ~3 % probability.
- Returns `Map<Long, Tile>`.

#### `PathFinder.java`
Computes a straight-line path from a unit's current tile to a destination tile.

- Direction vectors: `DIR_DX[]`, `DIR_DY[]` — 8-directional (NW, N, NE, W, E, SW, S, SE).
- `processMove(JSONObject)` — reads `unit_id` and `goal` from the `PACKET_WEB_GOTO_PATH_REQ`
  packet, computes a direction list, and returns a `PACKET_WEB_GOTO_PATH` response.
- **Limitation**: no terrain cost or movement-point awareness; paths may walk through ocean.

#### `Technology.java`
Holds `name`, `graphicsStr`, `helptext` for a technology entry.

#### `Government.java`
Holds `name`, `ruleName`, `helptext`. Currently missing `reqs` array (see §10).

#### `Nation.java`
Holds `name`, `adjective`, `graphicsStr`, `legend` for a nation entry.

#### `Terrain.java`
Holds `name`, `graphicsStr` for a terrain type.

#### `Extra.java`
Holds a single `name` string for an extra type (road, mine, river, etc.).

#### `Improvement.java`
City building type.

| Field | Type | Description |
|---|---|---|
| `id` | `long` | |
| `name` | `String` | Display name |
| `ruleName` | `String` | Internal rule name |
| `graphicStr` | `String` | e.g. `"b.barracks"` |
| `graphicAlt` | `String` | Fallback graphic |
| `genus` | `int` | 0=GreatWonder, 1=SmallWonder, 2=Improvement, 3=Special |
| `buildCost` | `int` | Production cost |
| `upkeep` | `int` | Per-turn gold cost |
| `sabotage` | `int` | |
| `soundtag` / `soundtagAlt` | `String` | Sound keys |
| `helptext` | `String` | |
| `techReqId` | `long` | Required tech ID (-1 = none) |

#### `CityStyle.java`
Holds a `name` string for a city style (European, Classical, Tropical, Asian).

---

### net.freecivx.data

#### `SectionFile.java`
Parser for Freeciv-format `.ruleset` files (key=value, `[section]` headings, `;` comments).  
Used to load nation rulesets.  
`fromInputStream(InputStream, sectionName, onlySection)` returns a `SectionFile` whose
`getSections()` returns a `List<Section>`.

#### `Section.java`
Represents one `[section]` block from a ruleset file.  
Holds a `Map<String, String>` of key-value pairs.

---

### net.freecivx.log

#### `GameLogger.java`
Interface: `void log(String message)`.

#### `StdoutLogger.java`
Implements `GameLogger` by writing to `System.out`.

---

## 5. Protocol — Packets

All packets are JSON objects with a required `"pid"` integer field.  
The values below match the constants in `Packets.java` and are wire-compatible with the
FreecivWorld web client.

| Constant | ID | Direction | Description |
|---|---|---|---|
| `PACKET_SERVER_JOIN_REQ` | 4 | C→S | Client requests to join |
| `PACKET_SERVER_JOIN_REPLY` | 5 | S→C | Server accepts join, sends `conn_id` |
| `PACKET_PLAYER_READY` | 11 | C→S | Client is ready to start |
| `PACKET_TILE_INFO` | 15 | S→C | Single tile state |
| `PACKET_GAME_INFO` | 16 | S→C | Year, turn, phase |
| `PACKET_MAP_INFO` | 17 | S→C | Map dimensions |
| `PACKET_CHAT_MSG` | 25 | S→C | Server → client chat / notification |
| `PACKET_CHAT_MSG_REQ` | 26 | C→S | Client chat message or `/command` |
| `PACKET_CITY_INFO` | 31 | S→C | Full city data |
| `PACKET_CITY_SHORT_INFO` | 32 | S→C | Abbreviated city data |
| `PACKET_CITY_NAME_SUGGESTION_REQ` | 43 | C→S | Ask server for a city name |
| `PACKET_CITY_NAME_SUGGESTION_INFO` | 44 | S→C | Suggested city name |
| `PACKET_PLAYER_INFO` | 51 | S→C | Full player data |
| `PACKET_PLAYER_PHASE_DONE` | 52 | C→S | Client ends their turn |
| `PACKET_PLAYER_RATES` | 53 | S→C | Tax/science/luxury rates |
| `PACKET_RESEARCH_INFO` | 60 | S→C | Research progress |
| `PACKET_UNIT_REMOVE` | 62 | S→C | Remove a unit |
| `PACKET_UNIT_INFO` | 63 | S→C | Full unit data |
| `PACKET_UNIT_SHORT_INFO` | 64 | S→C | Abbreviated unit data |
| `PACKET_UNIT_ORDERS` | 73 | C→S | Move / goto orders |
| `PACKET_UNIT_DO_ACTION` | 84 | C→S | Perform a unit action (e.g. build city) |
| `PACKET_CONN_PING` | 88 | S→C | Keepalive ping |
| `PACKET_CONN_PONG` | 89 | C→S | Keepalive pong |
| `PACKET_CONN_INFO` | 115 | S→C | Connection metadata |
| `PACKET_START_PHASE` | 126 | S→C | Begin a turn phase |
| `PACKET_BEGIN_TURN` | 128 | S→C | New turn starts |
| `PACKET_END_TURN` | 129 | S→C | Turn ends |
| `PACKET_RULESET_UNIT` | 140 | S→C | Unit type ruleset entry |
| `PACKET_RULESET_GAME` | 141 | S→C | Global game settings |
| `PACKET_RULESET_TECH` | 144 | S→C | Technology definition |
| `PACKET_RULESET_GOVERNMENT` | 145 | S→C | Government definition |
| `PACKET_RULESET_NATION` | 148 | S→C | Nation definition |
| `PACKET_RULESET_CITY` | 149 | S→C | City style definition |
| `PACKET_RULESET_BUILDING` | 150 | S→C | Building/improvement definition |
| `PACKET_RULESET_TERRAIN` | 151 | S→C | Terrain type definition |
| `PACKET_RULESET_CONTROL` | 155 | S→C | Ruleset metadata (num improvements) |
| `PACKET_SERVER_SETTING_CONST` | 165 | S→C | Named server setting |
| `PACKET_SERVER_SETTING_BOOL` | 166 | S→C | Boolean server setting |
| `PACKET_UNIT_CHANGE_ACTIVITY` | 222 | C→S | Change unit activity |
| `PACKET_RULESET_EXTRA` | 232 | S→C | Extra type definition |
| `PACKET_CALENDAR_INFO` | 255 | S→C | Year label strings (AC/BC) |
| `PACKET_WEB_PLAYER_INFO_ADDITION` | 259 | S→C | Extra player data (expected income) |
| `PACKET_WEB_RULESET_UNIT_ADDITION` | 260 | S→C | Unit action bit-vector |
| `PACKET_WEB_GOTO_PATH_REQ` | 287 | C→S | Request a goto path |
| `PACKET_WEB_GOTO_PATH` | 288 | S→C | Computed goto path |

> **Note:** `PACKET_RULESET_ACTION` (not yet in `Packets.java`) is required by the web client to
> populate its `actions[]` map. The absence of this packet causes the "Asked for non existing
> action numbered N" console errors seen in the problem statement. See §10.

---

## 6. Game Lifecycle

```
Client connects
    └─ onOpen()  → assign clientId, store socket
        └─ PACKET_SERVER_JOIN_REQ  → addConnection() + addPlayer()
            └─ PACKET_PLAYER_READY  → startGame()
                ├─ sendCalendarInfoAll()
                ├─ sendMapInfoAll()
                ├─ sendGameInfoAll()
                ├─ sendRulesetControl()
                ├─ sendTechAll() × N
                ├─ sendRuleseGovernmentAll() × N
                ├─ sendNationInfoAll() × N
                ├─ sendExtrasInfoAll() × N
                ├─ sendTerrainInfoAll() × N
                ├─ sendRulesetUnitAll() × N
                ├─ sendRulesetUnitWebAdditionAll() × N
                ├─ sendRulesetBuildingAll() × N
                ├─ sendTileInfoAll() × (45×45)
                ├─ spawn starting units for each player
                ├─ sendUnitAll() × N
                ├─ sendRulesetCityInfoAll() × N
                ├─ sendCityInfoAll() × N (empty at start)
                ├─ sendBordersServerSettingsAll()
                ├─ sendStartPhaseAll()
                └─ sendBeginTurnAll()

Each turn:
    PACKET_PLAYER_PHASE_DONE → turnDone()
        ├─ year++, turn++
        ├─ sendGameInfoAll()
        ├─ sendBeginTurnAll()
        └─ sendStartPhaseAll()

Client disconnects
    └─ onClose() → remove from clients map
       (player object stays in game.players — reconnect not implemented)
```

---

## 7. Unit Types & Action Flags

The `utype_actions` field in `UnitType` is a **120-character binary string**. Each character
(`'0'` or `'1'`) represents whether a unit type supports a specific action. The server converts
this string to a byte array and sends it as a JSON number array via
`PACKET_WEB_RULESET_UNIT_ADDITION`.

The bit positions correspond to action IDs defined in `freeciv/common/actions.h`.  
Notable positions (0-indexed, MSB-first within each byte):

| Bit | Action ID | Action name |
|---|---|---|
| 27 | 27 | `ACTION_FOUND_CITY` (build city — settlers) |
| 45 | 45 | `ACTION_ATTACK` |
| Various | 0–22 | Basic unit actions (move, fortify, sentry, pillage …) |

**Current unit types** (defined in `Game.initGame()`):

| ID | Name | MoveRate | HP | Atk | Def | Notes |
|---|---|---|---|---|---|---|
| 0 | Settlers | 1 | 1 | 0 | 1 | Can build cities (`settlerActions`) |
| 1 | Workers | 1 | 1 | 0 | 1 | Can build cities |
| 2 | Explorer | 3 | 1 | 0 | 1 | Fast scout |
| 3 | Warriors | 1 | 10 | 1 | 1 | Basic infantry |
| 4 | Horsemen | 3 | 10 | 2 | 1 | Fast cavalry |
| 5 | Archers | 1 | 10 | 3 | 2 | Ranged |
| 6 | Legion | 1 | 20 | 3 | 3 | Heavy infantry |
| 7 | Pikemen | 1 | 10 | 1 | 2 | Anti-cavalry |
| 8 | Musketeers | 1 | 20 | 5 | 4 | Gunpowder infantry |
| 9 | Catapult | 1 | 10 | 6 | 1 | Siege |
| 10 | Chariot | 3 | 10 | 3 | 1 | Fast chariot |
| 11 | Knight | 3 | 20 | 5 | 2 | Heavy cavalry |

---

## 8. Ruleset Data

All ruleset data is hardcoded in `Game.initGame()`. There is no external ruleset file loading for
most data (only nation rulesets have a `SectionFile` parser).

| Collection | Count | Key items |
|---|---|---|
| Technologies | 13 | Alphabet → Map Making |
| Governments | 6 | Anarchy, Despotism, Monarchy, Communism, Republic, Democracy |
| Nations | 3 | Soviet Union, France, Germany |
| Extras | 15 | River, Mine, Road, Rail, Hut, Fortress, etc. |
| Terrains | 15 | Arctic → Inaccessible |
| Unit types | 12 | See §7 |
| City styles | 4 | European, Classical, Tropical, Asian |
| Improvements | 13 | Palace → Cathedral |

---

## 9. Map Generation

`MapGenerator` creates a 45 × 45 map (2025 tiles).

**Algorithm:**
1. Generate a smooth `heightMap[width][height]` using multi-octave value noise
   (bilinear interpolation at several scales).
2. Assign terrain by height threshold, then apply latitude biomes
   (tundra near top/bottom rows, desert in mid-latitudes when hot, jungle/swamp in humid zones).
3. Scatter resources (`RESOURCE_PROBABILITY = 0.15`) and huts (`HUT_PROBABILITY = 0.03`) on land.
4. Return `Map<Long, Tile>` keyed by linear index `y * width + x`.

---

## 10. Known Limitations & Bugs

### Critical — causes client JavaScript errors

| Bug | Root cause | Fix needed |
|---|---|---|
| `"Asked for non existing action numbered N"` for IDs 23–58 | Server never sends `PACKET_RULESET_ACTION` packets | Add `PACKET_RULESET_ACTION` (pid 130 or correct ID) sending in `startGame()` for all action IDs the client checks |
| `"Cannot read properties of undefined (reading 'length')"` in `requirements.js:180` → `can_player_get_gov` | `sendRuleseGovernmentAll` does not include a `reqs` array in the JSON | Add an empty `reqs` JSON array to the government packet |

### Other limitations

- **No movement-point enforcement**: `moveUnit()` does not decrement `movesleft` or block moves
  when it reaches 0. Units can move indefinitely.
- **No land/water unit distinction**: `PathFinder` does not check terrain; land units can be
  pathed across ocean tiles.
- **No AI players**: Only human players are supported. No AI logic exists.
- **No `/quit` command**: Stub exists but does nothing.
- **No new-turn message**: `turnDone()` does not send a chat message announcing the new turn.
- **No reconnect support**: Disconnecting and rejoining creates a duplicate player.
- **No idle-restart**: Server never restarts itself when idle.
- **City name suggestion is hardcoded**: Always returns `"Paris"`.
- **`City.improvements` is a `String`**: Should be an int array or `JSONArray`.
- **Single player triggers game start**: Any player sending `PACKET_PLAYER_READY` starts the game
  immediately, even if other players are still joining.
- **No combat**: `ACTION_ATTACK` is defined in unit action bits but not implemented server-side.
- **Nation assignment is random 0–2**: Only three nations defined; large games will have duplicate
  nation assignments.

---

## 11. Future Plans

The items below are roughly ordered by priority for the next development sessions.

### High Priority (correctness / client errors)

1. **Send `PACKET_RULESET_ACTION` for all action IDs**  
   The web client's `actions.js` populates its `actions[]` map from these packets.  
   At minimum, send stubs for action IDs 0–120 matching `freeciv/common/actions.h`.  
   Each packet needs: `id`, `name`, `result`, and an empty `enablers` array.

2. **Add `reqs` array to government ruleset packets**  
   `sendRuleseGovernmentAll` must include `"reqs": []` (empty array) in the JSON.  
   This prevents the `requirements.js` crash in the government dialog.

3. **Enforce movement limits in GOTO / unit orders**  
   - Decrement `movesleft` in `moveUnit()`.
   - Reject moves when `movesleft <= 0`.
   - Reset `movesleft` to the unit type's `moveRate` at the start of each turn in `turnDone()`.

4. **Land vs. water unit distinction**  
   Add an `isLandUnit` / `domain` field to `UnitType`.  
   `PathFinder` and `moveUnit()` should reject movement of land units onto ocean/lake tiles.

### Medium Priority (gameplay features)

5. **New-turn message**  
   Broadcast a chat message in `turnDone()`:  
   `"Turn N has started (Year YYYY)."` using `sendMessageAll()`.

6. **`/help` command improvements**  
   Expand the help text to list all commands, game status, and a brief description.  
   Consider sending it only to the requesting client (already done correctly).

7. **Basic AI players (`aifill 5`)**  
   Add an `AiPlayer` class (or a flag on `Player`). On each `turnDone()`:
   - Move each AI unit one step toward the nearest unexplored land tile.
   - If a Settler has no city nearby, build a city.
   - Target: 4 AI players always present, filling a minimum of 5 total players.

8. **Idle-server restart**  
   In `Main.java`, start a background `ScheduledExecutorService` that checks
   `game.connections.isEmpty()` and `lastActivityTime`. If no player has been connected for
   24 hours, call `game.resetGame()` (re-run `initGame()` and reset `gameStarted`).

9. **City name suggestions**  
   Replace the hardcoded `"Paris"` with a per-nation name list drawn from the nation ruleset,
   tracking which names have already been used.

10. **Reconnect support**  
    When a player with a known username joins, restore their existing `Player` object and
    re-send all game state to just their connection instead of creating a new player.

### Lower Priority (polish / scalability)

11. **Proper `PACKET_RULESET_ACTION` enablers**  
    Add `PACKET_ACTION_ENABLER` packets describing which units can perform which actions under
    what requirements, matching the full Freeciv ruleset.

12. **Replace hardcoded ruleset data with `.ruleset` file loading**  
    Extend `SectionFile` / `Section` to parse all Freeciv ruleset files (units, terrain,
    buildings, governments) so the server stays in sync with the C server's default ruleset.

13. **Combat resolution**  
    Implement `ACTION_ATTACK`: look up attacker and defender stats from `UnitType`, run the
    Freeciv combat formula, update HP, remove the loser, and broadcast results.

14. **City growth and production**  
    Each city should produce shields per turn and grow once enough food is accumulated.  
    Completed improvements should be added to the city's improvement list.

15. **Research / technology advancement**  
    Track bulbs per turn per player; advance research when the threshold is met;  
    broadcast `PACKET_RESEARCH_INFO`.

16. **`City.improvements` fix**  
    Change the field type from `String` to `JSONArray` (or `int[]`) to properly track which
    improvements a city has built.

17. **Large-map support (1000 × 1000)**  
    Profile and optimise `startGame()` tile broadcast (currently sends all tiles at start).  
    Implement fog-of-war: only send tiles within each player's sight range.

18. **Virtual threads**  
    Consider wrapping per-player processing in `Thread.ofVirtual()` to exploit Java 21 virtual
    threads for better scalability under high connection counts.

---

*Last updated: 2026-03-14*
