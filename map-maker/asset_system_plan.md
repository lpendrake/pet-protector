# Asset System — Sprite-Based Tile Rendering

## Problem

The map editor renders tiles as colored rectangles and decorations as emojis. We now have a real pixel art tileset (Craftpix grassland, 16x16 tiles) and need to render actual sprites. The system must also support individual PNG files for custom art created later.

## Design Goals

1. **Semantic tile IDs** — Maps store `"ground_grass_5_3"`, not spritesheet coordinates. Swapping art packs means changing tile definitions, not map data.
2. **Spritesheet + individual file support** — Tile defs can reference a region in a spritesheet (`{ sheet, col, row }`) or a standalone file (`{ file }`). Both resolve to a PixiJS `Texture`.
3. **Auto-import from Tiled `.tmx`** — A one-time script generates `tile_defs.json` entries from the Tiled example map, so we don't hand-write hundreds of coordinates.
4. **Native 16px rendering** — Tiles render at their source 1:1 pixel size. Zoom handles magnification.

---

## Phase 1: TMX Import Script

**New file:** `src/scripts/import-tmx.js` (Node CLI)

Parses `Tiled_files/Glades.tmx` to generate `tile_defs.json`:

- Extract `<tileset>` elements: `firstgid`, `name`, `columns`, `tilecount`, `<image source>`
- For each tile 0..tilecount-1: `col = index % columns`, `row = floor(index / columns)`
- Tile ID format: `{sheetPrefix}_{col}_{row}` (e.g. `ground_grass_5_3`)
- Output includes `sprite: { sheet, col, row }` field per tile
- Optionally parse layer data to flag which tiles are actually used in the example map
- Keep the `"empty"` tile (no sprite)
- Add `"import:tmx"` script to package.json

**GID-to-atlas formula:**
```js
function gidToAtlasPos(gid, tilesets) {
    const ts = tilesets.find(t => gid >= t.firstgid);
    const localId = gid - ts.firstgid;
    return {
        sheet: ts.imageSource,
        col: localId % ts.columns,
        row: Math.floor(localId / ts.columns)
    };
}
```

**Verify:** Run script, inspect output JSON, spot-check a few grid coords against the spritesheet.

---

## Phase 2: Extended tile_defs.json Schema

Two sprite source forms:

```json
{
  "_config": {
    "assetBase": "./assets/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG/",
    "tileSize": 16
  },
  "empty": { "name": "Empty", "category": "system", "walkable": true },
  "ground_grass_5_3": {
    "name": "ground_grass 5,3",
    "category": "natural",
    "walkable": true,
    "sprite": { "sheet": "ground_grasss.png", "col": 5, "row": 3 }
  },
  "tree_oak": {
    "name": "Oak Tree",
    "category": "decoration",
    "walkable": false,
    "sprite": { "file": "Objects_separated/Tree1.png" }
  }
}
```

**Changes to `src/core/TileDefs.js`:**
- `getAllTiles()` skips keys starting with `_`
- Add `getConfig()` returning `this.tiles._config`

**Files:** `src/core/TileDefs.js`, `src/data/tile_defs.json`

---

## Phase 3: SpriteAtlas Loader

**New file:** `src/rendering/SpriteAtlas.js`

```
class SpriteAtlas {
  constructor(tileDefs)           // receives TileDefs registry
  async load()                    // loads all referenced PNGs via PIXI.Assets.load()
  get(tileId) -> Texture | null   // sub-texture for the tile, or null for fallback
  getSheetImage(sheet) -> source  // for palette canvas previews
}
```

Implementation:
- Scan tile defs for unique `sprite.sheet` and `sprite.file` values
- Load each unique source once via `PIXI.Assets.load(path)`
- For spritesheet tiles: create sub-textures with `new PIXI.Texture({ source, frame: new Rectangle(col*16, row*16, 16, 16) })`
- Set `scaleMode = 'nearest'` on all base textures (pixel art crispness)
- Cache sub-textures in `Map<tileId, Texture>`
- Resolve paths using Vite's `new URL(path, import.meta.url).href`

**Verify:** `atlas.get('ground_grass_0_0')` returns a Texture with 16x16 frame.

---

## Phase 4: Tile Size + Sprite Rendering (combined)

Done together to avoid a confusing intermediate state of 16px colored rectangles.

### 4a: Tile size 32 -> 16

**File:** `src/rendering/MapRenderer.js`
- `this.tileSize = 32` -> `this.tileSize = 16`
- All hardcoded `+ 16` offsets (lines 129, 158, 166-167) become `+ this.tileSize / 2` with proportionally scaled radii

Nothing else changes: `CHUNK_SIZE` is tiles-per-chunk (stays 32), Viewport already uses `renderer.tileSize`, tools work in tile coords.

### 4b: Sprite rendering

**File:** `src/rendering/MapRenderer.js`
- Constructor takes `atlas` (SpriteAtlas) parameter
- Replace `chunkGraphics: Map<string, Graphics>` with `chunkContainers: Map<string, { root: Container, graphics: Graphics, sprites: Sprite[] }>`
- In `_renderChunk()`: for each tile, check `atlas.get(tile.base)` — if texture exists, use a pooled Sprite; otherwise fallback to `graphics.rect().fill(color)`
- Sprite pooling: hide unused sprites, reuse from pool, create new only when pool exhausted
- Overlay layers (decoration, pickup, zone, warp) stay as Graphics for now

**File:** `src/main.js`
- Import and create SpriteAtlas, pass to MapRenderer
- `await atlas.load()` before `renderer.init()`

**Verify:** Tiles render as pixel art sprites. Zoom shows crispy nearest-neighbor pixels. Paint tool still works. Color fallback works for tiles without sprites.

---

## Phase 5: Palette Sprite Previews

**File:** `src/ui/PalettePanel.js`
- Constructor receives `atlas` parameter
- For each tile with sprite data: render a 32x32 `<canvas>` showing the 16x16 sprite scaled 2x with `imageSmoothingEnabled = false`
- Fallback to colored div with label for tiles without sprites
- Large palette (700+ tiles) needs a category filter dropdown or scrollable container with max-height

**Verify:** Palette shows sprite thumbnails. Clicking selects the tile. Scroll/filter works.

---

## Phase 6: Item/Decoration Sprites

- Add `sprite` fields to `ItemRegistry` definitions
- Extend `SpriteAtlas.load()` to also scan ItemRegistry
- `MapRenderer`: draw Sprite instead of yellow tint when decoration has sprite data
- `PalettePanel`: show sprite preview instead of emoji where available

**Verify:** Place a tree decoration, see actual tree sprite. Palette items show sprite previews.

---

## Vite Asset Path Handling

Vite rewrites asset paths at build time. Use `new URL('./path', import.meta.url).href` for reliable resolution, or import PNGs directly so Vite handles them:

```js
import groundGrassUrl from '../assets/.../PNG/ground_grasss.png';
```

The SpriteAtlas can accept a map of `{ sheetName: resolvedUrl }`.

---

## Phase 7: Review CONTRIBUTING.md

After all implementation is complete, review `CONTRIBUTING.md` to ensure it accurately reflects the final state of the asset system. Update any instructions, file paths, or extension-point docs that changed during implementation.

---

## Files Summary

| File | Action |
|------|--------|
| `src/scripts/import-tmx.js` | Create |
| `src/rendering/SpriteAtlas.js` | Create |
| `src/data/tile_defs.json` | Regenerate via import script |
| `src/core/TileDefs.js` | Edit (skip `_config`, add `getConfig()`) |
| `src/rendering/MapRenderer.js` | Edit (sprites + tile size 32->16) |
| `src/rendering/TileColors.js` | Keep as fallback (no changes) |
| `src/ui/PalettePanel.js` | Edit (sprite previews) |
| `src/core/ItemRegistry.js` | Edit (sprite fields) |
| `src/main.js` | Edit (wire SpriteAtlas) |