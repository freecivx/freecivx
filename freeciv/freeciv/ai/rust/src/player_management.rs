//! Player management functions
//! 
//! This module handles player initialization, deallocation, and
//! management of player-specific AI parameters like aggression and focus.

use std::os::raw::{c_int, c_void};
use std::panic;
use crate::data_structures::RustAIPlayerData;
use crate::logging::log_message;

/// Initialize Rust AI for a player
/// This function is called when a player starts using the Rust AI
/// 
/// Safety: This function catches all panics to prevent crashing the C server
#[no_mangle]
pub unsafe extern "C" fn rust_ai_player_init(player_id: c_int) -> *mut c_void {
    let result = panic::catch_unwind(|| {
        let msg = format!("Rust AI: Initializing player {}", player_id);
        log_message(&msg);
        
        let data = Box::new(RustAIPlayerData {
            player_id,
            turn_initialized: 0,
            aggression_level: 50,  // Default medium aggression
            expansion_focus: 60,    // Slightly expansionist by default
            science_focus: 50,      // Balanced military/science
        });
        Box::into_raw(data) as *mut c_void
    });
    
    match result {
        Ok(ptr) => ptr,
        Err(_) => {
            log_message("ERROR: Rust AI player_init panicked! Returning null.");
            std::ptr::null_mut()
        }
    }
}

/// Free Rust AI player data
/// Called when a player no longer uses Rust AI
/// 
/// Safety: This function catches all panics to prevent crashing the C server
#[no_mangle]
pub unsafe extern "C" fn rust_ai_player_free(data: *mut c_void) {
    let _ = panic::catch_unwind(|| {
        if !data.is_null() {
            let player_data = &*(data as *mut RustAIPlayerData);
            let msg = format!("Rust AI: Freeing player {}", player_data.player_id);
            log_message(&msg);
            let _ = Box::from_raw(data as *mut RustAIPlayerData);
        }
    });
    // If panic occurs, we silently ignore it to avoid crashing the C server
}

/// Get player aggression level
/// Returns the AI's current aggression setting (0-100)
/// 
/// Safety: This function catches all panics to prevent crashing the C server
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_aggression(data: *mut c_void) -> c_int {
    let result = panic::catch_unwind(|| {
        if data.is_null() {
            return 50; // Default value
        }
        let player_data = &*(data as *mut RustAIPlayerData);
        player_data.aggression_level
    });
    
    result.unwrap_or(50)
}

/// Set player aggression level
/// Allows dynamic adjustment of AI aggression (0=peaceful, 100=very aggressive)
/// 
/// Safety: This function catches all panics to prevent crashing the C server
#[no_mangle]
pub unsafe extern "C" fn rust_ai_set_aggression(data: *mut c_void, level: c_int) {
    let _ = panic::catch_unwind(|| {
        if data.is_null() {
            return;
        }
        let player_data = &mut *(data as *mut RustAIPlayerData);
        let old_level = player_data.aggression_level;
        player_data.aggression_level = level.clamp(0, 100);
        let msg = format!("Rust AI: Player {} aggression changed {} -> {}", 
                         player_data.player_id, old_level, player_data.aggression_level);
        log_message(&msg);
    });
}

/// Get player expansion focus
/// Returns the AI's expansion priority (0-100)
/// 
/// Safety: This function catches all panics to prevent crashing the C server
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_expansion_focus(data: *mut c_void) -> c_int {
    let result = panic::catch_unwind(|| {
        if data.is_null() {
            return 60; // Default value
        }
        let player_data = &*(data as *mut RustAIPlayerData);
        player_data.expansion_focus
    });
    
    result.unwrap_or(60)
}

/// Set player expansion focus
/// Adjusts how aggressively the AI expands (0=defensive, 100=expansionist)
/// 
/// Safety: This function catches all panics to prevent crashing the C server
#[no_mangle]
pub unsafe extern "C" fn rust_ai_set_expansion_focus(data: *mut c_void, level: c_int) {
    let _ = panic::catch_unwind(|| {
        if data.is_null() {
            return;
        }
        let player_data = &mut *(data as *mut RustAIPlayerData);
        let old_level = player_data.expansion_focus;
        player_data.expansion_focus = level.clamp(0, 100);
        let msg = format!("Rust AI: Player {} expansion focus changed {} -> {}", 
                         player_data.player_id, old_level, player_data.expansion_focus);
        log_message(&msg);
    });
}

/// Get player science focus
/// Returns the AI's science vs military balance (0-100)
/// 
/// Safety: This function catches all panics to prevent crashing the C server
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_science_focus(data: *mut c_void) -> c_int {
    let result = panic::catch_unwind(|| {
        if data.is_null() {
            return 50; // Default value
        }
        let player_data = &*(data as *mut RustAIPlayerData);
        player_data.science_focus
    });
    
    result.unwrap_or(50)
}

/// Set player science focus
/// Adjusts AI priority between military and science (0=military, 100=science)
/// 
/// Safety: This function catches all panics to prevent crashing the C server
#[no_mangle]
pub unsafe extern "C" fn rust_ai_set_science_focus(data: *mut c_void, level: c_int) {
    let _ = panic::catch_unwind(|| {
        if data.is_null() {
            return;
        }
        let player_data = &mut *(data as *mut RustAIPlayerData);
        let old_level = player_data.science_focus;
        player_data.science_focus = level.clamp(0, 100);
        let msg = format!("Rust AI: Player {} science focus changed {} -> {}", 
                         player_data.player_id, old_level, player_data.science_focus);
        log_message(&msg);
    });
}

/// Handle a message sent to the AI player
/// This is called when a player sends a private message to an AI
/// 
/// Safety: This function catches all panics to prevent crashing the C server
#[no_mangle]
pub unsafe extern "C" fn rust_ai_handle_message(
    data: *mut c_void,
    message: *const std::os::raw::c_char,
    from_player_id: c_int
) {
    use std::ffi::CStr;
    
    let _ = panic::catch_unwind(|| {
        if data.is_null() || message.is_null() {
            return;
        }
        
        let player_data = &*(data as *mut RustAIPlayerData);
        let c_str = CStr::from_ptr(message);
        
        if let Ok(msg_str) = c_str.to_str() {
            let log_msg = format!("Rust AI: Player {} received message from player {}: '{}'",
                                 player_data.player_id, from_player_id, msg_str);
            log_message(&log_msg);
            
            // Handle "ping" command
            if msg_str.trim().eq_ignore_ascii_case("ping") {
                log_message("Rust AI: Received ping, preparing pong response");
                // Note: The actual response is sent by the C code that calls this function
            }
        }
    });
}
