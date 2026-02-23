//! Rust AI module for Freeciv
//! 
//! This module provides AI functionality for Freeciv using Rust.
//! It provides FFI exports that can be called from the C wrapper in rustai.c.

use std::ffi::CStr;
use std::os::raw::{c_char, c_int, c_void};

/// Rust AI player data structure
/// This stores AI-specific data for each player
#[repr(C)]
pub struct RustAIPlayerData {
    player_id: c_int,
    turn_initialized: c_int,
    aggression_level: c_int,
    expansion_focus: c_int,  // 0-100: 0=defensive, 100=expansionist
    science_focus: c_int,     // 0-100: 0=military, 100=science
}

/// Initialize Rust AI for a player
/// This function is called when a player starts using the Rust AI
#[no_mangle]
pub unsafe extern "C" fn rust_ai_player_init(player_id: c_int) -> *mut c_void {
    let data = Box::new(RustAIPlayerData {
        player_id,
        turn_initialized: 0,
        aggression_level: 50,  // Default medium aggression
        expansion_focus: 60,    // Slightly expansionist by default
        science_focus: 50,      // Balanced military/science
    });
    Box::into_raw(data) as *mut c_void
}

/// Free Rust AI player data
/// Called when a player no longer uses Rust AI
#[no_mangle]
pub unsafe extern "C" fn rust_ai_player_free(data: *mut c_void) {
    if !data.is_null() {
        let _ = Box::from_raw(data as *mut RustAIPlayerData);
    }
}

/// Get player aggression level
/// Returns the AI's current aggression setting (0-100)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_aggression(data: *mut c_void) -> c_int {
    if data.is_null() {
        return 50; // Default value
    }
    let player_data = &*(data as *mut RustAIPlayerData);
    player_data.aggression_level
}

/// Set player aggression level
/// Allows dynamic adjustment of AI aggression (0=peaceful, 100=very aggressive)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_set_aggression(data: *mut c_void, level: c_int) {
    if data.is_null() {
        return;
    }
    let player_data = &mut *(data as *mut RustAIPlayerData);
    player_data.aggression_level = level.clamp(0, 100);
}

/// Get player expansion focus
/// Returns the AI's expansion priority (0-100)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_expansion_focus(data: *mut c_void) -> c_int {
    if data.is_null() {
        return 60; // Default value
    }
    let player_data = &*(data as *mut RustAIPlayerData);
    player_data.expansion_focus
}

/// Set player expansion focus
/// Adjusts how aggressively the AI expands (0=defensive, 100=expansionist)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_set_expansion_focus(data: *mut c_void, level: c_int) {
    if data.is_null() {
        return;
    }
    let player_data = &mut *(data as *mut RustAIPlayerData);
    player_data.expansion_focus = level.clamp(0, 100);
}

/// Get player science focus
/// Returns the AI's science vs military balance (0-100)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_science_focus(data: *mut c_void) -> c_int {
    if data.is_null() {
        return 50; // Default value
    }
    let player_data = &*(data as *mut RustAIPlayerData);
    player_data.science_focus
}

/// Set player science focus
/// Adjusts AI priority between military and science (0=military, 100=science)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_set_science_focus(data: *mut c_void, level: c_int) {
    if data.is_null() {
        return;
    }
    let player_data = &mut *(data as *mut RustAIPlayerData);
    player_data.science_focus = level.clamp(0, 100);
}

/// Log a message from Rust AI
/// This is a utility function for debugging
#[no_mangle]
pub unsafe extern "C" fn rust_ai_log(message: *const c_char) {
    if message.is_null() {
        return;
    }
    
    let c_str = CStr::from_ptr(message);
    if let Ok(str_slice) = c_str.to_str() {
        eprintln!("[Rust AI] {}", str_slice);
    }
}

/// Calculate a simple score for a tile position
/// This is a basic example of Rust AI logic
/// 
/// # Arguments
/// * `x` - X coordinate
/// * `y` - Y coordinate
/// * `terrain_type` - Type of terrain (0=ocean, 1=grassland, 2=plains, etc.)
/// 
/// # Returns
/// A score value representing the desirability of the tile
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_tile(x: c_int, y: c_int, terrain_type: c_int) -> c_int {
    // Enhanced scoring algorithm with terrain bonuses
    let base_score = match terrain_type {
        0 => 10,  // Ocean - low value, but necessary for naval units
        1 => 100, // Grassland - high value for food production
        2 => 80,  // Plains - good for production and food
        3 => 40,  // Desert - low value, poor production
        4 => 60,  // Tundra - moderate value
        5 => 85,  // Forest - good for production and shields
        6 => 90,  // Hills - excellent for production
        7 => 70,  // Mountains - moderate, good for defense
        8 => 95,  // River tiles - very valuable for food and commerce
        _ => 50,  // Unknown - default moderate value
    };
    
    // Add some variation based on position to simulate resource distribution
    let position_modifier = ((x + y) % 20) - 10;
    
    // Bonus for tiles near the center of the map (strategic importance)
    let center_bonus = if (x % 50 < 25) && (y % 50 < 25) { 10 } else { 0 };
    
    base_score + position_modifier + center_bonus
}

/// Evaluate a tile for city placement
/// Returns a score indicating how good a location is for founding a city
/// 
/// # Arguments
/// * `x` - X coordinate
/// * `y` - Y coordinate
/// * `terrain_type` - Type of terrain at this location
/// * `adjacent_water` - Number of adjacent water tiles (0-8)
/// * `adjacent_land` - Number of adjacent land tiles (0-8)
/// 
/// # Returns
/// A score for city placement quality (higher is better)
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_city_placement(
    x: c_int,
    y: c_int,
    terrain_type: c_int,
    adjacent_water: c_int,
    adjacent_land: c_int,
) -> c_int {
    // Base tile value
    let mut score = rust_ai_evaluate_tile(x, y, terrain_type);
    
    // Prefer locations with good land/water balance
    // Some water is good for trade and food, but too much is bad
    if adjacent_water >= 1 && adjacent_water <= 3 {
        score += 30; // Coastal cities are valuable
    } else if adjacent_water > 5 {
        score -= 40; // Too much water limits city growth
    }
    
    // Need sufficient adjacent land for city to work tiles
    score += adjacent_land * 5;
    
    // Grassland and plains are best for city centers
    if terrain_type == 1 || terrain_type == 2 {
        score += 40;
    }
    
    // Avoid placing cities on mountains or in deep ocean
    if terrain_type == 0 || terrain_type == 7 {
        score -= 100;
    }
    
    score
}

/// Calculate the combat value of a unit
/// 
/// # Arguments
/// * `attack_strength` - Unit's attack rating
/// * `defense_strength` - Unit's defense rating
/// * `movement_points` - Unit's movement capability
/// * `hitpoints` - Current hitpoints
/// * `max_hitpoints` - Maximum hitpoints
/// 
/// # Returns
/// Overall combat effectiveness score
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_unit_strength(
    attack_strength: c_int,
    defense_strength: c_int,
    movement_points: c_int,
    hitpoints: c_int,
    max_hitpoints: c_int,
) -> c_int {
    // Calculate base combat value (average of attack and defense)
    let base_value = (attack_strength + defense_strength) / 2;
    
    // Mobility is valuable - add bonus for movement
    let mobility_bonus = movement_points * 3;
    
    // Health affects effectiveness
    let health_ratio = if max_hitpoints > 0 {
        (hitpoints * 100) / max_hitpoints
    } else {
        100
    };
    
    // Apply health modifier (units at 50% health are ~75% effective)
    let total_value = base_value + mobility_bonus;
    (total_value * (50 + health_ratio / 2)) / 100
}

/// Assess threat level from enemy units
/// 
/// # Arguments
/// * `num_enemy_units` - Number of enemy units in area
/// * `enemy_avg_strength` - Average combat strength of enemy units
/// * `distance_to_enemy` - Distance to nearest enemy (in tiles)
/// * `our_defense_strength` - Our defensive capability in the area
/// 
/// # Returns
/// Threat level score (0-100, higher is more dangerous)
#[no_mangle]
pub extern "C" fn rust_ai_assess_threat(
    num_enemy_units: c_int,
    enemy_avg_strength: c_int,
    distance_to_enemy: c_int,
    our_defense_strength: c_int,
) -> c_int {
    // Base threat from number and strength of enemies
    let base_threat = num_enemy_units * enemy_avg_strength / 10;
    
    // Distance modifier - closer enemies are more threatening
    let distance_factor = if distance_to_enemy > 0 {
        100 / distance_to_enemy
    } else {
        100 // Enemy right next to us!
    };
    
    // Compare to our defenses
    let relative_threat = if our_defense_strength > 0 {
        (base_threat * 100) / our_defense_strength
    } else {
        base_threat * 2 // No defenses, very dangerous!
    };
    
    // Apply distance modifier and clamp to 0-100
    let final_threat = (relative_threat * distance_factor) / 100;
    final_threat.clamp(0, 100)
}

/// Get version information for the Rust AI module
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_version() -> *const c_char {
    "Rust AI v0.2.0 - Enhanced\0".as_ptr() as *const c_char
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tile_evaluation() {
        // Grassland should score higher than ocean
        let grassland_score = rust_ai_evaluate_tile(0, 0, 1);
        let ocean_score = rust_ai_evaluate_tile(0, 0, 0);
        assert!(grassland_score > ocean_score);
        
        // Hills should be valuable
        let hills_score = rust_ai_evaluate_tile(5, 5, 6);
        assert!(hills_score > 70);
    }

    #[test]
    fn test_city_placement() {
        // Good coastal location (grassland with some water)
        let coastal_score = rust_ai_evaluate_city_placement(10, 10, 1, 2, 6);
        
        // Bad location (too much water)
        let too_much_water = rust_ai_evaluate_city_placement(10, 10, 1, 7, 1);
        
        // Mountain location (very bad)
        let mountain_score = rust_ai_evaluate_city_placement(10, 10, 7, 0, 8);
        
        assert!(coastal_score > too_much_water);
        assert!(coastal_score > mountain_score);
    }

    #[test]
    fn test_unit_strength() {
        // Strong healthy unit
        let strong_unit = rust_ai_evaluate_unit_strength(10, 8, 3, 100, 100);
        
        // Same unit but wounded
        let wounded_unit = rust_ai_evaluate_unit_strength(10, 8, 3, 50, 100);
        
        // Weak unit
        let weak_unit = rust_ai_evaluate_unit_strength(2, 2, 1, 100, 100);
        
        assert!(strong_unit > wounded_unit);
        assert!(strong_unit > weak_unit);
        assert!(wounded_unit > weak_unit);
    }

    #[test]
    fn test_threat_assessment() {
        // Dangerous: many strong enemies nearby
        let high_threat = rust_ai_assess_threat(5, 50, 1, 20);
        
        // Moderate: some enemies at distance
        let medium_threat = rust_ai_assess_threat(3, 30, 5, 40);
        
        // Low: weak enemies far away
        let low_threat = rust_ai_assess_threat(1, 10, 10, 50);
        
        assert!(high_threat > medium_threat);
        assert!(medium_threat > low_threat);
        
        // Threat should be clamped to 0-100
        let clamped = rust_ai_assess_threat(100, 100, 1, 10);
        assert!(clamped <= 100);
    }

    #[test]
    fn test_player_data() {
        unsafe {
            let data = rust_ai_player_init(1);
            assert!(!data.is_null());
            
            // Test aggression get/set
            let initial = rust_ai_get_aggression(data);
            assert_eq!(initial, 50);
            
            rust_ai_set_aggression(data, 75);
            let updated = rust_ai_get_aggression(data);
            assert_eq!(updated, 75);
            
            // Test clamping
            rust_ai_set_aggression(data, 150);
            let clamped = rust_ai_get_aggression(data);
            assert_eq!(clamped, 100);
            
            // Test expansion focus
            let expansion = rust_ai_get_expansion_focus(data);
            assert_eq!(expansion, 60); // Default value
            
            rust_ai_set_expansion_focus(data, 80);
            assert_eq!(rust_ai_get_expansion_focus(data), 80);
            
            // Test science focus
            let science = rust_ai_get_science_focus(data);
            assert_eq!(science, 50); // Default value
            
            rust_ai_set_science_focus(data, 70);
            assert_eq!(rust_ai_get_science_focus(data), 70);
            
            // Test focus clamping
            rust_ai_set_science_focus(data, -10);
            assert_eq!(rust_ai_get_science_focus(data), 0);
            
            rust_ai_set_expansion_focus(data, 200);
            assert_eq!(rust_ai_get_expansion_focus(data), 100);
            
            rust_ai_player_free(data);
        }
    }
    
    #[test]
    fn test_terrain_diversity() {
        // Test various terrain types
        let ocean = rust_ai_evaluate_tile(0, 0, 0);
        let grassland = rust_ai_evaluate_tile(0, 0, 1);
        let _plains = rust_ai_evaluate_tile(0, 0, 2);
        let desert = rust_ai_evaluate_tile(0, 0, 3);
        let forest = rust_ai_evaluate_tile(0, 0, 5);
        let hills = rust_ai_evaluate_tile(0, 0, 6);
        let river = rust_ai_evaluate_tile(0, 0, 8);
        
        // Verify relative values make sense
        assert!(grassland > ocean);
        assert!(river > desert);
        assert!(hills > desert);
        assert!(forest > ocean);
    }
}
