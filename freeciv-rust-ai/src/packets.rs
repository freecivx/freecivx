use serde::{Deserialize, Serialize};
use serde_json::Value;

// Packet type constants from packets.def
pub const PACKET_PROCESSING_STARTED: u32 = 0;
pub const PACKET_PROCESSING_FINISHED: u32 = 1;
pub const PACKET_SERVER_JOIN_REQ: u32 = 4;
pub const PACKET_SERVER_JOIN_REPLY: u32 = 5;
pub const PACKET_AUTHENTICATION_REQ: u32 = 6;
pub const PACKET_AUTHENTICATION_REPLY: u32 = 7;
pub const PACKET_SERVER_SHUTDOWN: u32 = 8;
pub const PACKET_NATION_SELECT_REQ: u32 = 10;
pub const PACKET_PLAYER_READY: u32 = 11;
pub const PACKET_GAME_INFO: u32 = 16;
pub const PACKET_MAP_INFO: u32 = 17;
pub const PACKET_CHAT_MSG: u32 = 25;
pub const PACKET_CHAT_MSG_REQ: u32 = 26;
pub const PACKET_CONNECT_MSG: u32 = 27;
pub const PACKET_SERVER_INFO: u32 = 29;
pub const PACKET_CITY_INFO: u32 = 31;
pub const PACKET_PLAYER_INFO: u32 = 51;
pub const PACKET_PLAYER_PHASE_DONE: u32 = 52;
pub const PACKET_UNIT_INFO: u32 = 60;
pub const PACKET_TILE_INFO: u32 = 15;
pub const PACKET_BEGIN_TURN: u32 = 53;
pub const PACKET_END_TURN: u32 = 54;
pub const PACKET_START_PHASE: u32 = 55;

#[derive(Debug, Serialize, Deserialize)]
pub struct FreecivPacket {
    pub pid: u32,
    #[serde(flatten)]
    pub data: Value,
}

// PACKET_SERVER_JOIN_REQ = 4
#[derive(Debug, Serialize, Deserialize)]
pub struct ServerJoinReq {
    pub pid: u32,
    pub username: String,
    pub capability: String,
    pub version_label: String,
    pub major_version: u32,
    pub minor_version: u32,
    pub patch_version: u32,
}

impl ServerJoinReq {
    pub fn new(username: String) -> Self {
        Self {
            pid: PACKET_SERVER_JOIN_REQ,
            username,
            capability: "+Freeciv-3.3-2024.May.01".to_string(),
            version_label: "3.3.0".to_string(),
            major_version: 3,
            minor_version: 3,
            patch_version: 0,
        }
    }
}

// PACKET_SERVER_JOIN_REPLY = 5
#[derive(Debug, Deserialize)]
pub struct ServerJoinReply {
    pub you_can_join: bool,
    pub message: String,
    pub capability: String,
    pub challenge_file: Option<String>,
    pub conn_id: i16,
}

// PACKET_AUTHENTICATION_REQ = 6
#[derive(Debug, Deserialize)]
pub struct AuthenticationReq {
    #[serde(rename = "type")]
    pub auth_type: u8,
    pub message: String,
}

// PACKET_AUTHENTICATION_REPLY = 7
#[derive(Debug, Serialize)]
pub struct AuthenticationReply {
    pub pid: u32,
    pub password: String,
}

impl AuthenticationReply {
    pub fn new(password: String) -> Self {
        Self {
            pid: PACKET_AUTHENTICATION_REPLY,
            password,
        }
    }
}

// PACKET_CHAT_MSG_REQ = 26
#[derive(Debug, Serialize)]
pub struct ChatMsgReq {
    pub pid: u32,
    pub message: String,
}

impl ChatMsgReq {
    pub fn new(message: String) -> Self {
        Self {
            pid: PACKET_CHAT_MSG_REQ,
            message,
        }
    }
}

// PACKET_PLAYER_PHASE_DONE = 52
#[derive(Debug, Serialize)]
pub struct PlayerPhaseDone {
    pub pid: u32,
    pub player_no: u16,
}

impl PlayerPhaseDone {
    pub fn new(player_no: u16) -> Self {
        Self {
            pid: PACKET_PLAYER_PHASE_DONE,
            player_no,
        }
    }
}

// PACKET_CONNECT_MSG = 27
#[derive(Debug, Deserialize)]
pub struct ConnectMsg {
    pub message: String,
}

// PACKET_CHAT_MSG = 25
#[derive(Debug, Deserialize)]
pub struct ChatMsg {
    pub message: String,
    #[serde(default)]
    pub conn_id: i16,
}

// PACKET_SERVER_INFO = 29
#[derive(Debug, Deserialize)]
pub struct ServerInfo {
    #[serde(default)]
    pub version: String,
}

// PACKET_GAME_INFO = 16
#[derive(Debug, Deserialize)]
pub struct GameInfo {
    #[serde(default)]
    pub turn: i16,
    #[serde(default)]
    pub year: i32,
}

// PACKET_PLAYER_INFO = 51
#[derive(Debug, Deserialize)]
pub struct PlayerInfo {
    pub playerno: u16,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub is_alive: bool,
    #[serde(default)]
    pub gold: u32,
}

// PACKET_UNIT_INFO = 60
#[derive(Debug, Deserialize)]
pub struct UnitInfo {
    pub id: u16,
    #[serde(default)]
    pub owner: u16,
    #[serde(default)]
    pub tile: i32,
    #[serde(default)]
    pub homecity: u16,
    #[serde(default, rename = "type")]
    pub unit_type: u16,
    #[serde(default)]
    pub moves_left: u16,
    #[serde(default)]
    pub hp: u16,
}

// PACKET_CITY_INFO = 31
#[derive(Debug, Deserialize)]
pub struct CityInfo {
    pub id: u16,
    #[serde(default)]
    pub owner: u16,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub tile: i32,
    #[serde(default)]
    pub size: u8,
    #[serde(default)]
    pub production_kind: Option<u8>,
    #[serde(default)]
    pub production_value: Option<u16>,
}
