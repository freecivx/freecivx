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
 * Show AI-generated introduction dialog when the game starts
 */
async function show_ai_intro_dialog() {
  console.log("[WebLLM] Showing AI intro dialog");
  
  // Check if web-llm is enabled
  if (!webllm_enabled) {
    console.log("[WebLLM] Web-LLM is disabled, showing fallback message");
    show_fallback_intro_message();
    return;
  }
  
  // Create dialog element
  $("#ai_intro_dialog").remove();
  $("<div id='ai_intro_dialog'></div>").appendTo("div#game_page");
  
  // Show loading message first - smaller window at bottom center
  $("#ai_intro_dialog").html("<p style='text-align: center;'><i class='fa fa-spinner fa-spin'></i> Loading AI model...</p>");
  $("#ai_intro_dialog").attr("title", "Welcome");
  $("#ai_intro_dialog").dialog({
    bgiframe: true,
    modal: false,
    width: "300px",
    height: "auto",
    position: { my: "center bottom", at: "center bottom-20", of: window },
    buttons: {
      "Close": function() {
        $(this).dialog('close');
      }
    }
  }).dialogExtend({
    "minimizable" : true,
    "closable" : true,
    "icons" : {
      "minimize" : "ui-icon-circle-minus",
      "restore" : "ui-icon-newwin"
    }
  });
  
  $("#ai_intro_dialog").dialog('open');
  
  // Wait for the model to be loaded before generating text
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
    
    console.log("[WebLLM] Model loaded, generating intro text...");
    const intro_text = await generate_game_intro_text();
    
    // Expand dialog to show the generated text
    $("#ai_intro_dialog").html("<p>" + intro_text + "</p>");
    $("#ai_intro_dialog").dialog("option", "width", "500px");
    $("#ai_intro_dialog").dialog("option", "height", "auto");
    $("#ai_intro_dialog").dialog("option", "position", { my: "center bottom", at: "center bottom-20", of: window });
    
  } catch (error) {
    console.error("[WebLLM] Error generating intro:", error);
    show_fallback_intro_message();
  }
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

// Command parsing configuration constants
const MAX_COMMAND_RESPONSE_TOKENS = 50;  // Maximum tokens for command parsing response
const COMMAND_PARSING_TEMPERATURE = 0.1;  // Low temperature for consistent, deterministic parsing

/**
 * Parse user input and determine if it's a game command
 * @param {string} user_input - The text input from the user
 * @returns {Promise<Object>} Object with command type and parameters, or null if not a command
 */
async function parse_command_with_llm(user_input) {
  if (!webllm_enabled || !webllm_loaded) {
    console.log("[WebLLM] Command parsing disabled or engine not loaded");
    return null;
  }

  try {
    const system_prompt = `You are a command parser for the Freeciv game. Analyze the user's input and determine if they want to execute a game command.

Available commands:
- "help" - Show game help
- "build_city" - Build a city with current unit
- "auto_explore" - Set current unit to auto-explore mode
- "auto_settler" - Set current unit to auto-settler mode

Respond ONLY with a JSON object in this exact format:
{"command": "command_name"}

If the input is NOT a game command (e.g., it's a chat message), respond with:
{"command": "none"}

Examples:
User: "help" -> {"command": "help"}
User: "I need help" -> {"command": "help"}
User: "build a city here" -> {"command": "build_city"}
User: "found a new city" -> {"command": "build_city"}
User: "explore the map" -> {"command": "auto_explore"}
User: "auto explore" -> {"command": "auto_explore"}
User: "set to auto settler" -> {"command": "auto_settler"}
User: "Hello everyone" -> {"command": "none"}
User: "Good game!" -> {"command": "none"}`;

    const messages = [
      { role: "system", content: system_prompt },
      { role: "user", content: user_input }
    ];

    console.log("[WebLLM] Parsing command:", user_input);
    
    const reply = await webllm_engine.chat.completions.create({
      messages: messages,
      max_tokens: MAX_COMMAND_RESPONSE_TOKENS,
      temperature: COMMAND_PARSING_TEMPERATURE,
    });

    let response_text = reply.choices[0].message.content.trim();
    console.log("[WebLLM] Parse response:", response_text);
    
    // Extract JSON from response (in case LLM adds extra text)
    // Using [\s\S] to match any character including newlines and nested braces
    const json_match = response_text.match(/\{[\s\S]*\}/);
    if (json_match) {
      response_text = json_match[0];
    }
    
    const parsed = JSON.parse(response_text);
    
    if (parsed.command && parsed.command !== "none") {
      console.log("[WebLLM] Detected command:", parsed.command);
      return parsed;
    }
    
    return null;
    
  } catch (error) {
    console.error("[WebLLM] Command parsing error:", error);
    return null;
  }
}

/**
 * Execute a parsed command
 * @param {Object} command_data - The parsed command object with command type
 * @returns {boolean} True if command was executed, false otherwise
 */
function execute_parsed_command(command_data) {
  if (!command_data || !command_data.command) {
    return false;
  }

  console.log("[WebLLM] Executing command:", command_data.command);

  try {
    switch (command_data.command) {
      case "help":
        if (typeof show_help === 'function') {
          show_help();
          return true;
        }
        break;
        
      case "build_city":
        if (typeof request_unit_build_city === 'function') {
          request_unit_build_city();
          return true;
        }
        break;
        
      case "auto_explore":
        if (typeof key_unit_auto_explore === 'function') {
          key_unit_auto_explore();
          return true;
        }
        break;
        
      case "auto_settler":
        // Get the currently focused unit
        if (typeof current_focus !== 'undefined' && current_focus.length > 0) {
          const punit = current_focus[0];
          if (punit !== null && typeof request_unit_autosettlers === 'function') {
            request_unit_autosettlers(punit);
            return true;
          }
        }
        break;
    }
  } catch (error) {
    console.error("[WebLLM] Error executing command:", error);
  }
  
  return false;
}


