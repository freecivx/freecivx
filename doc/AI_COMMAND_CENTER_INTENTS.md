# AI Command Center Intent System

## Overview
The AI Command Center now supports an intent-based system that allows the AI to not only provide text responses but also automatically trigger game functions based on player commands.

## How It Works

### 1. System Prompt
The AI is instructed via the system prompt to recognize clear player commands and include an intent flag in its response in the format: `[INTENT: COMMAND_NAME]`

### 2. Available Intents
The following intents are supported:
- `BUILD_CITY` - Build a city with AI-generated name
- `FORTIFY` - Fortify the selected unit(s)
- `SENTRY` - Put unit(s) on sentry duty
- `MINE` - Start mining
- `IRRIGATE` - Start irrigation
- `ROAD` - Build a road
- `CLEAN` - Clean pollution
- `TRANSFORM` - Transform terrain
- `PILLAGE` - Pillage improvements
- `EXPLORE` - Auto-explore
- `SETTLE` - Auto-settle
- `UPGRADE` - Upgrade unit
- `WAIT` - Wait/skip turn

### 3. Example Usage

**User Input:** "Build a city here"

**AI Response:** "I'll start building that city for you. [INTENT: BUILD_CITY]"

**What Happens:**
1. The AI response is parsed for the `[INTENT: BUILD_CITY]` pattern
2. The intent block is stripped from the visible text
3. The user sees: "AI: I'll start building that city for you." (with typewriter effect)
4. The `dispatch_intent()` function is called with "BUILD_CITY"
5. The system validates `current_focus` (a unit must be selected)
6. The `generate_city_name()` function is called to create a city name
7. The `request_unit_do_action()` function is executed to build the city
8. A success message is shown: "✓ Building city: [generated_name]"

### 4. Ambiguity Handling

**User Input:** "What should I do?"

**AI Response:** "Based on your current situation with Gold: 50, you might want to explore more territory or build improvements on your tiles."

**What Happens:**
- No `[INTENT: ...]` block is included
- The AI only provides advice
- No automatic action is triggered

### 5. Validation

All intent dispatching includes validation:
- `current_focus` must be defined and contain at least one unit
- If validation fails, the intent is silently skipped (logged to console)
- This prevents errors when no unit is selected

## Implementation Details

### New Functions

#### `execute_command(cmd_config, cmd_name)`
- Shared helper function for executing game commands
- Validates `current_focus` before execution
- Returns `true` if command was executed successfully

#### `dispatch_intent(intentName)`
- Maps intent names to game command configurations
- Validates `current_focus` before executing any intent
- Handles special cases like `BUILD_CITY` separately
- Uses the `execute_command()` helper for regular commands

### Code Refactoring

The manual command handling code was refactored to use the new `execute_command()` helper function, eliminating code duplication between:
- Manual command execution (user types "fortify")
- AI intent dispatching (AI responds with `[INTENT: FORTIFY]`)

### Regex Pattern

```javascript
const intentRegex = /\[INTENT:\s*([A-Z_]+)\]/;
```

This pattern matches:
- `[INTENT: BUILD_CITY]`
- `[INTENT:BUILD_CITY]` (with no space)
- `[INTENT:  BUILD_CITY]` (with extra spaces)

## Testing

To test the intent system:

1. Start the game and open the Game Command Center
2. Ensure a unit is selected
3. Try these commands:
   - "Build a city" - Should trigger BUILD_CITY intent
   - "Fortify my units" - Should trigger FORTIFY intent
   - "Build a road" - Should trigger ROAD intent
   - "What should I do?" - Should NOT trigger any intent (advice only)

## Future Enhancements

Possible future improvements:
- Support for multi-step intents (e.g., "move then fortify")
- More complex intents with parameters
- Intent chaining for complex operations
- Confidence scoring for ambiguous commands
