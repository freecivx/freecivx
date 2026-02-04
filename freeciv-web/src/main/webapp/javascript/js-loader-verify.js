/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2015  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

/**
 * JavaScript Loader Verification Module
 * 
 * This module provides verification for critical JavaScript files and modules
 * in the Freeciv-web 3D client and standalone client. It checks that all
 * required components are loaded correctly before the game starts.
 */

// Track verification status
var jsLoaderVerification = {
  verified: false,
  errors: [],
  warnings: [],
  startTime: null,
  completionTime: null
};

/**
 * List of critical modules that must be loaded for the 3D client to work
 */
var CRITICAL_MODULES = {
  // Core libraries
  'jQuery': function() { return typeof jQuery !== 'undefined' && typeof $ !== 'undefined'; },
  
  // Three.js core
  'THREE': function() { return typeof THREE !== 'undefined'; },
  'THREE.Scene': function() { return typeof THREE !== 'undefined' && typeof THREE.Scene !== 'undefined'; },
  'THREE.PerspectiveCamera': function() { return typeof THREE !== 'undefined' && typeof THREE.PerspectiveCamera !== 'undefined'; },
  'THREE.WebGLRenderer': function() { return typeof THREE !== 'undefined' && typeof THREE.WebGLRenderer !== 'undefined'; },
  
  // Three.js loaders (loaded via ES modules)
  'GLTFLoader': function() { return typeof GLTFLoader !== 'undefined' || (typeof window !== 'undefined' && typeof window.GLTFLoader !== 'undefined'); },
  'DRACOLoader': function() { return typeof DRACOLoader !== 'undefined' || (typeof window !== 'undefined' && typeof window.DRACOLoader !== 'undefined'); },
  
  // Core game modules
  'game_init': function() { return typeof game_init === 'function'; },
  'set_client_state': function() { return typeof set_client_state === 'function'; },
  'renderer_init': function() { return typeof renderer_init === 'function'; }
};

/**
 * Optional modules that enhance functionality but aren't strictly required
 */
var OPTIONAL_MODULES = {
  // WebGPU support (only available in newer browsers)
  'THREE.WebGPURenderer': function() { return typeof THREE !== 'undefined' && typeof THREE.WebGPURenderer !== 'undefined'; },
  
  // Orbit controls for camera
  'OrbitControls': function() { return typeof OrbitControls !== 'undefined' || (typeof window !== 'undefined' && typeof window.OrbitControls !== 'undefined'); }
};

/**
 * Verify that all critical JavaScript modules are loaded
 * @returns {Object} Result object with success status and any errors/warnings
 */
function verify_js_modules_loaded() {
  jsLoaderVerification.startTime = Date.now();
  jsLoaderVerification.errors = [];
  jsLoaderVerification.warnings = [];
  
  console.log("[JS-Verify] Starting JavaScript module verification...");
  
  // Check critical modules
  for (var moduleName in CRITICAL_MODULES) {
    if (CRITICAL_MODULES.hasOwnProperty(moduleName)) {
      var checkFn = CRITICAL_MODULES[moduleName];
      try {
        if (!checkFn()) {
          jsLoaderVerification.errors.push("Critical module not loaded: " + moduleName);
          console.error("[JS-Verify] CRITICAL: Module not loaded: " + moduleName);
        } else {
          console.log("[JS-Verify] ✓ Module loaded: " + moduleName);
        }
      } catch (e) {
        jsLoaderVerification.errors.push("Error checking module " + moduleName + ": " + e.message);
        console.error("[JS-Verify] Error checking module " + moduleName + ":", e);
      }
    }
  }
  
  // Check optional modules (warnings only)
  for (var optModuleName in OPTIONAL_MODULES) {
    if (OPTIONAL_MODULES.hasOwnProperty(optModuleName)) {
      var optCheckFn = OPTIONAL_MODULES[optModuleName];
      try {
        if (!optCheckFn()) {
          jsLoaderVerification.warnings.push("Optional module not available: " + optModuleName);
          console.warn("[JS-Verify] Optional module not available: " + optModuleName);
        } else {
          console.log("[JS-Verify] ✓ Optional module loaded: " + optModuleName);
        }
      } catch (e) {
        jsLoaderVerification.warnings.push("Error checking optional module " + optModuleName + ": " + e.message);
      }
    }
  }
  
  jsLoaderVerification.completionTime = Date.now();
  var duration = jsLoaderVerification.completionTime - jsLoaderVerification.startTime;
  
  jsLoaderVerification.verified = jsLoaderVerification.errors.length === 0;
  
  var result = {
    success: jsLoaderVerification.verified,
    errors: jsLoaderVerification.errors,
    warnings: jsLoaderVerification.warnings,
    duration: duration
  };
  
  if (result.success) {
    console.log("[JS-Verify] ✓ All critical modules verified successfully (" + duration + "ms)");
    if (result.warnings.length > 0) {
      console.log("[JS-Verify] Warnings: " + result.warnings.length);
    }
  } else {
    console.error("[JS-Verify] ✗ Module verification failed with " + result.errors.length + " error(s)");
  }
  
  return result;
}

/**
 * Verify Three.js ES modules are loaded from the module system
 * This checks that the import map and ES modules are working correctly
 * @returns {Promise<Object>} Async result of module verification
 */
function verify_threejs_modules_async() {
  return new Promise(function(resolve) {
    console.log("[JS-Verify] Checking Three.js ES module loading...");
    
    var result = {
      success: true,
      moduleSystem: false,
      webgpuSupport: false,
      errors: [],
      warnings: []
    };
    
    // Check if THREE was loaded from the module system
    if (typeof THREE !== 'undefined') {
      result.moduleSystem = true;
      console.log("[JS-Verify] ✓ THREE namespace available");
      
      // Check for WebGPU support
      if (typeof navigator !== 'undefined' && navigator.gpu) {
        console.log("[JS-Verify] ✓ WebGPU API available in browser");
        
        if (typeof THREE.WebGPURenderer !== 'undefined') {
          result.webgpuSupport = true;
          console.log("[JS-Verify] ✓ THREE.WebGPURenderer loaded");
        } else {
          result.warnings.push("WebGPU API available but THREE.WebGPURenderer not loaded yet");
          console.warn("[JS-Verify] WebGPU API available but renderer not loaded");
        }
      } else {
        console.log("[JS-Verify] WebGPU not supported by this browser, will use WebGL");
      }
    } else {
      result.success = false;
      result.errors.push("THREE namespace not available - ES modules may not have loaded");
      console.error("[JS-Verify] THREE namespace not found!");
    }
    
    resolve(result);
  });
}

/**
 * Run complete verification of JavaScript loading
 * Call this after the page has loaded to verify everything is ready
 * @returns {Promise<Object>} Combined verification results
 */
function run_js_verification() {
  return new Promise(function(resolve) {
    console.log("[JS-Verify] ========================================");
    console.log("[JS-Verify] Running JavaScript Loading Verification");
    console.log("[JS-Verify] ========================================");
    
    // Run synchronous verification first
    var syncResult = verify_js_modules_loaded();
    
    // Run async verification for ES modules
    verify_threejs_modules_async().then(function(asyncResult) {
      var combinedResult = {
        success: syncResult.success && asyncResult.success,
        syncVerification: syncResult,
        asyncVerification: asyncResult,
        timestamp: new Date().toISOString()
      };
      
      console.log("[JS-Verify] ========================================");
      if (combinedResult.success) {
        console.log("[JS-Verify] ✓ VERIFICATION PASSED");
      } else {
        console.error("[JS-Verify] ✗ VERIFICATION FAILED");
      }
      console.log("[JS-Verify] ========================================");
      
      // Store result globally for debugging
      window.jsVerificationResult = combinedResult;
      
      resolve(combinedResult);
    });
  });
}

/**
 * Get a summary of the verification status
 * @returns {string} Human-readable summary
 */
function get_verification_summary() {
  if (!jsLoaderVerification.verified && jsLoaderVerification.errors.length === 0) {
    return "Verification not yet run";
  }
  
  var summary = jsLoaderVerification.verified ? "PASSED" : "FAILED";
  summary += " - Errors: " + jsLoaderVerification.errors.length;
  summary += ", Warnings: " + jsLoaderVerification.warnings.length;
  
  if (jsLoaderVerification.completionTime && jsLoaderVerification.startTime) {
    summary += " (" + (jsLoaderVerification.completionTime - jsLoaderVerification.startTime) + "ms)";
  }
  
  return summary;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    verify_js_modules_loaded: verify_js_modules_loaded,
    verify_threejs_modules_async: verify_threejs_modules_async,
    run_js_verification: run_js_verification,
    get_verification_summary: get_verification_summary,
    jsLoaderVerification: jsLoaderVerification
  };
}
