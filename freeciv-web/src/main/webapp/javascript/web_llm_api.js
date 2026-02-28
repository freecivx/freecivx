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
    <div id='command_center_chat' style='height: 300px; overflow-y: auto; margin-bottom: 8px; padding: 8px; border: 1px solid #444; background-color: #000; color: #fff; font-size: 11px;'>
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
    position: { my: "center bottom", at: "center bottom-20", of: window },
    buttons: {}
  }).dialogExtend({
    "minimizable" : true,
    "closable" : true,
    "icons" : {
      "minimize" : "ui-icon-circle-minus",
      "restore" : "ui-icon-newwin"
    }
  });
  
  $("#ai_intro_dialog").dialog('open');
  
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
  
  // Check if it's a game command
  let command_executed = false;
  
  try {
    // Unit commands
    if (input_lower === "fortify" || input_lower === "f") {
      if (typeof key_unit_fortify === 'function') {
        key_unit_fortify();
        append_command_center_message("✓ Units fortifying", "success");
        command_executed = true;
      }
    } else if (input_lower === "sentry" || input_lower === "s") {
      if (typeof key_unit_sentry === 'function') {
        key_unit_sentry();
        append_command_center_message("✓ Units on sentry", "success");
        command_executed = true;
      }
    } else if (input_lower === "build city" || input_lower === "build" || input_lower === "b") {
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
    } else if (input_lower === "mine" || input_lower === "m") {
      if (typeof key_unit_mine === 'function') {
        key_unit_mine();
        append_command_center_message("✓ Units mining", "success");
        command_executed = true;
      }
    } else if (input_lower === "irrigate" || input_lower === "i") {
      if (typeof key_unit_irrigate === 'function') {
        key_unit_irrigate();
        append_command_center_message("✓ Units irrigating", "success");
        command_executed = true;
      }
    } else if (input_lower === "road" || input_lower === "r") {
      if (typeof key_unit_road === 'function') {
        key_unit_road();
        append_command_center_message("✓ Units building road", "success");
        command_executed = true;
      }
    } else if (input_lower === "clean" || input_lower === "pollution") {
      if (typeof key_unit_clean === 'function') {
        key_unit_clean();
        append_command_center_message("✓ Units cleaning pollution", "success");
        command_executed = true;
      }
    } else if (input_lower === "transform" || input_lower === "t") {
      if (typeof key_unit_transform === 'function') {
        key_unit_transform();
        append_command_center_message("✓ Units transforming terrain", "success");
        command_executed = true;
      }
    } else if (input_lower === "pillage" || input_lower === "p") {
      if (typeof key_unit_pillage === 'function') {
        key_unit_pillage();
        append_command_center_message("✓ Units pillaging", "success");
        command_executed = true;
      }
    } else if (input_lower === "auto explore" || input_lower === "explore" || input_lower === "x") {
      if (typeof key_unit_auto_explore === 'function') {
        key_unit_auto_explore();
        append_command_center_message("✓ Units auto-exploring", "success");
        command_executed = true;
      }
    } else if (input_lower === "auto settle" || input_lower === "settle") {
      if (typeof key_unit_auto_settle === 'function') {
        key_unit_auto_settle();
        append_command_center_message("✓ Units auto-settling", "success");
        command_executed = true;
      }
    } else if (input_lower === "upgrade" || input_lower === "u") {
      if (typeof key_unit_upgrade === 'function') {
        key_unit_upgrade();
        append_command_center_message("✓ Units upgrading", "success");
        command_executed = true;
      }
    } else if (input_lower === "disband" || input_lower === "d") {
      if (typeof key_unit_disband === 'function') {
        key_unit_disband();
        append_command_center_message("✓ Disband command sent", "success");
        command_executed = true;
      }
    } else if (input_lower === "wait" || input_lower === "w") {
      if (typeof key_unit_wait === 'function') {
        key_unit_wait();
        append_command_center_message("✓ Units waiting", "success");
        command_executed = true;
      }
    } else if (input_lower === "load" || input_lower === "l") {
      if (typeof key_unit_load === 'function') {
        key_unit_load();
        append_command_center_message("✓ Units loading", "success");
        command_executed = true;
      }
    } else if (input_lower === "unload") {
      if (typeof key_unit_unload === 'function') {
        key_unit_unload();
        append_command_center_message("✓ Units unloading", "success");
        command_executed = true;
      }
    } else if (input_lower === "fortress") {
      if (typeof key_unit_fortress === 'function') {
        key_unit_fortress();
        append_command_center_message("✓ Units building fortress", "success");
        command_executed = true;
      }
    } else if (input_lower === "airbase") {
      if (typeof key_unit_airbase === 'function') {
        key_unit_airbase();
        append_command_center_message("✓ Units building airbase", "success");
        command_executed = true;
      }
    } else if (input_lower === "cultivate") {
      if (typeof key_unit_cultivate === 'function') {
        key_unit_cultivate();
        append_command_center_message("✓ Units cultivating", "success");
        command_executed = true;
      }
    } else if (input_lower === "plant") {
      if (typeof key_unit_plant === 'function') {
        key_unit_plant();
        append_command_center_message("✓ Units planting", "success");
        command_executed = true;
      }
    } else if (input_lower === "nuke") {
      if (typeof key_unit_nuke === 'function') {
        key_unit_nuke();
        append_command_center_message("✓ Nuke ready - select target", "success");
        command_executed = true;
      }
    } else if (input_lower === "paradrop") {
      if (typeof key_unit_paradrop === 'function') {
        key_unit_paradrop();
        append_command_center_message("✓ Paradrop - select target", "success");
        command_executed = true;
      }
    } else if (input_lower === "airlift") {
      if (typeof key_unit_airlift === 'function') {
        key_unit_airlift();
        append_command_center_message("✓ Airlift - select target city", "success");
        command_executed = true;
      }
    } else if (input_lower === "home city" || input_lower === "homecity") {
      if (typeof key_unit_homecity === 'function') {
        key_unit_homecity();
        append_command_center_message("✓ Changed home city", "success");
        command_executed = true;
      }
    } else if (input_lower === "idle" || input_lower === "stop") {
      if (typeof key_unit_idle === 'function') {
        key_unit_idle();
        append_command_center_message("✓ Units idle", "success");
        command_executed = true;
      }
    } else if (input_lower === "no orders") {
      if (typeof key_unit_noorders === 'function') {
        key_unit_noorders();
        append_command_center_message("✓ Units done moving", "success");
        command_executed = true;
      }
    } else if (input_lower === "open city" || input_lower === "city" || input_lower === "c") {
      // Open city at current unit location
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
    
  } catch (error) {
    console.error("[WebLLM] Error executing command:", error);
    append_command_center_message("Error: " + error.message, "error");
    command_executed = true;
  }
  
  // If no command was executed, use AI to respond
  if (!command_executed) {
    // Show thinking indicator
    append_command_center_message("<i class='fa fa-spinner fa-spin'></i> Processing...", "system", "thinking_msg");
    
    try {
      // Process the command/question with the LLM
      const prompt = `You are the Game Command Center AI for Freeciv. The player said: "${input}". ` +
                     `Respond appropriately. If it's a question about game state or strategy, ` +
                     `provide a helpful response. Keep responses concise (2-3 sentences).`;
      
      const response = await generate_ai_text(prompt, 150);
      
      // Remove thinking indicator
      $("#thinking_msg").remove();
      
      // Append AI's response
      append_command_center_message("AI: " + response, "ai");
      
    } catch (error) {
      console.error("[WebLLM] Error processing question:", error);
      $("#thinking_msg").remove();
      append_command_center_message("Error: Failed to process question. " + error.message, "error");
    }
  }
}

/**
 * Append a message to the Game Command Center chat
 */
function append_command_center_message(message, type, id) {
  const chat_div = $("#command_center_chat");
  let style = "";
  
  if (type === "user") {
    style = "color: #4af; margin: 3px 0; font-size: 11px;";
  } else if (type === "ai") {
    style = "color: #aaa; margin: 3px 0; font-size: 11px;";
  } else if (type === "error") {
    style = "color: #f44; margin: 3px 0; font-size: 11px;";
  } else if (type === "system") {
    style = "color: #0f0; margin: 3px 0; font-style: italic; font-size: 11px;";
  } else if (type === "success") {
    style = "color: #0f0; margin: 3px 0; font-weight: bold; font-size: 11px;";
  }
  
  const msg_html = id ? `<p id='${id}' style='${style}'>${message}</p>` : `<p style='${style}'>${message}</p>`;
  chat_div.append(msg_html);
  
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


