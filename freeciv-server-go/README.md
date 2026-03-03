# freeciv-server-go

freeciv-server-go is a Go wrapper around the Freeciv C server. It hosts the server's main loop inside the Go runtime and exposes HTTP and WebSocket endpoints for web clients to interact with the game.

## Features

* **WebSocket endpoint** (`/ws`) – upgrades HTTP connections to WebSocket, sends an initial player-list greeting, and echoes subsequent messages.
* **Player list endpoint** (`/players`) – returns the current player list as plain text, one name per line.
* **Status endpoint** (`/status`) – returns a JSON document with server health information: uptime, number of connected WebSocket clients, and the current player list.
* **Graceful shutdown** – handles `SIGTERM` and `SIGINT`, draining active connections within a configurable timeout.
* **INI-based configuration** with environment-variable overrides.
* **Structured logging** via `log/slog` at a configurable level.

## Build

### Stub build (no C compiler required)

Useful for iterating on Go code and running tests without a Freeciv C library:

```bash
cd freeciv-server-go
make build-stub
```

### Full build (links against Freeciv C libraries)

Requires a configured and compiled Freeciv tree at `../freeciv`:

```bash
cd ../freeciv/freeciv && ./autogen.sh && ./configure && make
cd ../../freeciv-server-go
make build
```

See the [Makefile](Makefile) for additional options such as `FREECIV_PREFIX`.

## Configuration

Copy the configuration template and edit it:

```bash
cp settings.ini.dist settings.ini
# Edit settings.ini with your preferred settings
```

### Configuration file (`settings.ini`)

```ini
[Config]
# Address (host:port) the server listens on.
listen_addr = :8080

# Logging level: DEBUG, INFO, WARN, ERROR
log_level = INFO

# Path for the log file (stdout is always used as well).
log_file = ../logs/freeciv-server-go.log
```

### Environment variable overrides

| Variable | Config key | Default |
|---|---|---|
| `FREECIV_SERVER_ADDR` | `listen_addr` | `:8080` |
| `FREECIV_SERVER_LOG_LEVEL` | `log_level` | `INFO` |
| `FREECIV_SERVER_LOG_FILE` | `log_file` | `../logs/freeciv-server-go.log` |

## Usage

### Via run.sh (recommended)

```bash
cd freeciv-server-go
./run.sh
```

`run.sh` builds the stub binary if it is not already present and starts the server with `nohup`, redirecting output to `../logs/freeciv-server-go.log`.

### Manually

```bash
./freeciv-server-go-stub -settings settings.ini
```

### Command-line flags

```
-settings <path>    Path to settings.ini (default: settings.ini)
-log-level <level>  Logging level override: DEBUG, INFO, WARN, ERROR
```

The `-log-level` flag takes precedence over the value in `settings.ini`.

## HTTP Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/ws` | `GET` (WebSocket upgrade) | WebSocket connection; implements the Freeciv login protocol |
| `/players` | `GET` | Current player list as a JSON array |
| `/status` | `GET` | JSON health document |

## WebSocket Protocol

The `/ws` endpoint implements the Freeciv client login protocol used by the
JavaScript web client (`clinet.js`):

1. The client connects and immediately sends a **server_join_req** packet
   (`pid: 4`) containing the username, capability string, and version fields.
2. The server assigns a unique connection ID and responds with a
   **server_join_reply** packet (`pid: 5`) with `you_can_join: true`,
   `conn_id`, `message`, `capability`, and `challenge_file`.
3. The server immediately follows with a **conn_info** packet (`pid: 115`)
   describing the new connection (id, username, established flag, etc.).
4. The server sends periodic **conn_ping** packets (`pid: 88`) every 30 seconds;
   the client responds with **conn_pong** (`pid: 89`).
5. Subsequent packets from the client (client_info `pid: 119`, chat, etc.) are
   dispatched appropriately.

### Packet IDs

All packet IDs are defined as constants in `protocol.go`, mirroring
`freeciv/freeciv/common/networking/packets.def` and
`freeciv-web/src/derived/webapp/javascript/packets.js`.

#### Session / connection (sc = server→client, cs = client→server)

| pid | Name | Direction |
|-----|------|-----------|
| 0 | processing_started | sc |
| 1 | processing_finished | sc |
| 4 | server_join_req | cs |
| 5 | server_join_reply | sc |
| 6 | authentication_req | sc |
| 7 | authentication_reply | cs |
| 8 | server_shutdown | sc |
| 27 | connect_msg | sc |
| 29 | server_info | sc |
| 88 | conn_ping | sc |
| 89 | conn_pong | cs |
| 115 | conn_info | sc |
| 116 | conn_ping_info | sc |
| 119 | client_info | cs |
| 160 | single_want_hack_req | cs |
| 161 | single_want_hack_reply | sc |
| 162 | ruleset_choices | sc |
| 163 | game_load | sc |
| 171 | ruleset_select | cs |
| 254 | client_heartbeat | cs |

#### Chat

| pid | Name | Direction |
|-----|------|-----------|
| 25 | chat_msg | sc |
| 26 | chat_msg_req | cs |
| 28 | early_chat_msg | sc |
| 110 | page_msg | sc |
| 250 | page_msg_part | sc |

#### Turn / phase

| pid | Name | Direction |
|-----|------|-----------|
| 52 | player_phase_done | cs |
| 125 | end_phase | sc |
| 126 | start_phase | sc |
| 127 | new_year | sc |
| 128 | begin_turn | sc |
| 129 | end_turn | sc |
| 130 | freeze_client | sc |
| 131 | thaw_client | sc |

#### Nation / player

| pid | Name | Direction |
|-----|------|-----------|
| 10 | nation_select_req | cs |
| 11 | player_ready | cs |
| 50 | player_remove | sc |
| 51 | player_info | sc |
| 53 | player_rates | cs |
| 54 | player_change_government | cs |
| 55 | player_research | cs |
| 56 | player_tech_goal | cs |
| 57 | player_attribute_block | cs |
| 58 | player_attribute_chunk | cs/sc |
| 59 | player_diplstate | sc |
| 61 | player_place_infra | cs |
| 60 | research_info | sc |
| 66 | unknown_research | sc |
| 242 | player_multiplier | cs |

#### City

| pid | Name | Direction |
|-----|------|-----------|
| 30 | city_remove | sc |
| 31 | city_info | sc |
| 32 | city_short_info | sc |
| 33 | city_sell | cs |
| 34 | city_buy | cs |
| 35 | city_change | cs |
| 36 | city_worklist | cs |
| 37 | city_make_specialist | cs |
| 38 | city_make_worker | cs |
| 39 | city_change_specialist | cs |
| 40 | city_rename | cs |
| 41 | city_options_req | cs |
| 42 | city_refresh | cs |
| 43 | city_name_suggestion_req | cs |
| 44 | city_name_suggestion_info | sc |
| 45 | city_sabotage_list | sc |
| 46 | city_nationalities | sc |
| 138 | city_rally_point | cs/sc |
| 249 | traderoute_info | sc |
| 256 | web_city_info_addition | sc |
| 257 | web_cma_set | cs |
| 258 | web_cma_clear | cs |
| 514 | city_update_counters | sc |

#### Unit

| pid | Name | Direction |
|-----|------|-----------|
| 62 | unit_remove | sc |
| 63 | unit_info | sc |
| 64 | unit_short_info | sc |
| 65 | unit_combat_info | sc |
| 71 | unit_sscs_set | cs |
| 73 | unit_orders | cs |
| 74 | unit_server_side_agent_set | cs |
| 82 | unit_action_query | cs |
| 83 | unit_type_upgrade | cs |
| 84 | unit_do_action | cs |
| 85 | unit_action_answer | sc |
| 87 | unit_get_actions | cs |
| 90 | unit_actions | sc |
| 222 | unit_change_activity | cs |
| 241 | worker_task | cs/sc |

#### Diplomacy

| pid | Name | Direction |
|-----|------|-----------|
| 95 | diplomacy_init_meeting_req | cs |
| 96 | diplomacy_init_meeting | sc |
| 97 | diplomacy_cancel_meeting_req | cs |
| 98 | diplomacy_cancel_meeting | sc |
| 99 | diplomacy_create_clause_req | cs |
| 100 | diplomacy_create_clause | sc |
| 101 | diplomacy_remove_clause_req | cs |
| 102 | diplomacy_remove_clause | sc |
| 103 | diplomacy_accept_treaty_req | cs |
| 105 | diplomacy_cancel_pact | cs |
| 512 | ruleset_clause | sc |

#### Votes / server settings / misc

| pid | Name | Direction |
|-----|------|-----------|
| 111 | report_req | cs |
| 135 | spaceship_launch | cs |
| 136 | spaceship_place | cs |
| 137 | spaceship_info | sc |
| 181 | save_scenario | cs |
| 185 | vote_new | sc |
| 186 | vote_update | sc |
| 187 | vote_remove | sc |
| 188 | vote_resolve | sc |
| 189 | vote_submit | cs |
| 164 | server_setting_control | sc |
| 165 | server_setting_const | sc |
| 166 | server_setting_bool | sc |
| 167 | server_setting_int | sc |
| 168 | server_setting_str | sc |
| 169 | server_setting_enum | sc |
| 170 | server_setting_bitwise | sc |
| 287 | web_goto_path_req | cs |
| 288 | web_goto_path | sc |
| 289 | web_info_text_req | cs |
| 290 | web_info_text_message | sc |

#### Edit mode

| pid | Name | Direction |
|-----|------|-----------|
| 14 | edit_scenario_desc | cs |
| 190 | edit_mode | cs |
| 197 | edit_recalculate_borders | cs |
| 198 | edit_check_tiles | cs |
| 199 | edit_toggle_fogofwar | cs |
| 200 | edit_tile_terrain | cs |
| 202 | edit_tile_extra | cs |
| 204 | edit_startpos | cs/sc |
| 205 | edit_startpos_full | cs/sc |
| 206 | edit_tile | cs |
| 207 | edit_unit_create | cs |
| 208 | edit_unit_remove | cs |
| 209 | edit_unit_remove_by_id | cs |
| 210 | edit_unit | cs |
| 211 | edit_city_create | cs |
| 212 | edit_city_remove | cs |
| 213 | edit_city | cs |
| 214 | edit_player_create | cs |
| 215 | edit_player_remove | cs |
| 216 | edit_player | cs/sc |
| 217 | edit_player_vision | cs |
| 218 | edit_game | cs |
| 219 | edit_object_created | sc |

#### Ruleset packets (sc only)

| pid | Name |
|-----|------|
| 9 | ruleset_tech_class |
| 12 | endgame_report |
| 13 | scenario_description |
| 15 | tile_info |
| 16 | game_info |
| 17 | map_info |
| 18 | nuke_tile_info |
| 19 | team_name_info |
| 20 | ruleset_impr_flag |
| 140 | ruleset_unit |
| 141 | ruleset_game |
| 142 | ruleset_specialist |
| 143 | ruleset_government_ruler_title |
| 144 | ruleset_tech |
| 145 | ruleset_government |
| 146 | ruleset_terrain_control |
| 147 | ruleset_nation_groups |
| 148 | ruleset_nation |
| 149 | ruleset_city |
| 150 | ruleset_building |
| 151 | ruleset_terrain |
| 152 | ruleset_unit_class |
| 153 | ruleset_base |
| 155 | ruleset_control |
| 175 | ruleset_effect |
| 177 | ruleset_resource |
| 180 | scenario_info |
| 220 | ruleset_road |
| 223 | endgame_player |
| 224 | ruleset_disaster |
| 225 | rulesets_ready |
| 226 | ruleset_extra_flag |
| 227 | ruleset_trade |
| 228 | ruleset_unit_bonus |
| 229 | ruleset_unit_flag |
| 230 | ruleset_unit_class_flag |
| 231 | ruleset_terrain_flag |
| 232 | ruleset_extra |
| 233 | ruleset_achievement |
| 234 | ruleset_tech_flag |
| 235 | ruleset_action_enabler |
| 236 | ruleset_nation_sets |
| 237 | nation_availability |
| 238 | achievement_info |
| 239 | ruleset_style |
| 240 | ruleset_music |
| 243 | ruleset_multiplier |
| 244 | timeout_info |
| 245 | play_music |
| 246 | ruleset_action |
| 247 | ruleset_description_part |
| 248 | ruleset_goods |
| 251 | ruleset_summary |
| 252 | ruleset_action_auto |
| 253 | set_topology |
| 255 | calendar_info |
| 259 | web_player_info_addition |
| 260 | web_ruleset_unit_addition |
| 513 | ruleset_counter |

### `/status` response example

```json
{
  "status": "ok",
  "uptime_seconds": 42.7,
  "connected_clients": 2,
  "players": ["Alice", "Bob"]
}
```

## Tests

```bash
cd freeciv-server-go
make test
```

Tests run in stub mode (no C compiler or Freeciv libraries needed).

## Requirements

* Go 1.22 or higher
* C compiler + Freeciv C libraries (only for the full `make build` target)
