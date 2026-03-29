# Map Maker — Architecture & Implementation Plan

## Problem Statement

The current Map Maker has **all interaction logic in a single 368-line [main.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/main.js)** file. This file handles tool selection, DOM manipulation, entity management, painting, persistence, and event handling with tight coupling to PixiJS internals, the DOM, and the backend API. The result is fragile code where a single broken line crashes the entire app, and every change requires touching [main.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/main.js).

This plan proposes a clean, modular rewrite with dedicated modules, clear boundaries, and unit tests for each layer. All existing code is considered disposable.

> [!IMPORTANT]
> **Nothing is marked as "done" here.** Every module must be implemented, tested, and **verified in the browser** before being checked off. The browser test is the final gate—not the code review.

---

## Tile Data Model

Each tile is a **layered struct** — like 2D Pokemon, you place terrain, then furniture/trees, then pickups on top. Tools operate on **one layer at a time**.

```js
{ base: 'grass_v1', decoration: 'tree_oak', pickup: 'apple', zone: null, warp: null }
```

| Layer | Purpose | Example values |
|-------|---------|----------------|
| `base` | Ground terrain — always present | `'grass_v1'`, `'dirt_path'`, `'water_shallow'` |
| `decoration` | Permanent objects on top of terrain | `'tree_oak'`, `'table_wood'`, `'rock_large'`, `null` |
| `pickup` | Interactive/consumable items | `'apple'`, `'fish'`, `'key_gold'`, `null` |
| `zone` | Behavioral overlay (invisible in-game) | `'safe_zone'`, `'battle_zone'`, `null` |
| `warp` | Transition point ID (links to manifest) | `'warp_12345'`, `null` |

New chunks default to **empty** (all layers `null`, `base: 'empty'`) until painted.

> [!NOTE]
> **Future evolution:** `decoration` will become an array of `{ id, offsetX, offsetY }` to support multiple objects per tile (e.g., table + lamp + flowers). This is noted in the roadmap but not implemented in the MVP.

### Data-Driven Tile Definitions

Ground tiles are defined in [tile_defs.json](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/data/tile_defs.json), not hardcoded. This enables:
- Adding new terrain types without touching code.
- **Tileset theming** — tile IDs (e.g., `grass`) are abstract; a theme file maps them to specific sprites/colors. One map definition, multiple visual styles.

```js
// tile_defs.json
{
  "grass_v1": { "name": "Grass", "category": "natural", "walkable": true },
  "water_shallow": { "name": "Shallow Water", "category": "water", "walkable": false },
  "dirt_path": { "name": "Dirt Path", "category": "path", "walkable": true }
}
```

The **color mapping** in [TileColors.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/rendering/TileColors.js) acts as the default "dev theme". Future tileset support swaps this for sprite lookups.

---

## Architecture Overview

```mermaid
graph TD
    subgraph "Browser (Vite)"
        MAIN["main.js<br/>(~30 lines, wiring only)"]
        MAIN --> EB["EventBus"]
        MAIN --> APP["MapEditorApp"]
        
        APP --> VIEWPORT["Viewport"]
        APP --> RENDERER["MapRenderer"]
        APP --> TOOLS["ToolManager"]
        APP --> SIDEBAR["SidebarUI"]
        APP --> PERSIST["PersistenceClient"]
        
        TOOLS --> EB
        SIDEBAR --> EB
        RENDERER --> EB
        PERSIST --> EB
        
        TOOLS --> |"uses"| STATE["MapState"]
        RENDERER --> |"reads"| STATE
        SIDEBAR --> |"reads"| STATE
        PERSIST --> |"reads/writes"| STATE
    end
    
    subgraph "Node Backend"
        SERVER["server.js<br/>(Express API)"]
    end
    
    PERSIST -->|"HTTP"| SERVER
```

### Key Principles

1. **[main.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/main.js) is glue only** — creates instances, wires subscribers, starts the loop. ~30 lines.
2. **EventBus decouples everything** — modules communicate via named events, never direct references.
3. **MapState is the single source of truth** — all data lives here; it's just data, no DOM/PIXI knowledge.
4. **ToolManager owns all input** — mouse/keyboard handlers live in one place, dispatch to the active tool strategy.
5. **MapRenderer is a pure read-only view** — subscribes to `state:changed`, re-renders. No business logic.
6. **SidebarUI manages the DOM** — palettes, property editor, entity list. Emits events when user selects things.
7. **PersistenceClient is the HTTP layer** — auto-save timer, manual save, load. Talks to the server.

---

## Directory Structure

```
map-maker/
├── CONTRIBUTING.md                  # [NEW] Extensibility guide for future sessions
├── index.html                      # Shell HTML (sidebar skeleton + viewport div)
├── src/
│   ├── main.js                     # [REWRITE] ~30 lines of wiring
│   ├── style.css                   # [REWRITE] Clean dark-theme stylesheet
│   ├── core/
│   │   ├── EventBus.js             # [NEW] Pub/sub event system
│   │   ├── MapState.js             # [REWRITE] Data model (chunks, manifest, dirty flags)
│   │   ├── ActionHistory.js        # [REWRITE] Command pattern (extracted from Actions.js)
│   │   ├── Actions.js              # [REWRITE] PaintTileAction, PlaceEntityAction, etc.
│   │   ├── TileDefs.js             # [NEW] Data-driven tile definitions (loads tile_defs.json)
│   │   └── ItemRegistry.js         # [REWRITE] Item/pickup definitions
│   ├── tools/
│   │   ├── ToolManager.js          # [NEW] Input handler + active tool dispatch
│   │   ├── BrushTool.js            # [NEW] Single-tile and drag painting
│   │   ├── EraseTool.js            # [NEW] Reset tile to default
│   │   ├── FillTool.js             # [NEW] Flood-fill algorithm
│   │   ├── SpawnerTool.js          # [NEW] Place spawner entity
│   │   ├── WarpTool.js             # [NEW] Place warp entity
│   │   └── ZoneTool.js             # [NEW] Paint zone overlay
│   ├── rendering/
│   │   ├── MapRenderer.js          # [REWRITE] PixiJS v8 rendering (from Renderer.js)
│   │   ├── Viewport.js             # [REWRITE] Pan/zoom (keep mostly as-is)
│   │   └── TileColors.js           # [NEW] Color mapping extracted from Renderer
│   ├── ui/
│   │   ├── SidebarUI.js            # [NEW] All sidebar DOM management
│   │   ├── PropertyPanel.js        # [NEW] Entity property editor
│   │   └── StatusBar.js            # [NEW] Auto-save timer, version display
│   ├── persistence/
│   │   └── PersistenceClient.js    # [NEW] HTTP client for save/load/deploy
│   ├── data/
│   │   └── tile_defs.json          # [NEW] Ground tile definitions
│   └── server/
│       ├── server.js               # [KEEP] Express backend (working, tested)
│       └── server.test.js          # [KEEP] Existing passing tests
```

---

## Proposed Changes — Ordered by Dependency

### Phase 1: Foundation (no PIXI, no DOM — pure logic, fully testable)

---

#### [NEW] [EventBus.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/EventBus.js)

A minimal pub/sub system. Every module communicates through this.

```js
// API: bus.on(event, callback), bus.off(event, callback), bus.emit(event, data)
```

**Events emitted across the app:**

| Event | Payload | Emitted by |
|-------|---------|------------|
| `tool:changed` | `string` (tool name) | SidebarUI, ShortcutManager — **request** to switch tool |
| `tool:active` | `string` (tool name) | ToolManager — **confirmation** after switch completes |
| `tile:selected` | `string` (tileId) | SidebarUI |
| `item:selected` | `string` (itemId) | SidebarUI |
| `state:changed` | `{ type, ... }` | MapState |
| `entity:selected` | entity object | SidebarUI |
| `save:requested` | — | SidebarUI, ShortcutManager |
| `save:completed` | `{ version, type: 'auto'\|'master' }` | PersistenceClient |
| `save:error` | `{ message }` | PersistenceClient |
| `map:created` | `{ name }` | PersistenceClient |
| `map:loaded` | `{ name }` | PersistenceClient |
| `viewport:snap` | `{ x, y }` | SidebarUI |
| `cursor:moved` | `{ tx, ty }` | main.js (on mousemove) |
| `fill:error` | `{ message }` | FillTool |

---

#### [REWRITE] [MapState.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.js)

Pure data model. No DOM, no PIXI, no HTTP. Takes an [EventBus](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/EventBus.js#1-23) in its constructor.

- Manages `chunks`, `manifest`, `dirty`, `needsRedraw` flags.
- Emits `state:changed` on every mutation.
- [getChunk(x, y)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.js#39-47) creates chunks lazily.
- [setTileData(x, y, layer, value)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/State.js#54-62) mutates and emits.
- [addEntity(type, data)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.js#90-98), [removeEntity(type, id)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.js#99-107) for manifest mutations.
- [serialize()](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.js#108-119) returns `{ mapName, manifest, chunks }` for saving.
- [deserialize(data)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.js#120-135) loads from saved JSON.

---

#### [REWRITE] [ActionHistory.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/ActionHistory.js)

Extracted from current [Actions.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/Actions.js). Pure undo/redo stack.

---

#### [REWRITE] [Actions.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/Actions.js)

Action classes — each has `execute(state)` and `undo(state)`:

- `PaintTileAction(x, y, layer, newValue, oldValue)` — single tile mutation
- `BatchPaintAction(paints[])` — multiple tile mutations as **one undo step**. Use this for any operation affecting more than one tile (e.g. flood fill). `paints` is `Array<{ x, y, layer, newValue, oldValue }>`. Undo iterates in reverse.
- `PlaceEntityAction(type, data)` — adds to manifest[type]
- `RemoveEntityAction(type, data)` — removes from manifest[type]

---

#### [NEW] [TileDefs.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/TileDefs.js)

Loads [tile_defs.json](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/data/tile_defs.json). Provides [getTile(id)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/TileDefs.js#9-12), [getAllTiles()](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/TileDefs.js#13-16), [getTilesByCategory()](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/TileDefs.js#17-20). Used by SidebarUI to populate the ground palette and by TileColors for rendering.

---

#### [REWRITE] [ItemRegistry.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/ItemRegistry.js)

Rename of [Items.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/Items.js). Now covers both **decorations** and **pickups** as separate categories.

---

### Phase 2: Tools (no DOM, no PIXI — interact only with MapState)

---

#### [NEW] [ShortcutManager.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/ShortcutManager.js)

Central keyboard shortcut registry. Replaces the hardcoded `keydown` block that was in `main.js`.

- `register({ key, ctrlKey, shiftKey, action, description })` — throws on duplicate canonical key.
- `registerCoreShortcuts(state, bus)` — registers Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+S (save).
- `registerToolShortcuts(toolManager)` — walks `toolManager.tools`, reads each tool's `static shortcut`, registers it. Throws if any tool has `shortcut = null` (forgot to declare). Skips `''` (intentionally no shortcut).
- `handleEvent(e)` — pure dispatch, no DOM coupling. Called by the listener and directly in tests.
- `attach(target)` / `detach(target)` — bind/unbind the `keydown` listener.
- Case is NOT normalised — `'z'` (zone tool) and `'Z'` (Ctrl+Shift+Z redo) are distinct canonicals.

**Tool shortcut convention:** Every `Tool` subclass must declare `static shortcut`. Three valid values:
- `null` — forgot to declare → completeness test throws at startup
- `''` — intentionally no shortcut → skipped silently
- `'b'` etc. — registered as a key binding

---

#### [NEW] [ToolManager.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/ToolManager.js)

- Constructor: `ToolManager(bus, state, tileDefs = null)`. `tileDefs` is passed to `WarpTool` for walkability checks.
- Owns the `activeTool` reference.
- `setTool(name)` — emits `tool:active` after switching (this is the confirmation; `tool:changed` is the request).
- `onPointerDown(tx, ty)`, `onPointerMove(tx, ty)`, `onPointerUp()` — delegate to the active tool.
- `registerShortcuts(shortcutManager)` — delegates to `shortcutManager.registerToolShortcuts(this)`.
- Subscribes to `tile:selected` and `item:selected` to configure the brush tool.

---

#### [NEW] [BrushTool.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/BrushTool.js)

- [onDown(tx, ty)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/EraseTool.js#5-8) — paints single tile via `state.applyAction(new PaintTileAction(...))`.
- [onMove(tx, ty)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/ZoneTool.js#16-19) — same (drag painting).
- Handles both `base` (ground) and `item` layers based on configuration.

---

#### [NEW] EraseTool.js, FillTool.js, SpawnerTool.js, WarpTool.js, ZoneTool.js

Each follows the same interface: [onDown](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/EraseTool.js#5-8), [onMove](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/ZoneTool.js#16-19), [onUp](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/BrushTool.js#11-12).

**FillTool** uses a BFS flood-fill on matching `base` tiles. It **crosses chunk boundaries** transparently. A `MAX_FILL_TILES` limit (default: 10,000) prevents runaway fills — if exceeded, the fill aborts entirely (no partial changes) and emits `fill:error`. The entire fill is wrapped in a single `BatchPaintAction` so it undoes in one Ctrl+Z.

**WarpTool** takes `tileDefs` as an optional second constructor arg. If provided, placement is blocked on non-walkable tiles (water, rock) — a warp the player can never reach is useless. Silent no-op if the tile is non-walkable.

---

### Phase 3: Rendering (PIXI only, no DOM sidebar knowledge)

---

#### [REWRITE] [MapRenderer.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/rendering/MapRenderer.js)

- Uses **only** PixiJS v8 API (`rect`/`fill`/`stroke`, not `beginFill`/`drawRect`).
- Constructor takes [(container, bus)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/EventBus.test.js#16-17). Calls `app.init()` in its own `async init()`.
- Subscribes to `state:changed` — sets a `_needsRedraw` flag.
- [update()](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/Renderer.js#29-35) method called each frame; only redraws when `_needsRedraw` is true.
- Converts mouse events to world coords and calls `toolManager.onPointerDown(worldX, worldY)`.

---

#### [NEW] [TileColors.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/rendering/TileColors.js)

Simple lookup: `getColor(tileId) → number`. Extracted from [_getBaseColor](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/Renderer.js#142-156).

---

#### [REWRITE] [Viewport.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/rendering/Viewport.js)

Mostly kept as-is. Takes `canvas` directly in [init()](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/rendering/Viewport.js#10-16) instead of trying to access `app.view` synchronously.

---

### Phase 4: UI (DOM only, no PIXI knowledge)

---

#### [NEW] [SidebarUI.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/ui/SidebarUI.js)

- Accepts [(bus, state, itemRegistry)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/EventBus.test.js#16-17).
- [init()](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/rendering/Viewport.js#10-16) — populates ground palette, item palette, entity tool buttons.
- Emits `tile:selected`, `item:selected`, `tool:changed`, `entity:selected`, `viewport:snap`, `save:requested`.
- Subscribes to `state:changed` to refresh entity list.

---

#### [NEW] [PropertyPanel.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/ui/PropertyPanel.js)

- Subscribes to `entity:selected` — renders name/target inputs.
- On input change → mutates entity in state, marks dirty.
- Delete button → emits `entity:deleted`.

---

#### [NEW] [StatusBar.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/ui/StatusBar.js)

- Subscribes to `save:completed` — resets timer.
- Runs its own `setInterval` to update the "Xs ago" display.
- **Coordinate readout**: displays `Cursor: (x, y)` updated on pointer move events from MapRenderer.

---

### Phase 5: Persistence (Create, Save, Load)

---

#### [NEW] [PersistenceClient.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/persistence/PersistenceClient.js)

- Accepts [(bus, state, serverUrl)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/EventBus.test.js#16-17).
- [createMap(mapName)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/persistence/PersistenceClient.js#13-27) — POSTs to `/api/create-map`, initialises empty state, emits `map:created`.
- [loadMap(mapName)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/persistence/PersistenceClient.js#28-34) — GETs `/api/load-map/:name`, calls `state.deserialize()`, emits `map:loaded`.
- [startAutoSave(intervalMs)](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/persistence/PersistenceClient.js#69-73) — checks `state.dirty`, POSTs to `/api/auto-save`.
- [saveMaster()](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/persistence/PersistenceClient.js#53-68) — POSTs to `/api/save-master`, emits `save:completed`.
- [listMaps()](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/persistence/PersistenceClient.js#74-78) — GETs `/api/maps`, returns array.
- `deploy(mapName, enabled)` — POSTs to `/api/deploy`.

#### Server API additions needed in [server.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/server/server.js):

- `POST /api/create-map` — creates empty `<name>_tmp/` with default manifest and one empty chunk.
- `GET /api/load-map/:name` — returns `{ manifest, chunks }` from the master directory (or `_tmp` if no master).

---

### Phase 6: Wiring ([main.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/main.js))

---

#### [REWRITE] [main.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/main.js)

```js
import { EventBus } from './core/EventBus.js';
import { MapState } from './core/MapState.js';
import { ItemRegistry } from './core/ItemRegistry.js';
import { ToolManager } from './tools/ToolManager.js';
import { MapRenderer } from './rendering/MapRenderer.js';
import { Viewport } from './rendering/Viewport.js';
import { SidebarUI } from './ui/SidebarUI.js';
import { StatusBar } from './ui/StatusBar.js';
import { PropertyPanel } from './ui/PropertyPanel.js';
import { PersistenceClient } from './persistence/PersistenceClient.js';

const bus = new EventBus();
const state = new MapState(bus);
const items = new ItemRegistry();
const tools = new ToolManager(bus, state, items);
const renderer = new MapRenderer(document.getElementById('viewport-container'), bus, state, items);
const viewport = new Viewport(renderer);
const sidebar = new SidebarUI(bus, state, items);
const statusBar = new StatusBar(bus);
const propertyPanel = new PropertyPanel(bus, state);
const persistence = new PersistenceClient(bus, state, 'http://localhost:3001');

async function start() {
    await renderer.init();
    viewport.init(renderer.app.canvas);
    renderer.connectInput(tools, viewport);
    sidebar.init();
    statusBar.init();
    propertyPanel.init();
    state.createInitialChunk();
    persistence.startAutoSave(5000);
    renderer.startLoop();
}
start();
```

That's it. **~30 lines. Never needs to change unless you add a new top-level module.**

---

## Verification Plan

### Automated Unit Tests

All tests use Node's built-in test runner (`node --test`). Add a `"test"` script to [package.json](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/package.json):
```json
"test": "node --test src/**/*.test.js"
```

#### EventBus Tests — [src/core/EventBus.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/EventBus.test.js)

| # | Test Title | What it verifies |
|---|-----------|-----------------|
| 1 | `"on/emit delivers to subscriber"` | Basic pub/sub works |
| 2 | `"off removes subscriber"` | Unsubscribe stops delivery |
| 3 | `"emit with no subscribers does not throw"` | Defensive edge case |
| 4 | `"multiple subscribers all receive"` | Fan-out works |

#### MapState Tests — [src/core/MapState.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.test.js)

| # | Test Title | What it verifies |
|---|-----------|------------------|
| 1 | `"getChunk creates chunk lazily"` | First access auto-creates a 32×32 chunk |
| 2 | `"setTileData updates correct local coords"` | World-to-chunk coordinate math is correct |
| 3 | `"setTileData on 'base' layer does not affect 'item' layer"` | Layers are independent — setting `base:'dirt'` leaves `item:'tree'` intact |
| 4 | `"setTileData marks dirty and emits state:changed"` | Side effects fire |
| 5 | `"addEntity adds to manifest and emits"` | Spawner/warp creation |
| 6 | `"removeEntity removes from manifest and emits"` | Entity deletion |
| 7 | `"serialize returns complete snapshot"` | Output matches expected shape |
| 8 | `"negative coordinates map correctly"` | Chunk math handles x < 0, y < 0 |

#### ActionHistory Tests — [src/core/ActionHistory.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/ActionHistory.test.js)

| # | Test Title | What it verifies |
|---|-----------|-----------------|
| 1 | `"push executes action and adds to stack"` | Basic command execution |
| 2 | `"undo reverses last action"` | Undo restores old value |
| 3 | `"redo re-applies undone action"` | Redo works after undo |
| 4 | `"new action clears redo stack"` | Standard redo invalidation |
| 5 | `"respects maxSize limit"` | Old actions are dropped |
| 6 | `"BatchPaintAction - execute paints all tiles"` | All tiles in batch are painted |
| 7 | `"BatchPaintAction - undo restores all tiles to prior state"` | Each tile reverts to its old value |
| 8 | `"BatchPaintAction - entire batch is one undo step"` | One `state.undo()` undoes all tiles |

#### ToolManager Tests — [src/tools/ToolManager.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/ToolManager.test.js)

| # | Test Title | What it verifies |
|---|-----------|-----------------|
| 1 | `"setTool changes active tool and emits"` | Tool switching works |
| 2 | `"BrushTool paints ground tile on down"` | End-to-end brush painting |
| 3 | `"BrushTool paints on move (drag)"` | Drag painting |
| 4 | `"EraseTool resets tile to default"` | Eraser works |
| 5 | `"FillTool paints inside a border"` | BFS fill stays within boundary |
| 6 | `"FillTool fill undoes as a single step"` | BatchPaintAction — one Ctrl+Z reverts all |
| 7 | `"SpawnerTool adds entity to manifest"` | Entity creation |
| 8 | `"WarpTool adds warp to manifest and tile"` | Warp creation |
| 9 | `"WarpTool blocks placement on non-walkable tiles"` | Guard works with tileDefs |
| 10 | `"WarpTool allows placement on walkable tiles"` | Guard doesn't block valid placement |
| 11 | `"ZoneTool sets zone flag on tile"` | Zone painting |
| 12 | `"every tool has a declared static shortcut (not null)"` | Completeness — no tool forgot to declare |
| 13 | `"no two tools share the same shortcut key"` | No collision between tool shortcuts |

#### ShortcutManager Tests — [src/core/ShortcutManager.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/ShortcutManager.test.js)

| # | Test Title | What it verifies |
|---|-----------|-----------------|
| 1 | `"register - stores entry, retrievable via getAll()"` | Basic registration |
| 2 | `"register - throws on duplicate canonical key"` | Collision detection |
| 3 | `"register - plain z and ctrl+z are distinct"` | Case/modifier canonicalisation |
| 4 | `"dispatch - calls action for matching plain key"` | Key dispatch works |
| 5 | `"dispatch - calls action for ctrl+key combo"` | Modifier keys work |
| 6 | `"dispatch - does not fire when activeElement is INPUT"` | Text input guard |
| 7 | `"dispatch - does not fire when activeElement is TEXTAREA"` | Text input guard |
| 8 | `"dispatch - ignores key-repeat events (e.repeat = true)"` | OS key-repeat debounce |
| 9 | `"dispatch - does nothing for unregistered key"` | No-op on unknown key |
| 10 | `"getAll - returns a copy; mutation does not affect registry"` | Defensive copy |
| 11 | `"registerCoreShortcuts - registers undo, redo, save entries"` | Core shortcuts present |
| 12 | `"registerToolShortcuts - throws if a tool has shortcut = null"` | Completeness enforcement |
| 13 | `"registerToolShortcuts - skips tools with shortcut = ''"` | Intentional no-shortcut |
| 14 | `"registerToolShortcuts - throws if two tools share the same key"` | Collision detection |

#### Server Tests — [src/server/server.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/server/server.test.js)

| # | Test Title | What it verifies |
|---|-----------|--------|
| 1 | `"Atomic Save - Promotion Sequence"` | tmp → master rename, version bump, old backup |
| 2 | `"Deploy - copies master files to deploy directory"` | Master copied to web/maps/, master untouched |
| 3 | `"Atomic Save - Zero Data Loss on Sequential Saves"` | Two saves in sequence, no data lost |

**Run all tests:** `cd map-maker && node --test src/**/*.test.js`

---

### Browser Verification (Antigravity browser agent)

After each phase, the implementing agent **must open `http://localhost:5173/`** and verify:

| Phase | What to verify in browser |
|-------|--------------------------|
| Phase 1+2 | N/A (unit tests only) |
| Phase 3 | Green grass chunk renders on load. No console errors. |
| Phase 4 | Sidebar populated. Click ground tile → label updates. Click entity tool → tool highlights. |
| Phase 5 | Create new map → paint tiles → auto-save triggers within 5s → SAVE MASTER → version increments. |
| **Integration** | **Full round-trip: Create map → paint Forest tiles → SAVE MASTER → reload page → Load map → tiles persist. Also: Create second map → switch between maps.** |

---

## Implementation Order

Each phase should be implemented as a separate task. The implementing model should:

1. Write the module.
2. Write its test file.
3. Run `node --test` and fix until green.
4. If it involves rendering or UI, verify in the browser.
5. Only then move to the next phase.

| Step | What | Files | Depends on |
|------|------|-------|------------|
| 1 | EventBus | [core/EventBus.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/EventBus.js), [core/EventBus.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/EventBus.test.js) | Nothing |
| 2 | MapState | [core/MapState.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.js), [core/MapState.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.test.js) | EventBus |
| 3 | ActionHistory + Actions | [core/ActionHistory.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/ActionHistory.js), [core/Actions.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/Actions.js), [core/ActionHistory.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/ActionHistory.test.js) | MapState |
| 4 | ItemRegistry | [core/ItemRegistry.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/ItemRegistry.js) | Nothing |
| 5 | All Tools | `tools/*.js`, [tools/ToolManager.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/ToolManager.test.js) | MapState, Actions, ItemRegistry |
| 6 | TileColors + Viewport | [rendering/TileColors.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/rendering/TileColors.js), [rendering/Viewport.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/rendering/Viewport.js) | Nothing |
| 7 | MapRenderer | [rendering/MapRenderer.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/rendering/MapRenderer.js) | EventBus, MapState, TileColors |
| 8 | SidebarUI + PropertyPanel + StatusBar | `ui/*.js` | EventBus, MapState, ItemRegistry |
| 9 | PersistenceClient | [persistence/PersistenceClient.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/persistence/PersistenceClient.js) | EventBus, MapState |
| 10 | main.js + index.html + style.css | Wiring | Everything |
| 11 | Full browser verification | — | Everything |

> [!CAUTION]
> **Do not skip browser verification.** The last 3 sessions have repeatedly marked things as "done" without confirming they work. Each phase that touches rendering or UI **must** be opened in the browser and tested interactively before proceeding.

---
## Step 12: Polish & Bug Fixes
- [ ] **Smooth Painting**: Implement Bresenham's line algorithm in [BrushTool.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/BrushTool.js) to fill gaps when moving the mouse quickly.
- [x] **Layer Rendering**: `warp` and `zone` tiles render as semi-transparent overlays with a border. Warp and spawn point entities rendered as distinct icons (diamond / star) in the entity layer.
- [x] **Save Stability**: `copy + delete` fallback implemented in [server.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/server/server.js) for Windows `EPERM` on rename.
- [x] **Deploy bug**: `/api/deploy` was reading `{ mapName, deploy }` but client sends `{ name }` — always took the delete branch. Fixed to read `name` and always copy.
- [x] **Coordinate readout**: StatusBar displays `Cursor: (x, y)` via `cursor:moved` event.
- [ ] **Zone selector UI**: ZoneTool currently only paints `'active_zone'`. A zone name/ID selector is needed in the sidebar so multiple distinct named zones can be painted on the same map.
- [ ] **UI Polish**: Descriptive tooltips on palette items. Improved tool icons in entity palette.

## Extensibility Guide

This tool will grow over time. Future sessions will add features we can't predict today. To make that manageable, a **[map-maker/CONTRIBUTING.md](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/CONTRIBUTING.md)** file must be created alongside the rewrite (Step 10). It should contain the following guidance:

### How to Add a New Tool

1. Create `src/tools/MyTool.js` extending `Tool` from `BrushTool.js`. Implement `onDown(tx, ty)`, `onMove(tx, ty)`, `onUp()`.
2. Declare `static shortcut = 'x'` (or `''` for no shortcut). The completeness test will fail with a clear error if this is missing.
3. Register it in [ToolManager.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/ToolManager.js) constructor: `this.tools.set('mytool', new MyTool(state))`.
4. Add a button in [index.html](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/index.html) with `id="tool-mytool"`. SidebarUI auto-wires it via the `tool-*` convention.
5. Write tests in [src/tools/ToolManager.test.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/tools/ToolManager.test.js).
6. Run `npm test` — the shortcut completeness tests will catch any collision or missing declaration.
7. Verify in browser.

### How to Add a New Tile Layer

1. Add the field to the default tile in `MapState._createEmptyChunk()`: `{ base, item, zone, warp, newLayer: null }`.
2. Create actions in [Actions.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/Actions.js) if the layer uses undo/redo.
3. Add rendering logic in `MapRenderer._drawTile()` for the visual overlay.
4. Add a corresponding tool in `src/tools/` if it needs painting interaction.
5. Update [TileColors.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/rendering/TileColors.js) if the layer has visual representation.

### How to Add a New Entity Type

1. Add the array to [MapState](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/State.js#5-80) constructor's manifest: `this.manifest.myEntities = []`.
2. Add [addEntity](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.js#90-98) / [removeEntity](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.js#99-107) cases in [MapState.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/core/MapState.js).
3. Create a tool in `src/tools/MyEntityTool.js`.
4. Update [SidebarUI.js](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/ui/SidebarUI.js) [refreshEntityList()](file:///c:/Users/lauri/Documents/Repos/random-stuff/pet-protector/map-maker/src/ui/SidebarUI.js#81-102) to include the new type.
5. Update `MapRenderer._renderEntities()` to draw it.

### How to Add a New Event

1. Add the event name to the table in this plan.
2. Emit it from the appropriate module using `bus.emit('event:name', data)`.
3. Subscribe to it in the consuming module(s).

> [!IMPORTANT]
> **Every new feature follows the same cycle:** write module → write test → run tests → verify in browser → mark done. No exceptions.
