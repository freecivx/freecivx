# Future LlamaCPP Integration for AI Chat Messages

## Overview

This document outlines the planned integration of [llama.cpp](https://github.com/ggerganov/llama.cpp) into the Deity Rust AI to generate natural language chat messages during gameplay.

## Vision

The Rust AI should be able to:
- Generate context-aware diplomatic messages
- Respond to player communications with personality
- Provide commentary on game events
- Express strategic intentions in natural language
- Tailor messages based on AI personality and game state

## Technical Approach

### 1. LlamaCPP Rust Bindings

Use one of the available Rust bindings for llama.cpp:

- **[llama-cpp-rs](https://github.com/mdrokz/rust-llama.cpp)** - Safe Rust bindings for llama.cpp
- **[llm](https://github.com/rustformers/llm)** - Pure Rust LLM inference (alternative)

Example dependency in `Cargo.toml`:
```toml
[dependencies]
llama-cpp-rs = "0.2"  # Version may vary
```

### 2. Model Selection

Recommended models for chat generation:

- **Llama 3.2 3B Instruct** - Good balance of quality and performance
- **Mistral 7B Instruct** - Excellent instruction following
- **Qwen 2.5 3B Instruct** - Efficient with good multilingual support

Models should be quantized (Q4_K_M or Q5_K_M) for performance:
- 3B model quantized: ~2GB RAM
- 7B model quantized: ~4-5GB RAM

### 3. Integration Points

#### A. Diplomatic Messages

When the AI:
- Declares war
- Proposes peace
- Requests alliance
- Trades resources
- Responds to player messages

Example prompt:
```
You are a diplomatic AI leader in a Civilization-style game.
Your civilization: Romans
Your current situation: At war with Greeks, allied with Egyptians
Player message: "I propose we work together against Greece"

Generate a brief diplomatic response (1-2 sentences):
```

#### B. Turn Commentary (Optional)

Generate brief commentary on significant events:
- Founding a new city
- Completing a wonder
- Winning/losing a battle
- Discovering new technology

#### C. Victory/Defeat Messages

Generate personalized messages when:
- Winning the game
- Being defeated
- Reaching a milestone

### 4. Architecture Design

```rust
// New module: src/ai/aichat.rs

use llama_cpp_rs::{LlamaModel, LlamaParams};

pub struct AIChatGenerator {
    model: LlamaModel,
    personality: AIPersonality,
}

pub enum AIPersonality {
    Aggressive,
    Diplomatic,
    Economic,
    Scientific,
}

impl AIChatGenerator {
    pub fn new(model_path: &str, personality: AIPersonality) -> Result<Self> {
        // Load model
        let params = LlamaParams::default();
        let model = LlamaModel::load_from_file(model_path, params)?;
        
        Ok(Self { model, personality })
    }
    
    pub fn generate_diplomatic_message(
        &self,
        context: &DiplomaticContext,
    ) -> Result<String> {
        let prompt = self.build_diplomatic_prompt(context);
        let response = self.model.generate(&prompt, 50)?; // Max 50 tokens
        Ok(self.clean_response(response))
    }
    
    fn build_diplomatic_prompt(&self, context: &DiplomaticContext) -> String {
        format!(
            "You are a {} AI leader. {}\n\nGenerate a brief response:",
            self.personality_description(),
            context.describe()
        )
    }
    
    fn personality_description(&self) -> &str {
        match self.personality {
            AIPersonality::Aggressive => "warlike and aggressive",
            AIPersonality::Diplomatic => "peaceful and diplomatic",
            AIPersonality::Economic => "trade-focused and pragmatic",
            AIPersonality::Scientific => "knowledge-seeking and rational",
        }
    }
    
    fn clean_response(&self, response: String) -> String {
        // Remove any prompt artifacts, limit length, etc.
        response.lines().next().unwrap_or("").trim().to_string()
    }
}

pub struct DiplomaticContext {
    pub our_civ: String,
    pub their_civ: String,
    pub current_relation: String,
    pub message_type: MessageType,
    pub game_context: String,
}

pub enum MessageType {
    WarDeclaration,
    PeaceProposal,
    AllianceRequest,
    TradeOffer,
    ResponseToPlayer,
}
```

### 5. Configuration

Add configuration options in `src/main.rs`:

```rust
#[derive(Parser, Debug)]
struct Args {
    // ... existing args ...
    
    /// Path to llama.cpp model for chat generation (optional)
    #[arg(long)]
    chat_model: Option<String>,
    
    /// AI personality for chat generation
    #[arg(long, default_value = "diplomatic")]
    personality: String,
}
```

### 6. Performance Considerations

- **Lazy Loading**: Only load the model when chat features are requested
- **Response Caching**: Cache similar prompts to avoid regeneration
- **Async Generation**: Generate messages asynchronously to avoid blocking game logic
- **Timeout**: Set generation timeouts (e.g., 2-3 seconds max)
- **Fallback**: Have pre-written fallback messages if generation fails

```rust
impl AIChatGenerator {
    pub async fn generate_with_timeout(
        &self,
        context: &DiplomaticContext,
        timeout_secs: u64,
    ) -> String {
        let generation = tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            self.generate_diplomatic_message(context)
        );
        
        match generation.await {
            Ok(Ok(msg)) => msg,
            _ => self.fallback_message(context.message_type),
        }
    }
    
    fn fallback_message(&self, msg_type: MessageType) -> String {
        match msg_type {
            MessageType::WarDeclaration => 
                "Your actions leave us no choice but war!".to_string(),
            MessageType::PeaceProposal => 
                "Perhaps it is time we end this conflict.".to_string(),
            // ... more fallbacks
        }
    }
}
```

### 7. Resource Management

Models should be stored in a standard location:

```
freeciv-rust-ai/
├── models/           # Git-ignored directory for LLM models
│   ├── llama-3.2-3b-instruct-q4_k_m.gguf
│   └── README.md     # Instructions for downloading models
├── src/
└── ...
```

Create `models/README.md`:
```markdown
# AI Chat Models

Download quantized GGUF models from Hugging Face:

- Llama 3.2 3B Instruct Q4_K_M (~2GB)
  https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF

- Mistral 7B Instruct Q4_K_M (~4GB)
  https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF

Place the .gguf file in this directory and reference it with --chat-model.
```

### 8. Example Usage

```bash
# Without chat (current behavior)
./target/release/deity-rust-ai --port 6000

# With chat enabled
./target/release/deity-rust-ai \
    --port 6000 \
    --chat-model models/llama-3.2-3b-instruct-q4_k_m.gguf \
    --personality aggressive
```

### 9. Privacy and Ethics Considerations

- **No External APIs**: All inference runs locally with llama.cpp (no data sent to external services)
- **Appropriate Content**: Configure model parameters to prevent inappropriate outputs
- **Player Consent**: Make chat feature opt-in and clearly documented
- **Transparency**: Clearly indicate when messages are AI-generated vs. pre-scripted

### 10. Testing Strategy

- **Unit Tests**: Test prompt generation and response cleaning
- **Integration Tests**: Test with mock model responses
- **Manual Testing**: Test with actual models for quality
- **Performance Tests**: Measure inference time and memory usage

### 11. Future Enhancements

- **Multi-language Support**: Generate messages in player's language
- **Adaptive Personality**: AI personality evolves based on game events
- **Player Profiling**: Tailor messages based on player's playstyle
- **Voice Generation**: Integrate TTS for voiced messages (distant future)
- **Learning from Games**: Fine-tune model on game transcripts (advanced)

## Implementation Timeline

**Phase 1** (Foundation):
- Add llama.cpp Rust bindings as optional dependency
- Create `aichat.rs` module with basic message generation
- Implement fallback system

**Phase 2** (Integration):
- Integrate with diplomatic system
- Add configuration options
- Test with multiple models

**Phase 3** (Refinement):
- Optimize prompts for better responses
- Add caching and performance improvements
- Polish and document

**Phase 4** (Enhancement):
- Add personality system
- Implement context-aware generation
- Multi-language support

## Dependencies

Add to `Cargo.toml` when implementing:

```toml
[dependencies]
# ... existing dependencies ...

# LLM integration (optional feature)
llama-cpp-rs = { version = "0.2", optional = true }
tokio = { version = "1.35", features = ["rt-multi-thread", "net", "io-util", "macros", "time"] }

[features]
default = []
chat = ["llama-cpp-rs"]  # Enable with: cargo build --features chat
```

## References

- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Fast LLM inference in C++
- [llama-cpp-rs](https://github.com/mdrokz/rust-llama.cpp) - Rust bindings
- [Hugging Face GGUF Models](https://huggingface.co/models?library=gguf) - Model repository
- [Freeciv Diplomacy](https://freeciv.fandom.com/wiki/Diplomacy) - Game diplomacy mechanics

## Conclusion

Integrating llama.cpp will enable the Deity Rust AI to communicate with players in a natural, context-aware manner, enhancing the gaming experience with AI-generated diplomatic messages. The implementation should be gradual, optional, and focused on performance to ensure it doesn't impact gameplay responsiveness.
