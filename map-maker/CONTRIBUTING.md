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
2. Add a new entry with a `sprite` field (see section 5 for sprite format).
3. The palette will automatically show it with a sprite preview.
4. Tiles without a `sprite` field need a fallback color in `src/rendering/TileColors.js` → `TILE_COLORS`.

### 2. A New Tool
1. Create `src/tools/MyTool.js` (extend `Tool` from `BrushTool.js`).
2. Implement `onDown(tx, ty)`, `onMove(tx, ty)`, `onUp()`.
3. Declare `static shortcut = 'x'` on the class (or `''` for no shortcut). **Required** — the completeness test will fail loudly if omitted.
4. Register it in `src/tools/ToolManager.js` constructor: `this.tools.set('mytool', new MyTool(state))`.
5. Add the tool to the `TOOLS` array in `src/ui/ToolPickerPanel.js` with its name, icon, and label.
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

### 5. A New Sprite / Tile from an Asset Pack

The asset system uses a **tile registry pattern** — maps store semantic IDs, tile definitions map those to spritesheet regions or individual files.

1. Open `src/data/tile_defs.json`.
2. Add an entry with a `sprite` field. Two forms are supported:
   - **Spritesheet region:** `"my_tile": { "name": "My Tile", "category": "natural", "walkable": true, "sprite": { "sheet": "ground_grasss.png", "col": 5, "row": 3 } }`
   - **Individual file:** `"my_tile": { "name": "My Tile", "category": "decoration", "walkable": false, "sprite": { "file": "Objects_separated/MyTile.png" } }`
3. Paths in `sprite` are relative to the `_config.assetBase` path in tile_defs.json.
4. The `SpriteAtlas` will load it automatically on next startup. No code changes needed.
5. Tiles without a `sprite` field fall back to colored rectangles via `TileColors.js`.

### 6. Swapping an Entire Asset Pack

1. Place the new assets in `src/assets/<pack-name>/`.
2. Update `_config.assetBase` in `tile_defs.json` to point to the new location.
3. Update each tile's `sprite` field to reference the new spritesheet/file names and coordinates.
4. Map data is untouched — it stores semantic IDs, not coordinates.

### 7. Importing Tiles from a Tiled (.tmx) File

Run the import script: `npm run import:tmx`

This parses a Tiled `.tmx` file and generates tile definition entries with correct spritesheet coordinates. Review the output and rename/prune tiles as needed.

---

## Extension Points (Planned)

These are architectural features designed for future expansion:

| System | Extension Point | How |
|--------|----------------|-----|
| **Tile types** | `tile_defs.json` | Add entry, sprite auto-loads |
| **Tools** | `ToolManager` + `static shortcut` | Self-declaring, completeness-tested |
| **Tile layers** | `MapState._createEmptyChunk()` | Add field, add renderer overlay, add tool |
| **Entity types** | `MapState.manifest` | Add array, add tool, update EntityNavigator |
| **Asset packs** | `_config.assetBase` + `sprite` fields | Change paths, maps unchanged |
| **Item sprites** | `ItemRegistry` + `sprite` field | Add `sprite: { file }` to item def, SpriteAtlas loads it |
| **Events** | `EventBus` | Emit from source, subscribe in consumer |

---

## Testing Policy
- Every new logic module **must** have a `.test.js` file.
- Run `npm test` before committing.
- UI/Rendering changes **must** be verified in the browser.
