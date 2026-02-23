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
}

/// Initialize Rust AI for a player
/// This function is called when a player starts using the Rust AI
#[no_mangle]
pub unsafe extern "C" fn rust_ai_player_init(player_id: c_int) -> *mut c_void {
    let data = Box::new(RustAIPlayerData {
        player_id,
        turn_initialized: 0,
        aggression_level: 50, // Default medium aggression
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
    // Simple scoring algorithm
    let base_score = match terrain_type {
        0 => 10,  // Ocean - low value
        1 => 100, // Grassland - high value for food
        2 => 80,  // Plains - good for production
        3 => 60,  // Desert - low value
        4 => 90,  // Tundra - moderate
        5 => 70,  // Forest - good for production
        _ => 50,  // Unknown - default
    };
    
    // Add some variation based on position
    let position_modifier = ((x + y) % 20) - 10;
    
    base_score + position_modifier
}

/// Get version information for the Rust AI module
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_version() -> *const c_char {
    "Rust AI v0.1.0\0".as_ptr() as *const c_char
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
            
            rust_ai_player_free(data);
        }
    }
}
