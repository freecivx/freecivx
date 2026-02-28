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
  
  // Show loading message first
  $("#ai_intro_dialog").html(`
    <div id='command_center_chat' style='max-height: 400px; overflow-y: auto; margin-bottom: 10px; padding: 10px; border: 1px solid #ccc; background-color: #f9f9f9;'>
      <p style='text-align: center;'><i class='fa fa-spinner fa-spin'></i> Loading AI model...</p>
    </div>
    <div style='display: flex; gap: 5px;'>
      <input type='text' id='command_center_input' style='flex: 1; padding: 8px;' placeholder='Enter command or question...' />
      <button id='command_center_send' style='padding: 8px 16px;'>Send</button>
    </div>
  `);
  $("#ai_intro_dialog").attr("title", "Game Command Center");
  $("#ai_intro_dialog").dialog({
    bgiframe: true,
    modal: false,
    width: "500px",
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
    const ready_message = "Game Command Center active. You can issue unit commands (Sentry, Fortify, Build) or ask questions about your empire's status here.";
    
    // Update dialog with ready message
    $("#command_center_chat").html("<p style='color: #2c5aa0; font-weight: bold;'>" + ready_message + "</p>");
    
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
  
  // Show thinking indicator
  append_command_center_message("<i class='fa fa-spinner fa-spin'></i> Processing...", "system", "thinking_msg");
  
  try {
    // Process the command/question with the LLM
    const prompt = `You are the Game Command Center AI for Freeciv. The player said: "${input}". ` +
                   `Respond appropriately. If it's a command (like "Sentry", "Fortify", "Build city", "Control units"), ` +
                   `acknowledge and explain what action would be taken. If it's a question about game state, ` +
                   `provide a helpful response. Keep responses concise (2-3 sentences).`;
    
    const response = await generate_ai_text(prompt, 150);
    
    // Remove thinking indicator
    $("#thinking_msg").remove();
    
    // Append AI's response
    append_command_center_message("AI: " + response, "ai");
    
  } catch (error) {
    console.error("[WebLLM] Error processing command:", error);
    $("#thinking_msg").remove();
    append_command_center_message("Error: Failed to process command. " + error.message, "error");
  }
}

/**
 * Append a message to the Game Command Center chat
 */
function append_command_center_message(message, type, id) {
  const chat_div = $("#command_center_chat");
  let style = "";
  
  if (type === "user") {
    style = "color: #0066cc; margin: 5px 0;";
  } else if (type === "ai") {
    style = "color: #2c5aa0; margin: 5px 0;";
  } else if (type === "error") {
    style = "color: #cc0000; margin: 5px 0;";
  } else if (type === "system") {
    style = "color: #666; margin: 5px 0; font-style: italic;";
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


