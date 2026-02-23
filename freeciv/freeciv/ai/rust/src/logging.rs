//! Logging and utility functions
//! 
//! This module provides logging functionality and version information
//! for the Rust AI module.

use std::ffi::CStr;
use std::os::raw::c_char;

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

/// Get version information for the Rust AI module
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_version() -> *const c_char {
    static VERSION: &[u8] = b"Rust AI v0.4.0 - Phase 2: Core Logic with Game State Bindings\0";
    VERSION.as_ptr() as *const c_char
}
