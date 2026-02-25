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
 * Implements a State-Aware Command & Narrative Engine for Freeciv-web
 */

var webllm_engine = null;
var webllm_loading = false;
var webllm_loaded = false;
var webllm_warmed_up = false;

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
    
    // Warm up the engine for better first-interaction performance
    warm_up_engine();
    
  } catch (error) {
    console.error("[WebLLM] Failed to initialize:", error);
    webllm_loading = false;
    webllm_loaded = false;
  }
}

/**
 * Warm up the engine by sending a silent ping prompt
 * This ensures the KV-cache is ready and minimizes latency for the first real interaction
 */
async function warm_up_engine() {
  if (!webllm_loaded || webllm_warmed_up) {
    return;
  }
  
  try {
    console.log("[WebLLM] Warming up engine...");
    const messages = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "ping" }
    ];
    
    await webllm_engine.chat.completions.create({
      messages: messages,
      max_tokens: 5,
      temperature: 0.1,
    });
    
    webllm_warmed_up = true;
    console.log("[WebLLM] Engine warmed up successfully");
  } catch (error) {
    console.error("[WebLLM] Warmup failed:", error);
  }
}

/**
 * Get current game context for AI awareness
 * @returns {Object} Object with current game state information
 */
function get_game_context() {
  const context = {
    turn: 0,
    gold: 0,
    units: [],
    researchable_techs: [],
    government: "Unknown",
    government_type: null
  };
  
  try {
    // Get current turn
    if (typeof game_info !== 'undefined' && game_info['turn']) {
      context.turn = game_info['turn'];
    }
    
    // Get player information
    if (typeof client !== 'undefined' && client.conn && client.conn.playing) {
      const pplayer = client.conn.playing;
      
      // Get gold reserves
      if (pplayer['gold'] !== undefined) {
        context.gold = pplayer['gold'];
      }
      
      // Get government
      if (pplayer['government'] !== undefined && typeof governments !== 'undefined') {
        const gov = governments[pplayer['government']];
        if (gov) {
          context.government = gov['name'];
          context.government_type = pplayer['government'];
        }
      }
    }
    
    // Get current focused units
    if (typeof current_focus !== 'undefined' && current_focus.length > 0) {
      for (let i = 0; i < current_focus.length; i++) {
        const punit = current_focus[i];
        if (punit && punit['type'] !== undefined) {
          const unit_info = {
            type: typeof unit_types !== 'undefined' && unit_types[punit['type']] 
                  ? unit_types[punit['type']]['name'] 
                  : 'Unknown',
            moves_left: punit['movesleft'] || 0,
            veteran_level: punit['veteran'] || 0
          };
          
          // Get unit location if available
          if (punit['tile'] !== undefined && typeof index_to_map_pos === 'function') {
            const pos = index_to_map_pos(punit['tile']);
            if (pos) {
              unit_info.location = `(${pos['x']}, ${pos['y']})`;
            }
          }
          
          context.units.push(unit_info);
        }
      }
    }
    
    // Get researchable technologies
    if (typeof client !== 'undefined' && client.conn && client.conn.playing) {
      const pplayer = client.conn.playing;
      if (typeof techs !== 'undefined' && typeof research_data !== 'undefined') {
        for (const tech_id in techs) {
          const tech = techs[tech_id];
          // Check if tech can be researched (prerequisites known but tech itself not known)
          if (typeof player_invention_state === 'function') {
            const state = player_invention_state(pplayer, parseInt(tech_id));
            if (state === TECH_PREREQS_KNOWN) {
              context.researchable_techs.push({
                id: tech_id,
                name: tech['name']
              });
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error("[WebLLM] Error getting game context:", error);
  }
  
  return context;
}

/**
 * Get narrative tone based on government type
 * @returns {string} Description of the narrative tone
 */
function get_government_tone() {
  try {
    if (typeof client !== 'undefined' && client.conn && client.conn.playing) {
      const pplayer = client.conn.playing;
      if (pplayer['government'] !== undefined && typeof governments !== 'undefined') {
        const gov = governments[pplayer['government']];
        if (gov) {
          const gov_name = gov['name'].toLowerCase();
          
          // Map government types to narrative tones
          if (gov_name.includes('despotism') || gov_name.includes('tribal')) {
            return "authoritarian and direct";
          } else if (gov_name.includes('monarchy')) {
            return "regal and formal";
          } else if (gov_name.includes('republic') || gov_name.includes('democracy')) {
            return "diplomatic and bureaucratic";
          } else if (gov_name.includes('communism')) {
            return "collective and ideological";
          } else if (gov_name.includes('fundamentalism')) {
            return "fanatical and zealous";
          } else if (gov_name.includes('anarchy')) {
            return "chaotic and uncertain";
          }
        }
      }
    }
  } catch (error) {
    console.error("[WebLLM] Error getting government tone:", error);
  }
  
  return "professional and strategic";
}

/**
 * Build system prompt with game context
 * @param {string} base_prompt - Base system prompt
 * @returns {string} Enhanced system prompt with game context
 */
function build_system_prompt_with_context(base_prompt) {
  const context = get_game_context();
  const tone = get_government_tone();
  
  let context_text = `\n\nCurrent Game State:\n`;
  context_text += `- Turn: ${context.turn}\n`;
  context_text += `- Gold: ${context.gold}\n`;
  context_text += `- Government: ${context.government} (tone: ${tone})\n`;
  
  if (context.units.length > 0) {
    context_text += `- Selected Units: `;
    context_text += context.units.map(u => `${u.type}${u.location ? ' at ' + u.location : ''} (moves: ${u.moves_left})`).join(', ');
    context_text += `\n`;
  }
  
  if (context.researchable_techs.length > 0) {
    context_text += `- Researchable Technologies: `;
    context_text += context.researchable_techs.slice(0, 10).map(t => t.name).join(', ');
    if (context.researchable_techs.length > 10) {
      context_text += ` and ${context.researchable_techs.length - 10} more`;
    }
    context_text += `\n`;
  }
  
  return base_prompt + context_text;
}

/**
 * Clean LLM response by removing markdown artifacts, filler, and formatting issues
 * @param {string} text - Raw response from LLM
 * @returns {string} Cleaned text
 */
function clean_llm_response(text) {
  if (!text) return text;
  
  // Remove markdown code blocks (```json ... ```, ```...```, etc.)
  text = text.replace(/```(?:json|javascript|js|text)?\s*\n?([\s\S]*?)\n?```/g, '$1');
  
  // Remove conversational filler patterns
  const filler_patterns = [
    /^(?:certainly|sure|of course|okay|alright|here (?:is|are|you go)|here's)[!:,.\s]*/i,
    /^(?:let me|i will|i'll|i can)[^.!?]*[.!?]\s*/i,
    /^(?:the|a|an)\s+(?:command|response|answer|result)\s+(?:is|would be)[:\s]*/i
  ];
  
  for (const pattern of filler_patterns) {
    text = text.replace(pattern, '');
  }
  
  // Remove excessive asterisks (**, ***, etc.) but keep single asterisks for emphasis
  text = text.replace(/\*{2,}/g, '');
  
  // Remove multiple consecutive newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Remove multiple consecutive spaces
  text = text.replace(/[ \t]{2,}/g, ' ');
  
  // Trim whitespace
  text = text.trim();
  
  return text;
}

/**
 * Generate AI text using WebLLM
 * @param {string} prompt - The prompt to generate text from
 * @param {number} max_tokens - Maximum number of tokens to generate (default: 100)
 * @param {boolean} use_context - Whether to include game context in system prompt (default: true)
 * @returns {Promise<string>} The generated text
 */
async function generate_ai_text(prompt, max_tokens = 100, use_context = true) {
  if (!webllm_loaded) {
    console.error("[WebLLM] Engine not loaded. Call init_webllm_engine() first.");
    return "AI text generation is not available yet. The model is still loading.";
  }

  try {
    console.log("[WebLLM] Generating text for prompt:", prompt);
    
    const tone = get_government_tone();
    let base_system_content = `You are a creative narrator and assistant for the Freeciv civilization-building strategy game. Provide concise, engaging, and game-appropriate responses. Use a ${tone} tone that matches the current government. Do not use asterisks or placeholder symbols.`;
    
    let system_content = use_context 
      ? build_system_prompt_with_context(base_system_content)
      : base_system_content;
    
    const messages = [
      { role: "system", content: system_content },
      { role: "user", content: prompt }
    ];

    const reply = await webllm_engine.chat.completions.create({
      messages: messages,
      max_tokens: max_tokens,
      temperature: 0.7,
    });

    let generated_text = reply.choices[0].message.content;
    console.log("[WebLLM] Generated text (raw):", generated_text);
    
    // Clean the response
    generated_text = clean_llm_response(generated_text);
    
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
  
  return await generate_ai_text(prompt, 100, true);
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
const MAX_COMMAND_RESPONSE_TOKENS = 150;  // Maximum tokens for command parsing response
const COMMAND_PARSING_TEMPERATURE = 0.1;  // Low temperature for consistent, deterministic parsing

/**
 * Parse user input and determine if it's a game command
 * @param {string} user_input - The text input from the user
 * @returns {Promise<Object>} Object with intent, action, and params, or null if not a command
 */
async function parse_command_with_llm(user_input) {
  if (!webllm_enabled || !webllm_loaded) {
    console.log("[WebLLM] Command parsing disabled or engine not loaded");
    return null;
  }

  try {
    const system_prompt = `You are a command parser for the Freeciv game. Analyze the user's input and determine if they want to execute a game command or query game state.

Your response MUST be a valid JSON object with this exact structure:
{
  "intent": "<INTENT_TYPE>",
  "action": "<ACTION_NAME>",
  "params": {<PARAMETERS>}
}

Intent types:
- "UNIT_ACTION" - Actions for selected unit(s)
- "UNIT_ACTION_ALL" - Actions for all player units
- "RESEARCH" - Research technology
- "DIPLOMACY" - Diplomatic actions
- "QUERY" - Query about game state
- "CHAT" - Not a command, just chat

Available actions by intent:
UNIT_ACTION: "build_city", "auto_explore", "auto_settler", "fortify", "sentry", "wait", "unload"
UNIT_ACTION_ALL: "fortify_all", "sentry_all", "wake_all"
RESEARCH: "research_tech"
DIPLOMACY: "transfer_gold", "make_treaty"
QUERY: "get_info"

Params object should contain:
- For "research_tech": {"target_tech": "Technology Name"}
- For "transfer_gold": {"target_player": "Player Name", "amount": 100}
- For "get_info": {"topic": "units|gold|techs|government"}
- For others: {} (empty object)

Examples:
"build a city" -> {"intent": "UNIT_ACTION", "action": "build_city", "params": {}}
"fortify this unit" -> {"intent": "UNIT_ACTION", "action": "fortify", "params": {}}
"fortify all units" -> {"intent": "UNIT_ACTION_ALL", "action": "fortify_all", "params": {}}
"sentry all" -> {"intent": "UNIT_ACTION_ALL", "action": "sentry_all", "params": {}}
"research writing" -> {"intent": "RESEARCH", "action": "research_tech", "params": {"target_tech": "Writing"}}
"what is my gold?" -> {"intent": "QUERY", "action": "get_info", "params": {"topic": "gold"}}
"hello" -> {"intent": "CHAT", "action": "none", "params": {}}

IMPORTANT: Respond ONLY with the JSON object, no other text.`;

    const context_enhanced_prompt = build_system_prompt_with_context(system_prompt);

    const messages = [
      { role: "system", content: context_enhanced_prompt },
      { role: "user", content: user_input }
    ];

    console.log("[WebLLM] Parsing command:", user_input);
    
    const reply = await webllm_engine.chat.completions.create({
      messages: messages,
      max_tokens: MAX_COMMAND_RESPONSE_TOKENS,
      temperature: COMMAND_PARSING_TEMPERATURE,
    });

    let response_text = reply.choices[0].message.content.trim();
    console.log("[WebLLM] Parse response (raw):", response_text);
    
    // Clean the response
    response_text = clean_llm_response(response_text);
    
    // Extract JSON from response (in case LLM adds extra text)
    // Using [\s\S] to match any character including newlines and nested braces
    const json_match = response_text.match(/\{[\s\S]*\}/);
    if (json_match) {
      response_text = json_match[0];
    }
    
    console.log("[WebLLM] Parse response (cleaned):", response_text);
    
    const parsed = JSON.parse(response_text);
    
    // Validate the parsed structure
    if (!parsed.intent || !parsed.action) {
      console.error("[WebLLM] Invalid command structure:", parsed);
      return null;
    }
    
    // Return null for CHAT intent
    if (parsed.intent === "CHAT" || parsed.action === "none") {
      return null;
    }
    
    // Ensure params exists
    if (!parsed.params) {
      parsed.params = {};
    }
    
    console.log("[WebLLM] Detected command:", parsed);
    return parsed;
    
  } catch (error) {
    console.error("[WebLLM] Command parsing error:", error);
    return null;
  }
}

/**
 * Validate an AI-parsed command before execution
 * @param {Object} command_data - The parsed command object with intent, action, and params
 * @returns {Object} Validation result with {valid: boolean, reason: string, confirmation_msg: string}
 */
function validate_ai_command(command_data) {
  const result = {
    valid: false,
    reason: "",
    confirmation_msg: ""
  };
  
  if (!command_data || !command_data.intent || !command_data.action) {
    result.reason = "Invalid command structure";
    return result;
  }
  
  const { intent, action, params } = command_data;
  
  try {
    // Validate RESEARCH intent
    if (intent === "RESEARCH") {
      if (action === "research_tech") {
        const target_tech = params.target_tech;
        if (!target_tech) {
          result.reason = "No technology specified for research";
          return result;
        }
        
        // Check if the tech exists in the game
        let tech_found = false;
        let tech_id = null;
        if (typeof techs !== 'undefined') {
          for (const tid in techs) {
            const tech = techs[tid];
            if (tech['name'].toLowerCase() === target_tech.toLowerCase()) {
              tech_found = true;
              tech_id = tid;
              break;
            }
          }
        }
        
        if (!tech_found) {
          result.reason = `Technology "${target_tech}" not found in game rules`;
          return result;
        }
        
        // Check if tech can be researched (prerequisites met)
        if (typeof client !== 'undefined' && client.conn && client.conn.playing) {
          const pplayer = client.conn.playing;
          if (typeof player_invention_state === 'function') {
            const state = player_invention_state(pplayer, parseInt(tech_id));
            if (state === TECH_KNOWN) {
              result.reason = `Technology "${target_tech}" is already known`;
              return result;
            }
            if (state !== TECH_PREREQS_KNOWN) {
              result.reason = `Technology "${target_tech}" prerequisites not met`;
              return result;
            }
          }
        }
        
        result.valid = true;
        result.confirmation_msg = `Research ${target_tech}?`;
        return result;
      }
    }
    
    // Validate UNIT_ACTION intent
    if (intent === "UNIT_ACTION") {
      // Check if there's a unit in focus
      if (typeof current_focus === 'undefined' || current_focus.length === 0) {
        result.reason = "No unit selected";
        return result;
      }
      
      // Check if unit has moves left for relevant actions
      const punit = current_focus[0];
      if (punit && punit['movesleft'] !== undefined) {
        const needs_moves = ["build_city", "auto_explore", "auto_settler"];
        if (needs_moves.includes(action) && punit['movesleft'] <= 0) {
          result.reason = "Selected unit has no moves left";
          return result;
        }
      }
      
      result.valid = true;
      result.confirmation_msg = `Execute ${action.replace(/_/g, ' ')}?`;
      return result;
    }
    
    // Validate UNIT_ACTION_ALL intent
    if (intent === "UNIT_ACTION_ALL") {
      result.valid = true;
      result.confirmation_msg = `Execute ${action.replace(/_/g, ' ')} on all units?`;
      return result;
    }
    
    // Validate QUERY intent
    if (intent === "QUERY") {
      result.valid = true;
      result.confirmation_msg = ""; // Queries don't need confirmation
      return result;
    }
    
    // Validate DIPLOMACY intent
    if (intent === "DIPLOMACY") {
      result.valid = true;
      result.confirmation_msg = `Execute ${action.replace(/_/g, ' ')}?`;
      return result;
    }
    
    // Default: mark as valid if we got here
    result.valid = true;
    result.confirmation_msg = `Execute ${action}?`;
    
  } catch (error) {
    console.error("[WebLLM] Validation error:", error);
    result.reason = "Validation error: " + error.message;
  }
  
  return result;
}

/**
 * Show confirmation toast for AI-parsed command
 * @param {string} message - Confirmation message
 * @param {Function} onConfirm - Callback function when user confirms
 * @param {Function} onCancel - Callback function when user cancels
 */
function show_command_confirmation(message, onConfirm, onCancel) {
  // Create a simple confirmation dialog
  const dialog_id = "ai_command_confirm_dialog";
  $(`#${dialog_id}`).remove();
  
  const html = `
    <div id="${dialog_id}">
      <p><b>Oracle suggests:</b> ${message}</p>
      <p>Do you want to proceed?</p>
    </div>
  `;
  
  $(html).appendTo("div#game_page");
  
  $(`#${dialog_id}`).dialog({
    bgiframe: true,
    modal: true,
    width: "350px",
    position: { my: "center", at: "center", of: window },
    buttons: {
      "Confirm": function() {
        $(this).dialog('close');
        if (onConfirm) onConfirm();
      },
      "Cancel": function() {
        $(this).dialog('close');
        if (onCancel) onCancel();
      }
    },
    close: function() {
      $(this).remove();
    }
  });
  
  $(`#${dialog_id}`).dialog('open');
}

/**
 * Execute a parsed command
 * @param {Object} command_data - The parsed command object with intent, action, and params
 * @returns {boolean|string} True if command was executed, false otherwise, or string response for queries
 */
function execute_parsed_command(command_data) {
  if (!command_data || !command_data.intent || !command_data.action) {
    return false;
  }

  const { intent, action, params } = command_data;
  console.log("[WebLLM] Executing command:", intent, action, params);

  try {
    // Handle QUERY intent
    if (intent === "QUERY" && action === "get_info") {
      return handle_query_command(params);
    }
    
    // Handle UNIT_ACTION intent
    if (intent === "UNIT_ACTION") {
      switch (action) {
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
          if (typeof current_focus !== 'undefined' && current_focus.length > 0) {
            const punit = current_focus[0];
            if (punit !== null && typeof request_unit_autosettlers === 'function') {
              request_unit_autosettlers(punit);
              return true;
            }
          }
          break;
          
        case "fortify":
          if (typeof key_unit_fortify === 'function') {
            key_unit_fortify();
            return true;
          }
          break;
          
        case "sentry":
          if (typeof key_unit_sentry === 'function') {
            key_unit_sentry();
            return true;
          }
          break;
          
        case "wait":
          if (typeof key_unit_wait === 'function') {
            key_unit_wait();
            return true;
          }
          break;
          
        case "unload":
          if (typeof key_unit_unload === 'function') {
            key_unit_unload();
            return true;
          }
          break;
      }
    }
    
    // Handle UNIT_ACTION_ALL intent
    if (intent === "UNIT_ACTION_ALL") {
      return handle_all_units_command(action);
    }
    
    // Handle RESEARCH intent
    if (intent === "RESEARCH" && action === "research_tech") {
      return handle_research_command(params);
    }
    
    // Handle DIPLOMACY intent
    if (intent === "DIPLOMACY") {
      return handle_diplomacy_command(action, params);
    }
    
  } catch (error) {
    console.error("[WebLLM] Error executing command:", error);
  }
  
  return false;
}

/**
 * Handle query commands about game state
 * @param {Object} params - Query parameters
 * @returns {string} Response to the query
 */
function handle_query_command(params) {
  const context = get_game_context();
  const topic = params.topic || "general";
  
  let response = "";
  
  switch (topic.toLowerCase()) {
    case "gold":
      response = `You have ${context.gold} gold.`;
      break;
      
    case "units":
      if (context.units.length === 0) {
        response = "No units currently selected.";
      } else {
        response = `Selected units: ${context.units.map(u => `${u.type} (${u.moves_left} moves left)`).join(', ')}`;
      }
      break;
      
    case "techs":
    case "technologies":
      if (context.researchable_techs.length === 0) {
        response = "No technologies available for research.";
      } else {
        const tech_list = context.researchable_techs.slice(0, 5).map(t => t.name).join(', ');
        response = `Available technologies: ${tech_list}`;
        if (context.researchable_techs.length > 5) {
          response += ` and ${context.researchable_techs.length - 5} more.`;
        }
      }
      break;
      
    case "government":
      response = `Current government: ${context.government}`;
      break;
      
    default:
      response = `Turn ${context.turn}, ${context.gold} gold, Government: ${context.government}`;
      if (context.units.length > 0) {
        response += `, ${context.units.length} unit(s) selected`;
      }
  }
  
  // Display the response in message log
  if (typeof message_log !== 'undefined') {
    message_log.update({ event: E_CONNECTION, message: "<b>Oracle:</b> " + response });
  }
  
  return response;
}

/**
 * Handle commands that apply to all units
 * @param {string} action - Action to perform on all units
 * @returns {boolean} True if command was executed
 */
function handle_all_units_command(action) {
  try {
    // Get all player units
    if (typeof client === 'undefined' || !client.conn || !client.conn.playing) {
      return false;
    }
    
    const pplayer = client.conn.playing;
    const player_units = [];
    
    if (typeof units !== 'undefined') {
      for (const unit_id in units) {
        const punit = units[unit_id];
        if (punit && punit['owner'] === pplayer.playerno) {
          player_units.push(punit);
        }
      }
    }
    
    if (player_units.length === 0) {
      console.log("[WebLLM] No units found for player");
      return false;
    }
    
    let count = 0;
    
    switch (action) {
      case "fortify_all":
        if (typeof request_new_unit_activity === 'function') {
          for (const punit of player_units) {
            // Only fortify units that can fortify (not in cities, have moves, etc.)
            if (punit['movesleft'] > 0) {
              request_new_unit_activity(punit, ACTIVITY_FORTIFYING, EXTRA_NONE);
              count++;
            }
          }
          console.log(`[WebLLM] Fortified ${count} units`);
          return true;
        }
        break;
        
      case "sentry_all":
        if (typeof request_new_unit_activity === 'function') {
          for (const punit of player_units) {
            if (punit['movesleft'] >= 0) {
              request_new_unit_activity(punit, ACTIVITY_SENTRY, EXTRA_NONE);
              count++;
            }
          }
          console.log(`[WebLLM] Sentried ${count} units`);
          return true;
        }
        break;
        
      case "wake_all":
        // Wake all units by setting them to idle
        if (typeof request_new_unit_activity === 'function') {
          for (const punit of player_units) {
            request_new_unit_activity(punit, ACTIVITY_IDLE, EXTRA_NONE);
            count++;
          }
          console.log(`[WebLLM] Woke ${count} units`);
          return true;
        }
        break;
    }
    
  } catch (error) {
    console.error("[WebLLM] Error in handle_all_units_command:", error);
  }
  
  return false;
}

/**
 * Handle research commands
 * @param {Object} params - Research parameters
 * @returns {boolean} True if command was executed
 */
function handle_research_command(params) {
  const target_tech = params.target_tech;
  if (!target_tech) {
    return false;
  }
  
  try {
    // Find the tech ID
    let tech_id = null;
    if (typeof techs !== 'undefined') {
      for (const tid in techs) {
        const tech = techs[tid];
        if (tech['name'].toLowerCase() === target_tech.toLowerCase()) {
          tech_id = parseInt(tid);
          break;
        }
      }
    }
    
    if (tech_id === null) {
      console.error("[WebLLM] Tech not found:", target_tech);
      return false;
    }
    
    // Set the research goal
    if (typeof send_player_research === 'function') {
      send_player_research(tech_id);
      console.log("[WebLLM] Set research to:", target_tech);
      return true;
    }
    
  } catch (error) {
    console.error("[WebLLM] Error in handle_research_command:", error);
  }
  
  return false;
}

/**
 * Handle diplomacy commands
 * @param {string} action - Diplomacy action
 * @param {Object} params - Diplomacy parameters
 * @returns {boolean} True if command was executed
 */
function handle_diplomacy_command(action, params) {
  // Placeholder for diplomacy commands
  console.log("[WebLLM] Diplomacy commands not yet implemented:", action, params);
  return false;
}

/**
 * Parse and execute a command with validation and confirmation
 * This is the main entry point for processing user commands via LLM
 * @param {string} user_input - The user's text input
 * @returns {Promise<boolean>} True if a command was processed
 */
async function process_llm_command(user_input) {
  try {
    // Parse the command
    const command_data = await parse_command_with_llm(user_input);
    
    if (!command_data) {
      // Not a command, just regular chat
      return false;
    }
    
    // Validate the command
    const validation = validate_ai_command(command_data);
    
    if (!validation.valid) {
      console.log("[WebLLM] Command validation failed:", validation.reason);
      if (typeof message_log !== 'undefined') {
        message_log.update({ 
          event: E_CONNECTION, 
          message: "<b>Oracle:</b> Cannot execute - " + validation.reason 
        });
      }
      return false;
    }
    
    // For queries, execute immediately without confirmation
    if (command_data.intent === "QUERY") {
      execute_parsed_command(command_data);
      return true;
    }
    
    // For other commands, show confirmation if there's a confirmation message
    if (validation.confirmation_msg) {
      show_command_confirmation(
        validation.confirmation_msg,
        () => {
          // On confirm
          const result = execute_parsed_command(command_data);
          if (result) {
            console.log("[WebLLM] Command executed successfully");
          } else {
            console.log("[WebLLM] Command execution failed");
          }
        },
        () => {
          // On cancel
          console.log("[WebLLM] Command cancelled by user");
        }
      );
      return true;
    }
    
    // Execute without confirmation if no confirmation message
    return execute_parsed_command(command_data);
    
  } catch (error) {
    console.error("[WebLLM] Error processing command:", error);
    return false;
  }
}


