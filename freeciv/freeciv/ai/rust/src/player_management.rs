//! Player management functions
//! 
//! This module handles player initialization, deallocation, and
//! management of player-specific AI parameters like aggression and focus.

use std::os::raw::{c_int, c_void};
use crate::data_structures::RustAIPlayerData;

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
