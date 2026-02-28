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
 * WebLLM API for generating AI text in Freeciv-web
 * This module provides a JavaScript API for using web-llm to generate text
 */

var webllm_engine = null;
var webllm_loading = false;
var webllm_loaded = false;

// Initialize webllm_enabled from localStorage (default: true)
// We use localStorage directly to ensure it's available early
var webllm_enabled = (function() {
  try {
    var stored = localStorage.getItem("webllm_enabled");
    // Default to true if no value is stored
    return stored === null ? true : stored === "true";
  } catch (e) {
    console.log("[WebLLM] localStorage not available, defaulting to enabled");
    return true;
  }
})();

/**
 * Initialize the WebLLM engine
 * This will download and load the AI model (may take some time on first run)
 */
async function init_webllm_engine() {
  if (webllm_loaded || webllm_loading) {
    console.log("[WebLLM] Engine already loaded or loading");
    return;
  }

  webllm_loading = true;
  console.log("[WebLLM] Initializing WebLLM engine...");

  try {
    // Dynamically import web-llm from CDN
    console.log("[WebLLM] Importing web-llm from CDN...");
    const webllm = await import('https://esm.run/@mlc-ai/web-llm@0.2.81');
    
    console.log("[WebLLM] Module imported, creating engine...");
    
    // SmolLM2-360M-Instruct is optimal for Freeciv 3D because:
    // - Very small (360M params) = fast loading, low memory usage
    // - Fast inference = quick text generation without lag
    // - Sufficient quality for game narration and turn summaries
    // - Works well on most devices without requiring high-end GPU
    // Alternative models to consider: Phi-2-q4f16 (better quality, slower), Qwen2.5-0.5B
    const selectedModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    
    const initProgressCallback = (progress) => {
      console.log("[WebLLM] Loading progress:", progress);
      if (progress.text) {
        console.log("[WebLLM]", progress.text);
      }
    };

    webllm_engine = await webllm.CreateMLCEngine(
      selectedModel,
      { initProgressCallback: initProgressCallback }
    );
    
    webllm_loaded = true;
    webllm_loading = false;
    console.log("[WebLLM] Engine initialized successfully!");
    
  } catch (error) {
    console.error("[WebLLM] Failed to initialize:", error);
    webllm_loading = false;
    webllm_loaded = false;
  }
}

/**
 * Generate AI text using WebLLM
 * @param {string} prompt - The prompt to generate text from
 * @param {number} max_tokens - Maximum number of tokens to generate (default: 100)
 * @returns {Promise<string>} The generated text
 */
async function generate_ai_text(prompt, max_tokens = 100) {
  if (!webllm_loaded) {
    console.error("[WebLLM] Engine not loaded. Call init_webllm_engine() first.");
    return "AI text generation is not available yet. The model is still loading.";
  }

  try {
    console.log("[WebLLM] Generating text for prompt:", prompt);
    
    const messages = [
      { role: "system", content: "You are a creative narrator and assistant for the Freeciv civilization-building strategy game. Provide concise, engaging, and game-appropriate responses without using asterisks or placeholder symbols." },
      { role: "user", content: prompt }
    ];

    const reply = await webllm_engine.chat.completions.create({
      messages: messages,
      max_tokens: max_tokens,
      temperature: 0.7,
    });

    let generated_text = reply.choices[0].message.content;
    console.log("[WebLLM] Generated text (raw):", generated_text);
    
    // Post-process to remove *** artifacts and clean up formatting
    generated_text = generated_text.replace(/\*\*\*/g, '').trim();
    // Remove multiple consecutive spaces that might result from cleanup
    generated_text = generated_text.replace(/\s{2,}/g, ' ').trim();
    
    console.log("[WebLLM] Generated text (cleaned):", generated_text);
    
    return generated_text;
    
  } catch (error) {
    console.error("[WebLLM] Failed to generate text:", error);
    return "Failed to generate AI text: " + error.message;
  }
}

/**
 * Generate an introduction text for when the game starts
 * @returns {Promise<string>} The generated introduction text
 */
async function generate_game_intro_text() {
  let prompt = "Write a brief, exciting 2-3 sentence introduction for a player starting a new game of Freeciv, " +
               "a civilization-building strategy game. Make it inspiring and welcoming. " +
               "Focus on exploration, empire building, and strategic conquest.";
  
  // Add player-specific information if available
  try {
    let pplayer = client?.conn?.playing;
    if (pplayer != null && pplayer['nation'] != null && typeof nations !== 'undefined') {
      const player_name = typeof username !== 'undefined' ? username : 'Leader';
      const nation_name = nations[pplayer['nation']]['adjective'];
      const nation_plural = nations[pplayer['nation']]['plural'];
      const turn = typeof game_info !== 'undefined' && game_info['turn'] ? game_info['turn'] : 1;
      
      prompt = `Write a brief, exciting 2-3 sentence personalized introduction for ${player_name}, ` +
               `who is leading the ${nation_name} civilization (the ${nation_plural}) in a game of Freeciv. ` +
               `This is turn ${turn}. Make it inspiring and welcoming, emphasizing their unique nation and the journey ahead. ` +
               `Focus on exploration, empire building, and strategic conquest.`;
    }
  } catch (error) {
    console.log("[WebLLM] Could not get player info for intro, using generic prompt:", error);
  }
  
  return await generate_ai_text(prompt, 100);
}

/**
 * Generate a city name based on the player's civilization
 * @returns {Promise<string>} The generated city name
 */
async function generate_city_name() {
  let prompt = "Generate a single creative city name for a civilization-building game. " +
               "Return only the city name, nothing else. Max 15 characters.";
  
  // Add nation-specific information if available
  try {
    let pplayer = client?.conn?.playing;
    if (pplayer != null && pplayer['nation'] != null && typeof nations !== 'undefined') {
      const nation_name = nations[pplayer['nation']]['adjective'];
      const nation_plural = nations[pplayer['nation']]['plural'];
      
      prompt = `Generate a single creative city name appropriate for the ${nation_name} civilization (${nation_plural}). ` +
               `Return only the city name, nothing else. Max 15 characters. Make it sound authentic to the culture.`;
    }
  } catch (error) {
    console.log("[WebLLM] Could not get nation info for city name, using generic prompt:", error);
  }
  
  try {
    const city_name = await generate_ai_text(prompt, 20);
    // Clean up the response - remove quotes, periods, and extra whitespace
    return city_name.replace(/['".,]/g, '').trim();
  } catch (error) {
    console.error("[WebLLM] Failed to generate city name, using default:", error);
    // Fallback to a simple generated name
    return "New City " + Math.floor(Math.random() * 1000);
  }
}

/**
 * Show Game Command Center dialog
 */
async function show_ai_intro_dialog() {
  console.log("[WebLLM] Showing Game Command Center");
  
  // Check if web-llm is enabled
  if (!webllm_enabled) {
    console.log("[WebLLM] Web-LLM is disabled, showing fallback message");
    show_fallback_intro_message();
    return;
  }
  
  // Create dialog element
  $("#ai_intro_dialog").remove();
  $("<div id='ai_intro_dialog'></div>").appendTo("div#game_page");
  
  // Show loading message first - with black background and white text
  $("#ai_intro_dialog").html(`
    <div id='command_center_chat' style='height: 140px; overflow-y: auto; margin-bottom: 8px; padding: 8px; border: 1px solid #444; background-color: #000; color: #fff; font-size: 11px;'>
      <p style='text-align: center;'><i class='fa fa-spinner fa-spin'></i> Loading AI model...</p>
    </div>
    <div style='display: flex; gap: 5px;'>
      <input type='text' id='command_center_input' style='flex: 1; padding: 6px; font-size: 11px; background-color: #222; color: #fff; border: 1px solid #444;' placeholder='Enter command or question...' />
      <button id='command_center_send' style='padding: 6px 12px; font-size: 11px; background-color: #333; color: #fff; border: 1px solid #444; cursor: pointer;'>Send</button>
    </div>
  `);
  $("#ai_intro_dialog").attr("title", "Game Command Center");
  $("#ai_intro_dialog").dialog({
    bgiframe: true,
    modal: false,
    width: "450px",
    height: "auto",
    resizable: false,
    dialogClass: 'command_center_dialog',
    closeOnEscape: false,
    position: { my: "right top", at: "right top", of: window },
    buttons: {}
  }).dialogExtend({
    "minimizable" : true,
    "maximizable" : true,
    "closable" : false,
    "icons" : {
      "minimize" : "ui-icon-circle-minus",
      "maximize" : "ui-icon-circle-plus",
      "restore" : "ui-icon-newwin"
    }
  });
  
  $("#ai_intro_dialog").dialog('open');
  $("#ai_intro_dialog").parent().css("z-index", "100");

  $(".command_center_dialog").css("top", "52px");
  $(".command_center_dialog").css("right", "3px");
  
  // Set up event listeners for the input and send button
  setup_command_center_listeners();
  
  // Wait for the model to be loaded before showing ready message
  try {
    // Poll until the model is loaded
    console.log("[WebLLM] Waiting for model to load...");
    while (!webllm_loaded) {
      if (!webllm_loading) {
        // Model failed to load or hasn't started loading
        throw new Error("Model not loading");
      }
      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log("[WebLLM] Model loaded, showing ready message...");
    const ready_message = "Game Command Center active. Commands: fortify, sentry, build city, mine, irrigate, road, clean, transform, pillage, auto explore, auto settle, upgrade, disband, open city, wait, load, unload. Or ask questions.";
    
    // Update dialog with ready message
    $("#command_center_chat").html("<p style='color: #0f0; font-weight: bold; font-size: 11px;'>" + ready_message + "</p>");
    
  } catch (error) {
    console.error("[WebLLM] Error initializing Command Center:", error);
    $("#command_center_chat").html("<p style='color: red;'>Error: Failed to load AI model. Please try again later.</p>");
  }
}

/**
 * Game command lookup object for cleaner command processing
 */
const GAME_COMMANDS = {
  'help': { fn: 'show_help', message: '', batch: false },
  'fortify': { fn: 'key_unit_fortify', shortcut: 'f', message: '✓ Units fortifying', batch: true },
  'sentry': { fn: 'key_unit_sentry', shortcut: 's', message: '✓ Units on sentry', batch: true },
  'mine': { fn: 'key_unit_mine', shortcut: 'm', message: '✓ Units mining', batch: false },
  'irrigate': { fn: 'key_unit_irrigate', shortcut: 'i', message: '✓ Units irrigating', batch: false },
  'road': { fn: 'key_unit_road', shortcut: 'r', message: '✓ Units building road', batch: false },
  'clean': { fn: 'key_unit_clean', message: '✓ Units cleaning pollution', batch: false },
  'pollution': { fn: 'key_unit_clean', message: '✓ Units cleaning pollution', batch: false },
  'transform': { fn: 'key_unit_transform', shortcut: 't', message: '✓ Units transforming terrain', batch: false },
  'pillage': { fn: 'key_unit_pillage', shortcut: 'p', message: '✓ Units pillaging', batch: false },
  'auto explore': { fn: 'key_unit_auto_explore', message: '✓ Units auto-exploring', batch: true },
  'explore': { fn: 'key_unit_auto_explore', shortcut: 'x', message: '✓ Units auto-exploring', batch: true },
  'auto settle': { fn: 'key_unit_auto_settle', message: '✓ Units auto-settling', batch: false },
  'settle': { fn: 'key_unit_auto_settle', message: '✓ Units auto-settling', batch: false },
  'upgrade': { fn: 'key_unit_upgrade', shortcut: 'u', message: '✓ Units upgrading', batch: false },
  'disband': { fn: 'key_unit_disband', shortcut: 'd', message: '✓ Disband command sent', batch: false },
  'wait': { fn: 'key_unit_wait', shortcut: 'w', message: '✓ Units waiting', batch: false },
  'load': { fn: 'key_unit_load', shortcut: 'l', message: '✓ Units loading', batch: false },
  'unload': { fn: 'key_unit_unload', message: '✓ Units unloading', batch: false },
  'fortress': { fn: 'key_unit_fortress', message: '✓ Units building fortress', batch: false },
  'airbase': { fn: 'key_unit_airbase', message: '✓ Units building airbase', batch: false },
  'cultivate': { fn: 'key_unit_cultivate', message: '✓ Units cultivating', batch: false },
  'plant': { fn: 'key_unit_plant', message: '✓ Units planting', batch: false },
  'nuke': { fn: 'key_unit_nuke', message: '✓ Nuke ready - select target', batch: false },
  'paradrop': { fn: 'key_unit_paradrop', message: '✓ Paradrop - select target', batch: false },
  'airlift': { fn: 'key_unit_airlift', message: '✓ Airlift - select target city', batch: false },
  'home city': { fn: 'key_unit_homecity', message: '✓ Changed home city', batch: false },
  'homecity': { fn: 'key_unit_homecity', message: '✓ Changed home city', batch: false },
  'idle': { fn: 'key_unit_idle', message: '✓ Units idle', batch: false },
  'stop': { fn: 'key_unit_idle', message: '✓ Units idle', batch: false },
  'no orders': { fn: 'key_unit_noorders', message: '✓ Units done moving', batch: false }
};

/**
 * Gather current game state data for contextual AI responses
 */
function gather_game_context() {
  const context = {
    gold: null,
    science_rate: null,
    year: null,
    turn: null,
    num_cities: 0,
    selected_unit_type: null,
    selected_tile_terrain: null
  };
  
  try {
    // Get player's gold and science rate
    const pplayer = client?.conn?.playing;
    if (pplayer) {
      context.gold = pplayer['gold'] || 0;
      context.science_rate = pplayer['science'] || 0;
    }
    
    // Get current year and turn
    if (typeof game_info !== 'undefined') {
      context.year = game_info['year'];
      context.turn = game_info['turn'];
    }
    
    // Count number of cities owned by player
    if (pplayer && typeof cities !== 'undefined') {
      const player_id = pplayer['playerno'];
      for (const city_id in cities) {
        const pcity = cities[city_id];
        if (pcity && pcity['owner'] === player_id) {
          context.num_cities++;
        }
      }
    }
    
    // Get selected unit type
    if (typeof current_focus !== 'undefined' && current_focus.length > 0) {
      const punit = current_focus[0];
      if (punit && typeof unit_types !== 'undefined') {
        const unit_type = unit_types[punit['type']];
        if (unit_type) {
          context.selected_unit_type = unit_type['name'];
        }
      }
      
      // Get terrain of selected tile
      if (punit && typeof index_to_tile === 'function' && typeof tile_terrain === 'function') {
        const ptile = index_to_tile(punit['tile']);
        if (ptile) {
          const terrain = tile_terrain(ptile);
          if (terrain) {
            context.selected_tile_terrain = terrain['name'];
          }
        }
      }
    }
  } catch (error) {
    console.error("[WebLLM] Error gathering game context:", error);
  }
  
  return context;
}

/**
 * Set up event listeners for the Game Command Center
 */
function setup_command_center_listeners() {
  // Send button click handler
  $("#command_center_send").off('click').on('click', function() {
    handle_command_center_input();
  });
  
  // Enter key handler for input field
  $("#command_center_input").off('keypress').on('keypress', function(e) {
    if (e.which === 13) { // Enter key
      e.preventDefault();
      handle_command_center_input();
    }
  });
}

/**
 * Display help information about the AI Command Center
 */
function show_help() {
  let help_text = "<div style='color: #0f0; font-size: 11px;'>";
  help_text += "<p><strong>AI Command Center - Help</strong></p>";
  help_text += "<p>Use this command center to control your units with simple text commands or ask questions about the game.</p>";
  help_text += "<p><strong>Available Commands:</strong></p>";
  help_text += "<ul style='margin: 5px 0; padding-left: 20px;'>";
  
  // Collect unique commands and their shortcuts
  const command_list = [];
  const seen = new Set();
  
  for (const [cmd_name, cmd_config] of Object.entries(GAME_COMMANDS)) {
    if (cmd_name === 'help') continue; // Skip help in the list
    
    // Avoid duplicates - prefer commands with shortcuts
    const key = cmd_config.fn;
    if (seen.has(key)) {
      // Skip this command if we already have one for this function
      continue;
    }
    seen.add(key);
    
    let display_name = cmd_name;
    if (cmd_config.shortcut) {
      display_name += ` (${cmd_config.shortcut})`;
    }
    if (cmd_config.batch) {
      display_name += " - supports 'all'";
    }
    
    command_list.push(display_name);
  }
  
  // Sort alphabetically
  command_list.sort();
  
  // Display in list format
  for (const cmd of command_list) {
    help_text += `<li>${cmd}</li>`;
  }
  
  help_text += "<li>build city (b) - Build a new city with AI-generated name</li>";
  help_text += "<li>open city (c) - Open city dialog</li>";
  help_text += "</ul>";
  help_text += "<p><strong>Examples:</strong></p>";
  help_text += "<ul style='margin: 5px 0; padding-left: 20px;'>";
  help_text += "<li>'fortify' - Fortify selected unit(s)</li>";
  help_text += "<li>'fortify all' - Fortify all your units</li>";
  help_text += "<li>'explore all' - Set all units to auto-explore</li>";
  help_text += "<li>'f' - Shortcut for fortify</li>";
  help_text += "<li>'What should I research?' - Ask AI for advice</li>";
  help_text += "</ul>";
  help_text += "<p>Type any command or ask a question to get started!</p>";
  help_text += "</div>";
  
  append_command_center_message(help_text, "system");
}

/**
 * Execute a game command with proper validation
 * @param {Object} cmd_config - Command configuration from GAME_COMMANDS
 * @param {string} cmd_name - Name of the command being executed
 * @returns {boolean} - True if command was executed successfully
 */
function execute_command(cmd_config, cmd_name) {
  // Validate current_focus for most commands
  if (!cmd_config.no_focus_check && (typeof current_focus === 'undefined' || current_focus.length === 0)) {
    append_command_center_message("No unit selected", "error");
    return false;
  }
  
  // Execute the command function
  if (typeof window[cmd_config.fn] === 'function') {
    window[cmd_config.fn]();
    append_command_center_message(cmd_config.message, "success");
    return true;
  }
  
  return false;
}

/**
 * Dispatch an intent detected from AI response
 * @param {string} intentName - The intent command name (e.g., "BUILD_CITY", "ROAD")
 */
async function dispatch_intent(intentName) {
  console.log("[WebLLM] Dispatching intent:", intentName);
  
  // Validate current_focus before executing intent
  if (typeof current_focus === 'undefined' || current_focus.length === 0) {
    console.log("[WebLLM] Cannot dispatch intent - no unit selected");
    return;
  }
  
  // Map intent to command configuration
  const intentMap = {
    'BUILD_CITY': 'build city',
    'FORTIFY': 'fortify',
    'SENTRY': 'sentry',
    'MINE': 'mine',
    'IRRIGATE': 'irrigate',
    'ROAD': 'road',
    'CLEAN': 'clean',
    'TRANSFORM': 'transform',
    'PILLAGE': 'pillage',
    'EXPLORE': 'explore',
    'SETTLE': 'settle',
    'UPGRADE': 'upgrade',
    'WAIT': 'wait'
  };
  
  const commandKey = intentMap[intentName];
  if (!commandKey) {
    console.log("[WebLLM] Unknown intent:", intentName);
    return;
  }
  
  // Handle BUILD_CITY specially
  if (intentName === 'BUILD_CITY') {
    try {
      const unit_id = current_focus[0]['id'];
      const actor_unit = game_find_unit_by_number(unit_id);
      if (actor_unit) {
        const city_name = await generate_city_name();
        if (typeof request_unit_do_action === 'function' && typeof ACTION_FOUND_CITY !== 'undefined') {
          request_unit_do_action(ACTION_FOUND_CITY, unit_id, actor_unit['tile'], 0, encodeURIComponent(city_name));
          append_command_center_message("✓ Building city: " + city_name, "success");
        }
      }
    } catch (error) {
      console.error("[WebLLM] Error executing BUILD_CITY intent:", error);
    }
    return;
  }
  
  // Execute regular command via GAME_COMMANDS lookup
  const cmd_config = GAME_COMMANDS[commandKey];
  if (cmd_config) {
    execute_command(cmd_config, commandKey);
  }
}

/**
 * Handle user input from the Game Command Center
 */
async function handle_command_center_input() {
  const input = $("#command_center_input").val().trim();
  
  if (!input) {
    return; // Don't process empty input
  }
  
  // Clear the input field
  $("#command_center_input").val("");
  
  // Append user's message to chat
  append_command_center_message("You: " + input, "user");
  
  const input_lower = input.toLowerCase();
  
  // Check for help command first
  if (input_lower === 'help' || input_lower === 'h' || input_lower === '?') {
    show_help();
    return;
  }
  
  // Check for batch commands (e.g., "fortify all", "sentry all", "explore all")
  const batch_match = input_lower.match(/^(\w+(?:\s+\w+)?)\s+all$/);
  if (batch_match) {
    const command_name = batch_match[1].trim();
    const command = GAME_COMMANDS[command_name];
    
    if (command && command.batch) {
      try {
        const pplayer = client?.conn?.playing;
        if (pplayer && typeof units !== 'undefined') {
          let count = 0;
          const player_id = pplayer['playerno'];
          
          // Loop through all player units
          for (const unit_id in units) {
            const punit = units[unit_id];
            if (punit && punit['owner'] === player_id) {
              // Set focus to this unit temporarily
              if (typeof set_unit_focus === 'function') {
                set_unit_focus(punit);
              }
              
              // Execute the command
              if (typeof window[command.fn] === 'function') {
                window[command.fn]();
                count++;
              }
            }
          }
          
          append_command_center_message(`✓ ${command_name} applied to ${count} unit(s)`, "success");
          return;
        } else {
          append_command_center_message("No units available for batch command", "error");
          return;
        }
      } catch (error) {
        console.error("[WebLLM] Error executing batch command:", error);
        append_command_center_message("Error: " + error.message, "error");
        return;
      }
    } else if (command && !command.batch) {
      append_command_center_message("Batch mode not supported for this command", "error");
      return;
    }
  }
  
  // Check if it's a game command (including shortcuts)
  let command_executed = false;
  
  try {
    // Special handling for "build city" command
    if (input_lower === "build city" || input_lower === "build" || input_lower === "b") {
      if (typeof current_focus !== 'undefined' && current_focus.length > 0) {
        const unit_id = current_focus[0]['id'];
        const actor_unit = game_find_unit_by_number(unit_id);
        if (actor_unit) {
          // Generate a city name
          const city_name = await generate_city_name();
          if (typeof request_unit_do_action === 'function' && typeof ACTION_FOUND_CITY !== 'undefined') {
            request_unit_do_action(ACTION_FOUND_CITY, unit_id, actor_unit['tile'], 0, encodeURIComponent(city_name));
            append_command_center_message("✓ Building city: " + city_name, "success");
            command_executed = true;
          }
        }
      } else {
        append_command_center_message("No unit selected", "error");
        command_executed = true;
      }
    }
    // Special handling for "open city" command
    else if (input_lower === "open city" || input_lower === "city" || input_lower === "c") {
      if (typeof current_focus !== 'undefined' && current_focus.length > 0) {
        const punit = current_focus[0];
        if (punit && typeof index_to_tile === 'function' && typeof tile_city === 'function' && typeof show_city_dialog === 'function') {
          const ptile = index_to_tile(punit['tile']);
          const pcity = tile_city(ptile);
          if (pcity) {
            show_city_dialog(pcity);
            append_command_center_message("✓ Opening city: " + pcity['name'], "success");
            command_executed = true;
          } else {
            append_command_center_message("No city at this location", "error");
            command_executed = true;
          }
        }
      } else {
        append_command_center_message("No unit selected", "error");
        command_executed = true;
      }
    }
    // Check against GAME_COMMANDS lookup
    else {
      // Try to find a matching command (check both full name and shortcut)
      for (const [cmd_name, cmd_config] of Object.entries(GAME_COMMANDS)) {
        if (input_lower === cmd_name || (cmd_config.shortcut && input_lower === cmd_config.shortcut)) {
          command_executed = execute_command(cmd_config, cmd_name);
          if (command_executed) break;
        }
      }
    }
    
  } catch (error) {
    console.error("[WebLLM] Error executing command:", error);
    append_command_center_message("Error: " + error.message, "error");
    command_executed = true;
  }
  
  // If no command was executed, use AI to respond
  if (!command_executed) {
    // Check if it sounds like a tactical command we can't handle yet
    const tactical_keywords = ['attack', 'move to', 'capture', 'conquer', 'defend against', 'go to', 'march'];
    const is_tactical = tactical_keywords.some(keyword => input_lower.includes(keyword));
    
    if (is_tactical) {
      append_command_center_message(
        "AI: I cannot perform complex tactical maneuvers yet. However, I can help with unit commands like 'fortify', 'sentry', 'explore', 'build city', 'mine', 'irrigate', and more. Try 'fortify all' or 'sentry all' for batch commands!",
        "ai"
      );
    } else {
      // Show thinking indicator
      append_command_center_message("<i class='fa fa-spinner fa-spin'></i> Processing...", "system", "thinking_msg");
      
      try {
        // Gather game state context
        const context = gather_game_context();
        
        // Build context string for the system message
        let context_str = "Current game state: ";
        if (context.gold !== null) context_str += `Gold: ${context.gold}. `;
        if (context.science_rate !== null) context_str += `Science rate: ${context.science_rate}%. `;
        if (context.year !== null) {
          const year_label = context.year < 0 ? `${Math.abs(context.year)} BC` : `${context.year} AD`;
          context_str += `Year: ${year_label}. `;
        }
        if (context.turn !== null) context_str += `Turn: ${context.turn}. `;
        if (context.num_cities > 0) context_str += `Cities: ${context.num_cities}. `;
        if (context.selected_unit_type) context_str += `Selected unit: ${context.selected_unit_type}. `;
        if (context.selected_tile_terrain) context_str += `Terrain: ${context.selected_tile_terrain}. `;
        
        // Process the command/question with the LLM
        const system_message = `You are the Game Command Center AI for Freeciv. ${context_str}Provide concise, context-aware advice without using asterisks or placeholder symbols. If the player's command is clear and you can help execute it, add an intent flag at the end in the format: [INTENT: COMMAND_NAME]. Available intents: BUILD_CITY, FORTIFY, SENTRY, MINE, IRRIGATE, ROAD, CLEAN, TRANSFORM, PILLAGE, EXPLORE, SETTLE, UPGRADE, WAIT. Only include an intent if the player's request is unambiguous and you're confident about their intention. Do not include an intent if the player is asking for general advice.`;
        const user_message = `The player said: "${input}". Respond appropriately. Keep responses concise (2-3 sentences).`;
        
        const messages = [
          { role: "system", content: system_message },
          { role: "user", content: user_message }
        ];
        
        const reply = await webllm_engine.chat.completions.create({
          messages: messages,
          max_tokens: 150,
          temperature: 0.7,
        });
        
        let response = reply.choices[0].message.content;
        // Post-process to remove *** artifacts
        response = response.replace(/\*\*\*/g, '').trim();
        response = response.replace(/\s{2,}/g, ' ').trim();
        
        // Check for intent pattern in response
        const intentRegex = /\[INTENT:\s*([A-Z_]+)\]/;
        const intentMatch = response.match(intentRegex);
        
        let displayText = response;
        
        if (intentMatch) {
          const intentName = intentMatch[1];
          console.log("[WebLLM] Detected intent:", intentName);
          
          // Strip the intent block from the visible text
          displayText = response.replace(intentRegex, '').trim();
          
          // Remove thinking indicator
          $("#thinking_msg").remove();
          
          // Display the AI response (without intent) with typewriter effect
          append_command_center_message("AI: " + displayText, "ai", null, true);
          
          // Dispatch the intent after a short delay to allow typewriter to start
          setTimeout(async () => {
            await dispatch_intent(intentName);
          }, 100);
        } else {
          // No intent detected, just display the response
          // Remove thinking indicator
          $("#thinking_msg").remove();
          
          // Append AI's response with typewriter effect
          append_command_center_message("AI: " + displayText, "ai", null, true);
        }
        
      } catch (error) {
        console.error("[WebLLM] Error processing question:", error);
        $("#thinking_msg").remove();
        append_command_center_message("Error: Failed to process question. " + error.message, "error");
      }
    }
  }
}

/**
 * Append a message to the Game Command Center chat
 * @param {string} message - The message to append
 * @param {string} type - Message type (user, ai, error, system, success)
 * @param {string} id - Optional ID for the message element
 * @param {boolean} typewriter - Whether to use typewriter effect (default: false)
 */
function append_command_center_message(message, type, id, typewriter = false) {
  const chat_div = $("#command_center_chat");
  
  // Generate timestamp [HH:MM]
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `[${hours}:${minutes}] `;
  
  // Determine CSS class based on type
  let css_class = "";
  if (type === "user") {
    css_class = "user-msg";
  } else if (type === "ai") {
    css_class = "ai-msg";
  } else if (type === "error") {
    css_class = "error-msg";
  } else if (type === "system") {
    css_class = "system-msg";
  } else if (type === "success") {
    css_class = "success-msg";
  }
  
  // Create message element
  const msg_id = id || `msg_${Date.now()}`;
  const msg_html = `<p id='${msg_id}' class='${css_class}'>${timestamp}<span class='msg-content'></span></p>`;
  chat_div.append(msg_html);
  
  const msg_element = $(`#${msg_id} .msg-content`);
  
  // Apply typewriter effect for AI messages if requested
  if (typewriter && type === "ai") {
    let char_index = 0;
    const text = message;
    const type_speed = 20; // milliseconds per character
    
    const typewriter_interval = setInterval(() => {
      if (char_index < text.length) {
        msg_element.append(text.charAt(char_index));
        char_index++;
        // Auto-scroll to bottom during typing
        chat_div.scrollTop(chat_div[0].scrollHeight);
      } else {
        clearInterval(typewriter_interval);
      }
    }, type_speed);
  } else {
    // Display message immediately
    msg_element.html(message);
  }
  
  // Auto-scroll to bottom
  chat_div.scrollTop(chat_div[0].scrollHeight);
}

/**
 * Show fallback intro message in message dialog
 */
function show_fallback_intro_message() {
  const fallback_message = "Welcome to FreecivWorld.net, the free browser-based 3D version of the classic turn-based strategy game Freeciv! Have fun playing FreecivWorld!";
  if (typeof message_log !== 'undefined') {
    message_log.update({ event: E_CONNECTION, message: "<b>Welcome:</b> " + fallback_message });
  }
}


