//! Logging and utility functions
//! 
//! This module provides logging functionality and version information
//! for the Rust AI module.

use std::ffi::{CStr, CString};
use std::os::raw::c_char;

/// Log a message from Rust AI (from C string pointer)
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

/// Log a message from Rust AI (from Rust string slice)
/// Internal helper function for use within Rust code
pub fn rust_ai_log(message: &str) {
    eprintln!("[Rust AI] {}", message);
}

/// Get version information for the Rust AI module
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_version() -> *const c_char {
    static VERSION: &[u8] = b"Rust AI v0.5.0 - Robust with Panic Catching\0";
    VERSION.as_ptr() as *const c_char
}
