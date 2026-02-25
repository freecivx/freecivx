# Text Selection Fix in FreecivWorld

## Problem
Previously, text selection was globally disabled throughout the game interface. This prevented users from selecting and copying text from chat messages, help dialogs, and other text areas where selection would be useful.

## Solution
Implemented a context-aware text selection system that:
- **Allows** text selection in appropriate areas (chat, dialogs, help text)
- **Prevents** text selection in interactive game elements (map canvas, unit panels)
- Maintains game UX by avoiding cursor issues during drag-to-goto operations

## Changes Made

### JavaScript Changes (`control.js`)
Modified the `document.onselectstart` handler to be context-aware:

```javascript
document.onselectstart = function(e){
  // Allow text selection in text input fields, chat messages, and dialogs
  if (e.target && (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.id === 'game_message_area' ||
      e.target.closest('#game_message_area') ||
      e.target.closest('.ui-dialog-content') ||
      e.target.closest('#game_chatbox_panel')
  )) {
    return true;
  }
  // Prevent selection on game canvas and interactive elements
  if (e.target && (
      e.target.id === 'mapcanvas' ||
      e.target.closest('#mapcanvas') ||
      e.target.closest('#game_unit_info') ||
      e.target.closest('#game_unit_panel')
  )) {
    return false;
  }
  // Default: allow selection
  return true;
};
```

### CSS Changes (`civclient.css`)
Added explicit CSS rules to control text selection:

**Prevent selection on interactive game elements:**
```css
#mapcanvas,
#game_unit_panel,
#game_unit_info,
#tabs_menu,
.order_button,
#turn_done_button {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
```

**Explicitly allow selection in text areas:**
```css
#game_message_area,
#game_chatbox_panel,
.ui-dialog-content,
#game_text_input,
#pregame_text_input,
input[type="text"],
textarea,
.helptext,
#freeciv_manual,
#chat_context_dialog,
.manual-tab,
.diplomacy_messages {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}
```

## Areas Where Text Selection is Enabled

✅ **Chat messages** - Users can select and copy chat text
✅ **Dialog content** - Information in game dialogs can be selected
✅ **Help/Manual text** - Documentation and help text is selectable
✅ **Diplomacy messages** - Diplomatic communications can be copied
✅ **Input fields** - Text in input boxes can be selected
✅ **General page content** - Most text content is selectable by default

## Areas Where Text Selection is Disabled

❌ **Game map canvas** - Prevents cursor issues during drag-to-goto
❌ **Unit panels** - Avoids interference with unit controls
❌ **Game UI buttons** - Prevents accidental selection during clicks
❌ **Tabs menu** - Keeps tab interaction clean

## Benefits

1. **Better UX** - Users can now copy error messages, chat messages, and help text
2. **Accessibility** - Easier to share information from the game
3. **Documentation** - Players can copy unit stats, technology descriptions, etc.
4. **Game functionality preserved** - Drag-to-goto and other interactions still work correctly

## Browser Compatibility

The solution uses:
- Standard CSS `user-select` property
- Browser-specific prefixes (`-webkit-`, `-moz-`, `-ms-`)
- JavaScript event handling with `onselectstart`

This ensures compatibility across:
- Chrome/Edge (Chromium)
- Firefox
- Safari
- Other modern browsers

## Testing

To test this fix:
1. Build the project with `mvn compile`
2. Start the game
3. Try selecting text in chat messages (should work)
4. Try selecting text on the game map (should be prevented)
5. Try dragging units on the map (should work without selection cursor)

## Implementation Details

The fix uses a two-layer approach:
1. **JavaScript layer** - Dynamic checking of target elements during selection start
2. **CSS layer** - Static rules for consistent behavior across browsers

This redundant approach ensures maximum compatibility and reliability.

## Related Issues

This fix addresses the issue where users couldn't select text in the main game, while maintaining the game's drag-to-goto functionality that requires preventing selection on the map canvas.
