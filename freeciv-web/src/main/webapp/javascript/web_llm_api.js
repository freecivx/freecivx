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
      { role: "system", content: "You are a helpful assistant for the Freeciv strategy game." },
      { role: "user", content: prompt }
    ];

    const reply = await webllm_engine.chat.completions.create({
      messages: messages,
      max_tokens: max_tokens,
      temperature: 0.7,
    });

    const generated_text = reply.choices[0].message.content;
    console.log("[WebLLM] Generated text:", generated_text);
    
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
  const prompt = "Write a brief, exciting 2-3 sentence introduction for a player starting a new game of Freeciv, " +
                 "a civilization-building strategy game. Make it inspiring and welcoming.";
  
  return await generate_ai_text(prompt, 80);
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

/**
 * Generate turn summary text based on current game state
 * @returns {Promise<string>} The generated turn summary
 */
async function generate_turn_summary() {
  if (!webllm_enabled || !webllm_loaded) {
    return null;
  }
  
  try {
    let pplayer = client.conn.playing;
    if (pplayer == null || pplayer['nation'] == null) {
      return null;
    }
    
    const turn = game_info['turn'];
    const player_name = username;
    const nation_name = nations[pplayer['nation']]['adjective'];
    const population = civ_population(client.conn.playing.playerno);
    const gold = pplayer['gold'];
    
    const prompt = `You are a narrator for the Freeciv strategy game. Write a brief 1-2 sentence update for turn ${turn}. ` +
                   `The player ${player_name} leads the ${nation_name} nation with a population of ${population} and ${gold} gold. ` +
                   `Make it interesting and game-relevant. Keep it under 40 words.`;
    
    const turn_text = await generate_ai_text(prompt, 60);
    return turn_text;
    
  } catch (error) {
    console.error("[WebLLM] Failed to generate turn summary:", error);
    return null;
  }
}

/**
 * Show turn summary in the message log
 */
async function show_turn_summary() {
  if (!webllm_enabled) {
    return;
  }
  
  const summary = await generate_turn_summary();
  if (summary && typeof message_log !== 'undefined') {
    message_log.update({ event: E_CONNECTION, message: "<b>Turn Update:</b> " + summary });
  }
}

/**
 * Process a game message using web-llm: filter unsafe content and enhance
 * Uses LLM to:
 * - Remove telephone numbers, emails, and web links
 * - Filter curse words and unsafe words
 * - Make messages more lively and varied
 * @param {string} text - The message text to process
 * @returns {Promise<string>} The processed message
 */
async function process_game_message(text) {
  if (!text) return text;
  
  // If web-llm is not enabled or not loaded, return original text
  if (!webllm_enabled || !webllm_loaded) {
    return text;
  }
  
  try {
    // Skip processing for very short messages
    if (text.length < 5) {
      return text;
    }
    
    // Extract HTML tags to preserve formatting
    const htmlTagPattern = /<[^>]+>/g;
    const tags = text.match(htmlTagPattern) || [];
    const plainText = text.replace(htmlTagPattern, '|||TAG|||');
    
    // Create a comprehensive prompt for the LLM to handle all filtering and enhancement
    const prompt = `[INST] <<SYS>>
                   You are the Freeciv Chat Oracle. Your job is to sanitize and stylize game messages.
                   STRICT RULES:
                   1. SECURITY: Remove all emails, phone numbers and contact information.
                   2. SAFETY: Replace all profanity or toxic language with "***".
                   3. STYLE: Rewrite the message to be immersive and engaging for a strategy game.
                   4. BREVITY: Maximum 25 words.
                   5. OUTPUT: Provide ONLY the final processed text. No commentary, no quotes, no formatting.
                   <</SYS>>

                   Original message: "${plainText}" [/INST]

                   Processed message:`;
    
    let processed = await generate_ai_text(prompt, 100);
    
    // Clean up the response
    // Remove quotes if the LLM added them
    processed = processed.replace(/^["']|["']$/g, '').trim();
    
    // Remove any "Processed message:" prefix if LLM included it
    processed = processed.replace(/^Processed message:\s*/i, '');
    
    // Restore HTML tags
    for (const tag of tags) {
      processed = processed.replace('|||TAG|||', tag);
    }
    
    return processed;
    
  } catch (error) {
    console.error("[WebLLM] Failed to process message:", error);
    return text; // Return original text on error
  }
}
