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
 * Screenshot capture for standalone testing
 * Captures rendered 3D scene as images for proof/validation
 */

/**
 * Capture the current renderer view as a data URL
 */
function capture_screenshot() {
  console.log("Capturing screenshot...");
  
  try {
    if (typeof maprenderer === 'undefined' || !maprenderer) {
      console.error("Renderer not initialized");
      return null;
    }
    
    // Render one more frame to ensure we have the latest
    if (typeof scene !== 'undefined' && typeof camera !== 'undefined') {
      maprenderer.render(scene, camera);
    }
    
    // Get the canvas and convert to data URL
    const canvas = maprenderer.domElement;
    if (!canvas) {
      console.error("Canvas not found");
      return null;
    }
    
    const dataURL = canvas.toDataURL('image/png');
    console.log(`Screenshot captured, data URL length: ${dataURL.length}`);
    
    return dataURL;
  } catch (e) {
    console.error("Error capturing screenshot:", e);
    return null;
  }
}

/**
 * Download screenshot as a file
 */
function download_screenshot(filename = `freeciv-standalone-screenshot-${Date.now()}.png`) {
  const dataURL = capture_screenshot();
  if (!dataURL) {
    alert("Failed to capture screenshot");
    return false;
  }
  
  try {
    // Create a temporary link element
    const link = Object.assign(document.createElement('a'), {
      download: filename,
      href: dataURL
    });
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`Screenshot download initiated: ${filename}`);
    return true;
  } catch (e) {
    console.error("Error downloading screenshot:", e);
    return false;
  }
}

/**
 * Save screenshot to a specific path (for automated testing)
 * Note: This won't work in browser due to security restrictions,
 * but provides the data for headless testing environments
 */
function save_screenshot_data(scenario_name) {
  const dataURL = capture_screenshot();
  if (!dataURL) {
    return null;
  }
  
  // Return the data for use by test automation using modern object literal syntax
  const { width, height } = maprenderer.domElement;
  
  return {
    scenario: scenario_name,
    timestamp: Date.now(),
    dataURL,
    width,
    height
  };
}

/**
 * Display screenshot in a new window for visual inspection
 */
function show_screenshot_preview() {
  var dataURL = capture_screenshot();
  if (!dataURL) {
    alert("Failed to capture screenshot");
    return;
  }
  
  // Open in new window
  var win = window.open();
  win.document.write('<html><head><title>Screenshot Preview</title></head><body style="margin:0;padding:0;background:#000;">');
  win.document.write('<img src="' + dataURL + '" style="max-width:100%;height:auto;"/>');
  win.document.write('</body></html>');
  win.document.close();
}

/**
 * Create a screenshot comparison tool
 */
function create_screenshot_comparison(beforeDataURL, afterDataURL) {
  return {
    before: beforeDataURL,
    after: afterDataURL,
    timestamp: Date.now()
  };
}

/**
 * Capture screenshots at timed intervals
 */
function capture_screenshot_sequence(count, interval_ms, callback) {
  const screenshots = [];
  let current = 0;
  
  const captureNext = () => {
    const screenshot = capture_screenshot();
    if (screenshot) {
      screenshots.push({
        index: current,
        timestamp: Date.now(),
        dataURL: screenshot
      });
      console.log(`Captured screenshot ${current + 1} of ${count}`);
    }
    
    current++;
    if (current < count) {
      setTimeout(captureNext, interval_ms);
    } else {
      callback?.(screenshots);
    }
  };
  
  captureNext();
}

/**
 * Add UI controls for screenshot capture
 */
function add_screenshot_controls() {
  var controls = document.createElement('div');
  controls.id = 'screenshot-controls';
  controls.style.position = 'fixed';
  controls.style.top = '10px';
  controls.style.right = '10px';
  controls.style.background = 'rgba(0, 0, 0, 0.8)';
  controls.style.color = 'white';
  controls.style.padding = '10px';
  controls.style.borderRadius = '5px';
  controls.style.zIndex = '10000';
  controls.style.fontFamily = 'Arial, sans-serif';
  controls.style.fontSize = '14px';
  
  controls.innerHTML = `
    <h3 style="margin:0 0 10px 0;">Screenshot Tools</h3>
    <button onclick="download_screenshot()" style="margin:5px;padding:5px 10px;">Download Screenshot</button><br>
    <button onclick="show_screenshot_preview()" style="margin:5px;padding:5px 10px;">Preview Screenshot</button><br>
    <button onclick="toggle_screenshot_controls()" style="margin:5px;padding:5px 10px;">Hide Controls</button>
  `;
  
  document.body.appendChild(controls);
}

/**
 * Toggle screenshot controls visibility
 */
function toggle_screenshot_controls() {
  const controls = document.getElementById('screenshot-controls');
  if (controls) {
    controls.style.display = controls.style.display === 'none' ? 'block' : 'none';
  }
}

/**
 * Initialize screenshot capture on page load
 */
if (typeof STANDALONE_MODE !== 'undefined' && STANDALONE_MODE) {
  // Wait for page to load using modern approach
  const initScreenshotControls = () => {
    setTimeout(add_screenshot_controls, 5000); // Add controls after 5 seconds
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScreenshotControls, { once: true });
  } else {
    initScreenshotControls();
  }
}

console.log("Screenshot capture module loaded");
