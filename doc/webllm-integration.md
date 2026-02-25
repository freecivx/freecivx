# WebLLM Integration in Freeciv-Web

## Overview
This document describes the integration of web-llm 0.2.81 into freeciv-web to provide AI-generated text content.

## Implementation Details

### Files Modified/Created

1. **`web_llm_api.js`** - New JavaScript API module for WebLLM integration
   - `init_webllm_engine()` - Initializes the WebLLM engine with Phi-2 model
   - `generate_ai_text(prompt, max_tokens)` - Generates AI text from a prompt
   - `generate_game_intro_text()` - Generates a game introduction message
   - `show_ai_intro_dialog()` - Shows jQuery UI dialog with AI-generated intro

2. **`freeciv-web-standalone.html`** - Standalone game HTML
   - Added script tag to load web_llm_api.js
   - Added initialization call to `init_webllm_engine()` on page load

3. **`webclient/index.jsp`** - Main game JSP page
   - Added script tag to load web_llm_api.js

4. **`standalone.js`** - Standalone game initialization
   - Added call to `show_ai_intro_dialog()` after game starts

5. **`client_main.js`** - Main client state management
   - Added WebLLM initialization in `set_client_state()` when game starts
   - Added call to `show_ai_intro_dialog()` when entering C_S_RUNNING state

### Library Source
- **web-llm version**: 0.2.81
- **CDN**: https://esm.run/@mlc-ai/web-llm@0.2.81
- **Model used**: Phi-2-q4f16_1-MLC (small, fast model)

### Usage

The AI-generated introduction dialog appears automatically 2 seconds after the game starts (when client state changes to C_S_RUNNING). The dialog:
- Shows a loading spinner while generating text
- Displays AI-generated welcome message once ready
- Can be closed, minimized, or restored
- Falls back to a default message if AI generation fails

### API Functions

#### `init_webllm_engine()`
Initializes the WebLLM engine by loading the model. This happens automatically in the background when the page loads.

#### `generate_ai_text(prompt, max_tokens = 100)`
Generates AI text based on a prompt.
- **Parameters:**
  - `prompt` (string): The text prompt for the AI
  - `max_tokens` (number): Maximum tokens to generate (default: 100)
- **Returns:** Promise<string> - The generated text

#### `show_ai_intro_dialog()`
Shows a jQuery UI dialog with an AI-generated game introduction. Called automatically when the game starts.

### Technical Notes

1. **ES6 Module Import**: web-llm is loaded as an ES6 module using dynamic import from CDN
2. **Background Loading**: Model initialization happens in the background to not block the game
3. **Error Handling**: Falls back to default welcome message if AI generation fails
4. **Browser Support**: Requires browsers with WebGPU support for optimal performance

### Future Enhancements

Possible future improvements:
- Allow users to customize the AI prompts
- Add more AI-generated content (city names, unit descriptions, etc.)
- Support different AI models
- Add user preference to enable/disable AI features
