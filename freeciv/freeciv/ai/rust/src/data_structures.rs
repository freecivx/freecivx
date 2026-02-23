//! Data structures for Rust AI
//! 
//! This module contains the core data structures used by the Rust AI,
//! including player data, tiles, units, and cities.

use std::os::raw::c_int;

/// Rust AI player data structure
/// This stores AI-specific data for each player
#[repr(C)]
pub struct RustAIPlayerData {
    pub player_id: c_int,
    pub turn_initialized: c_int,
    pub aggression_level: c_int,
    pub expansion_focus: c_int,  // 0-100: 0=defensive, 100=expansionist
    pub science_focus: c_int,     // 0-100: 0=military, 100=science
}

/// Tile game state representation
/// Represents a map tile with terrain and resource information
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct RustTile {
    pub x: c_int,
    pub y: c_int,
    pub terrain_type: c_int,
    pub has_river: c_int,
    pub has_road: c_int,
    pub has_railroad: c_int,
    pub owner_id: c_int,  // -1 if unowned
    pub worked_by_city_id: c_int,  // -1 if not worked
}

/// Unit game state representation
/// Represents a military or civilian unit
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct RustUnit {
    pub unit_id: c_int,
    pub owner_id: c_int,
    pub x: c_int,
    pub y: c_int,
    pub attack_strength: c_int,
    pub defense_strength: c_int,
    pub movement_points: c_int,
    pub moves_left: c_int,
    pub hitpoints: c_int,
    pub max_hitpoints: c_int,
    pub firepower: c_int,
    pub veteran_level: c_int,
    pub is_military: c_int,  // 0=civilian, 1=military
}

/// City game state representation
/// Represents a city with production and population
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct RustCity {
    pub city_id: c_int,
    pub owner_id: c_int,
    pub x: c_int,
    pub y: c_int,
    pub population: c_int,
    pub food_surplus: c_int,
    pub shield_surplus: c_int,
    pub trade_production: c_int,
    pub science_output: c_int,
    pub gold_output: c_int,
    pub luxury_output: c_int,
    pub is_coastal: c_int,  // 0=no, 1=yes
    pub turn_founded: c_int,
}
