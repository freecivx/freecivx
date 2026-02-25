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
var webllm_enabled = true; // Can be toggled from pregame settings

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
    const selectedModel = "SmolLM2-360M-Instruct-q4f16_1-MLC";
    
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
 * Remove unsafe content from a message (phone numbers, emails, URLs, curse words)
 * This is a synchronous filter that always runs
 * @param {string} text - The message text to filter
 * @returns {string} The filtered text
 */
function filter_unsafe_content(text) {
  if (!text) return text;
  
  // Remove phone numbers (various formats)
  // Matches formats like: 123-456-7890, (123) 456-7890, 123.456.7890, +1 123 456 7890
  text = text.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[removed]');
  
  // Remove email addresses
  text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[removed]');
  
  // Remove URLs (http://, https://, www., etc.)
  text = text.replace(/https?:\/\/[^\s<]+/g, '[removed]');
  text = text.replace(/www\.[^\s<]+/g, '[removed]');
  
  // Remove common curse words and unsafe words
  // This is a basic list - can be expanded as needed
  const curseWords = [
    'fuck', 'shit', 'damn', 'bitch', 'bastard', 'ass', 'hell',
    'crap', 'piss', 'dick', 'cock', 'pussy', 'cunt', 'whore',
    'slut', 'fag', 'retard', 'nigger', 'nigga'
  ];
  
  for (const word of curseWords) {
    // Case-insensitive replacement with word boundaries
    const regex = new RegExp('\\b' + word + '\\b', 'gi');
    text = text.replace(regex, '***');
  }
  
  return text;
}

/**
 * Process and enhance a message using web-llm
 * Makes messages more lively, varied, and interesting
 * @param {string} text - The message text to enhance
 * @returns {Promise<string>} The enhanced text, or original if processing fails
 */
async function enhance_message_with_llm(text) {
  if (!webllm_enabled || !webllm_loaded || !text) {
    return text;
  }
  
  try {
    // Skip enhancement for very short messages
    if (text.length < 10) {
      return text;
    }
    
    // Extract HTML tags to preserve formatting
    const htmlTagPattern = /<[^>]+>/g;
    const tags = text.match(htmlTagPattern) || [];
    const plainText = text.replace(htmlTagPattern, '|||TAG|||');
    
    const prompt = `Rewrite this game message to be more lively and interesting while keeping the same meaning. ` +
                   `Keep it concise (under 50 words). Message: "${plainText}"`;
    
    let enhanced = await generate_ai_text(prompt, 80);
    
    // Remove quotes if the LLM added them
    enhanced = enhanced.replace(/^["']|["']$/g, '');
    
    // Restore HTML tags
    for (const tag of tags) {
      enhanced = enhanced.replace('|||TAG|||', tag);
    }
    
    return enhanced;
    
  } catch (error) {
    console.error("[WebLLM] Failed to enhance message:", error);
    return text; // Return original text on error
  }
}

/**
 * Process a game message: filter unsafe content and optionally enhance with LLM
 * This is the main entry point for message processing
 * @param {string} text - The message text to process
 * @param {boolean} shouldEnhance - Whether to enhance the message with LLM (default: true)
 * @returns {Promise<string>} The processed message
 */
async function process_game_message(text, shouldEnhance = true) {
  if (!text) return text;
  
  // Always filter unsafe content (synchronous, always runs)
  let processed = filter_unsafe_content(text);
  
  // Optionally enhance with LLM (asynchronous, only if enabled and loaded)
  if (shouldEnhance && webllm_enabled && webllm_loaded) {
    processed = await enhance_message_with_llm(processed);
  }
  
  return processed;
}
