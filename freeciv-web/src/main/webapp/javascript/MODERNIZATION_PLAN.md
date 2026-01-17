# JavaScript Modernization Plan

This document outlines the plan to modernize JavaScript files in the `freeciv-web/src/main/webapp/javascript` directory to use modern JavaScript (ES6+) features and best practices.

## Modernization Goals

1. **Convert `var` to `const`/`let`**: Use `const` by default, `let` when reassignment is needed
2. **Arrow Functions**: Replace anonymous function expressions with arrow functions where appropriate
3. **Template Literals**: Replace string concatenation with template literals
4. **Destructuring**: Use destructuring for objects and arrays where it improves readability
5. **Default Parameters**: Replace manual default value checks with default parameters
6. **Enhanced Object Literals**: Use shorthand property and method syntax
7. **Const for Constants**: Ensure all constant values use `const`
8. **Modern Loops**: Use `for...of`, `forEach`, `map`, `filter`, etc. where appropriate
9. **Strict Equality**: Use `===` and `!==` instead of `==` and `!=`
10. **Optional Chaining**: Use `?.` for safer property access where supported

## Files to Modernize (in order)

### Phase 1: Core Game Files
- [ ] `game.js` - Core game state and info management
- [ ] `client.js` - Client state management  
- [ ] `clinet_state.js` - Client state utilities
- [ ] `control.js` - Game control logic
- [ ] `chatbox.js` - Chat functionality
- [ ] `helpdata.js` - Help system
- [ ] `specialist.js` - Specialist management

### Phase 2: UI Files
- [ ] `pages.js` - Page management
- [ ] `menu.js` - Menu system
- [ ] `diplomacy.js` - Diplomacy dialogs
- [ ] `dialogs.js` - General dialogs
- [ ] `government.js` - Government selection

### Phase 3: Map and Graphics
- [ ] `mapview.js` - Map rendering
- [ ] `mapctrl.js` - Map controls
- [ ] `2dcanvas.js` - 2D canvas rendering
- [ ] `webgl/` - WebGL files (if applicable to non-library code)

### Phase 4: Utilities
- [ ] `utility.js` - Utility functions
- [ ] `sounds.js` - Sound management
- [ ] `errorlog.js` - Error logging

### Phase 5: Game Logic
- [ ] `city.js` - City management
- [ ] `civclient.js` - Main client
- [ ] `unittype.js` - Unit types
- [ ] `text.js` - Text rendering/management
- [ ] `tech.js` - Technology tree

## Files to EXCLUDE (Libraries)

Do NOT modernize these library files:
- `libs/jquery.*.js` - jQuery plugins
- `libs/three.*.js` - Three.js library
- `libs/stacktrace.*.js` - StackTrace library
- Any other third-party libraries in `libs/`
- `webgl/libs/*` - WebGL library files

## Modernization Process (Per File)

1. **Create a branch** for the specific file
2. **Analyze the file** for modernization opportunities
3. **Apply transformations** systematically:
   - First pass: `var` → `const`/`let`
   - Second pass: String concatenation → Template literals
   - Third pass: Function expressions → Arrow functions (where appropriate)
   - Fourth pass: Add missing semicolons, fix formatting
   - Fifth pass: Other ES6+ features as appropriate
4. **Preserve functionality**: Do NOT change logic, only syntax
5. **Test thoroughly**: Ensure the game still works
6. **Create Pull Request** with clear description of changes
7. **Review and merge** before proceeding to next file
8. **Update this plan** to mark file as complete

## Testing Checklist (For Each PR)

- [ ] Code compiles/builds successfully
- [ ] No new console errors
- [ ] Basic game functionality works (start game, move units, etc.)
- [ ] UI interactions work correctly
- [ ] No regressions in related functionality

## Notes

- Maintain compatibility with the build system (`build-js.sh`)
- Preserve all copyright headers
- Keep consistent code style within each file
- Document any breaking changes (there shouldn't be any)
- All modernization should be backward compatible with supported browsers

## Progress Tracking

**Started**: 2026-01-17 14:31:09  
**Last Updated**: 2026-01-17 14:31:09  
**Files Completed**: 0
**Files Remaining**: ~50+

---

*This is a living document. Update after each file is successfully modernized and merged.*