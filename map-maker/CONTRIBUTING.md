# Map Maker Extensibility Guide

This tool is built on a modular, event-driven architecture. Follow these patterns to add new features.

## Architecture Core
- **EventBus**: The nervous system. Modules only talk through events.
- **MapState**: The single source of truth. Pure data, no DOM/PIXI.
- **ToolManager**: Handles all pointer interaction and delegates to the active tool.

---

## How to Add...

### 1. A New Tile Type
1. Open `src/data/tile_defs.json`.
2. Add a new entry: `"my_tile": { "name": "My Tile", "category": "natural", "walkable": true }`.
3. Add a color for it in `src/rendering/TileColors.js` -> `TILE_COLORS`.
4. The Sidebar will automatically show it in the palette.

### 2. A New Tool
1. Create `src/tools/MyTool.js` (extend `Tool` from `BrushTool.js`).
2. Implement `onDown(tx, ty)`, `onMove(tx, ty)`, `onUp()`.
3. Declare `static shortcut = 'x'` on the class (or `''` for no shortcut). **Required** — the completeness test will fail loudly if omitted.
4. Register it in `src/tools/ToolManager.js` constructor: `this.tools.set('mytool', new MyTool(state))`.
5. Add a button in `index.html` with `id="tool-mytool"`. `SidebarUI.js` auto-wires it via the `tool-*` convention.
6. Run `npm test` — shortcut collision and completeness tests will catch any issues before the browser.

### 3. A New Event
1. Choose a descriptive name (e.g., `selection:cleared`).
2. Add it to the event table in the `implementation_plan.md` artifact.
3. Emit: `bus.emit('selection:cleared', { some: 'data' })`.
4. Subscribe: `bus.on('selection:cleared', (data) => { ... })`.

### 4. A New Tile Layer
1. Update `MapState.js` `_createEmptyChunk` to include the new field.
2. Update `MapRenderer.js` `_renderChunk` to draw the layer.
3. Add a tool to paint/modify that layer.

---

## Testing Policy
- Every new logic module **must** have a `.test.js` file.
- Run `npm test` before committing.
- UI/Rendering changes **must** be verified in the browser.
