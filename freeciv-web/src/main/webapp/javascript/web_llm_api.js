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
    
    // Create the engine with a small model for faster loading
    // Using SmolLM2-360M which is a very small and fast-loading model
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
  
  // Create dialog element
  $("#ai_intro_dialog").remove();
  $("<div id='ai_intro_dialog'></div>").appendTo("div#game_page");
  
  // Show loading message first
  $("#ai_intro_dialog").html("<p>Generating your personalized welcome message...</p><p><i class='fa fa-spinner fa-spin'></i> Please wait...</p>");
  $("#ai_intro_dialog").attr("title", "Welcome to Freeciv!");
  $("#ai_intro_dialog").dialog({
    bgiframe: true,
    modal: false,
    width: "500px",
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
    $("#ai_intro_dialog").html("<p>" + intro_text + "</p>");
  } catch (error) {
    console.error("[WebLLM] Error generating intro:", error);
    $("#ai_intro_dialog").html("<p>Welcome to Freeciv! Build your civilization from the ground up and lead your people to greatness!</p>");
  }
}
