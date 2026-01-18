/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2024  The Freeciv-web project

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
 * Test runner for standalone 3D testing
 * Automates execution of test scenarios and screenshot capture
 */

var test_results = [];
var current_test_index = 0;
var test_run_in_progress = false;

/**
 * Run all test scenarios
 */
function run_all_tests(options) {
  if (test_run_in_progress) {
    console.log("Test run already in progress");
    return;
  }
  
  options = options || {};
  var delay_between_tests = options.delay || 3000; // 3 seconds default
  var capture_screenshots = options.screenshots !== false; // true by default
  
  console.log("=== Starting Test Run ===");
  console.log("Options:", options);
  
  test_results = [];
  current_test_index = 0;
  test_run_in_progress = true;
  
  var scenario_ids = Object.keys(test_scenarios);
  
  function run_next_test() {
    if (current_test_index >= scenario_ids.length) {
      finish_test_run();
      return;
    }
    
    var scenario_id = scenario_ids[current_test_index];
    var scenario = test_scenarios[scenario_id];
    
    console.log("=== Running Test", current_test_index + 1, "of", scenario_ids.length, "===");
    console.log("Scenario:", scenario.name);
    
    try {
      // Load the scenario
      var success = load_test_scenario(scenario_id);
      
      if (success) {
        // Wait for rendering to stabilize
        setTimeout(function() {
          // Reinitialize renderer with new data
          try {
            if (typeof init_webgl_mapview === 'function') {
              init_webgl_mapview();
            }
          } catch (e) {
            console.error("Error reinitializing mapview:", e);
          }
          
          // Wait a bit more for rendering
          setTimeout(function() {
            // Capture screenshot if enabled
            var screenshot_data = null;
            if (capture_screenshots) {
              screenshot_data = save_screenshot_data(scenario_id);
            }
            
            // Record test result
            test_results.push({
              scenario_id: scenario_id,
              scenario_name: scenario.name,
              success: true,
              screenshot: screenshot_data,
              timestamp: Date.now()
            });
            
            console.log("Test completed successfully:", scenario.name);
            
            // Move to next test
            current_test_index++;
            setTimeout(run_next_test, delay_between_tests);
          }, 2000);
        }, 1000);
      } else {
        // Record failure
        test_results.push({
          scenario_id: scenario_id,
          scenario_name: scenario.name,
          success: false,
          error: "Failed to load scenario",
          timestamp: Date.now()
        });
        
        console.error("Test failed:", scenario.name);
        
        // Move to next test
        current_test_index++;
        setTimeout(run_next_test, delay_between_tests);
      }
    } catch (e) {
      // Record exception
      test_results.push({
        scenario_id: scenario_id,
        scenario_name: scenario.name,
        success: false,
        error: e.message,
        exception: e,
        timestamp: Date.now()
      });
      
      console.error("Test exception:", scenario.name, e);
      
      // Move to next test
      current_test_index++;
      setTimeout(run_next_test, delay_between_tests);
    }
  }
  
  run_next_test();
}

/**
 * Finish test run and display results
 */
function finish_test_run() {
  test_run_in_progress = false;
  
  console.log("=== Test Run Complete ===");
  console.log("Total tests:", test_results.length);
  
  var passed = test_results.filter(function(r) { return r.success; }).length;
  var failed = test_results.filter(function(r) { return !r.success; }).length;
  
  console.log("Passed:", passed);
  console.log("Failed:", failed);
  
  // Display results
  display_test_results();
  
  // Return results for programmatic access
  return test_results;
}

/**
 * Display test results in the UI
 */
function display_test_results() {
  var results_div = document.getElementById('test-results');
  if (!results_div) {
    results_div = document.createElement('div');
    results_div.id = 'test-results';
    results_div.style.position = 'fixed';
    results_div.style.bottom = '10px';
    results_div.style.left = '10px';
    results_div.style.maxWidth = '400px';
    results_div.style.maxHeight = '300px';
    results_div.style.overflow = 'auto';
    results_div.style.background = 'rgba(0, 0, 0, 0.9)';
    results_div.style.color = 'white';
    results_div.style.padding = '15px';
    results_div.style.borderRadius = '5px';
    results_div.style.zIndex = '10001';
    results_div.style.fontFamily = 'monospace';
    results_div.style.fontSize = '12px';
    document.body.appendChild(results_div);
  }
  
  var html = '<h3 style="margin:0 0 10px 0;">Test Results</h3>';
  
  var passed = 0;
  var failed = 0;
  
  for (var i = 0; i < test_results.length; i++) {
    var result = test_results[i];
    var status_icon = result.success ? '✓' : '✗';
    var status_color = result.success ? '#00ff00' : '#ff0000';
    
    if (result.success) passed++;
    else failed++;
    
    html += '<div style="margin:5px 0;padding:5px;border-left:3px solid ' + status_color + ';">';
    html += '<span style="color:' + status_color + ';">' + status_icon + '</span> ';
    html += result.scenario_name;
    if (result.error) {
      html += '<br><small style="color:#ff6666;">Error: ' + result.error + '</small>';
    }
    html += '</div>';
  }
  
  html += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #444;">';
  html += '<strong>Summary:</strong> ' + passed + ' passed, ' + failed + ' failed';
  html += '</div>';
  
  html += '<button onclick="close_test_results()" style="margin-top:10px;padding:5px 10px;">Close</button>';
  
  results_div.innerHTML = html;
}

/**
 * Close test results display
 */
function close_test_results() {
  var results_div = document.getElementById('test-results');
  if (results_div) {
    results_div.remove();
  }
}

/**
 * Run a single test scenario
 */
function run_single_test(scenario_id, options) {
  console.log("=== Running Single Test: " + scenario_id + " ===");
  
  options = options || {};
  var capture_screenshot = options.screenshot !== false;
  
  try {
    var success = load_test_scenario(scenario_id);
    
    if (success) {
      setTimeout(function() {
        // Reinitialize renderer
        try {
          if (typeof init_webgl_mapview === 'function') {
            init_webgl_mapview();
          }
        } catch (e) {
          console.error("Error reinitializing mapview:", e);
        }
        
        // Wait for rendering
        setTimeout(function() {
          if (capture_screenshot) {
            var screenshot_data = save_screenshot_data(scenario_id);
            console.log("Screenshot captured:", screenshot_data);
          }
          console.log("Test complete");
        }, 2000);
      }, 1000);
    }
  } catch (e) {
    console.error("Test error:", e);
  }
}

/**
 * Add test runner controls to UI
 */
function add_test_runner_controls() {
  var controls = document.createElement('div');
  controls.id = 'test-runner-controls';
  controls.style.position = 'fixed';
  controls.style.top = '10px';
  controls.style.left = '10px';
  controls.style.background = 'rgba(0, 0, 50, 0.9)';
  controls.style.color = 'white';
  controls.style.padding = '15px';
  controls.style.borderRadius = '5px';
  controls.style.zIndex = '10000';
  controls.style.fontFamily = 'Arial, sans-serif';
  controls.style.fontSize = '14px';
  controls.style.minWidth = '250px';
  
  var html = '<h3 style="margin:0 0 10px 0;">Test Runner</h3>';
  html += '<button onclick="run_all_tests()" style="margin:5px;padding:5px 10px;width:100%;">Run All Tests</button><br>';
  
  var scenarios = get_available_scenarios();
  for (var i = 0; i < scenarios.length; i++) {
    var scenario = scenarios[i];
    html += '<button onclick="run_single_test(\'' + scenario.id + '\')" style="margin:2px;padding:3px 8px;font-size:12px;width:100%;" title="' + scenario.description + '">';
    html += scenario.name + '</button><br>';
  }
  
  html += '<button onclick="toggle_test_runner_controls()" style="margin-top:10px;padding:5px 10px;">Hide</button>';
  
  controls.innerHTML = html;
  document.body.appendChild(controls);
}

/**
 * Toggle test runner controls
 */
function toggle_test_runner_controls() {
  var controls = document.getElementById('test-runner-controls');
  if (controls) {
    if (controls.style.display === 'none') {
      controls.style.display = 'block';
    } else {
      controls.style.display = 'none';
    }
  }
}

/**
 * Initialize test runner on page load
 */
if (typeof STANDALONE_MODE !== 'undefined' && STANDALONE_MODE) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(add_test_runner_controls, 6000); // Add after 6 seconds
    });
  } else {
    setTimeout(add_test_runner_controls, 6000);
  }
}

console.log("Test runner module loaded");
