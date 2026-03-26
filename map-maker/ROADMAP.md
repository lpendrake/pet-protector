# Map Maker — Feature Roadmap

Tracked features and ideas for future development. Items here are **not currently planned** but are architecturally anticipated and can be added via the patterns in `CONTRIBUTING.md`.

---

## Rendering & Visual

- [ ] **Tileset theming** — Abstract tile IDs map to sprite sheets. Same map data, different visual styles. Swap themes at render time.
- [ ] **Multi-decoration per tile** — `decoration` layer becomes `[{ id, offsetX, offsetY }]` for composing scenes (table + lamp + flowers on one tile).
- [ ] **Sub-tile offset placement** — Decorations and pickups can be offset from tile center for natural-looking placement.
- [ ] **Layer visibility toggles** — Hide zones/warps/decorations while painting terrain.
- [ ] **Minimap overlay** — Small overview map for orientation on large maps.
- [ ] **Animated tiles** — Water, fire, etc. with frame-based animation support in tile defs.

## Tools & Editing

- [ ] **Multi-tile brush sizes** — 2×2, 3×3, custom rectangle brushes.
- [ ] **Copy/paste region selection** — Select, copy, and stamp regions of tiles.
- [ ] **Keyboard shortcuts for tools** — Number keys, letter keys for quick tool switching.
- [ ] **Eyedropper tool** — Click a tile to select its type as the active brush.
- [ ] **Auto-tiling** — Smart tile placement (e.g., road tiles auto-select inner/outer corners, edges based on neighbours).
- [ ] **Line tool** — Click two points, fill a straight line of tiles between them.
- [ ] **Rectangle tool** — Click and drag to fill a rectangular region.

## Data & Definitions

- [ ] **Item definition editor UI** — Add/edit/remove items and decorations from within the map maker.
- [ ] **Tile definition editor UI** — Add/edit tile types without editing JSON.
- [ ] **Map metadata** — Name, description, author, creation date stored in manifest.
- [ ] **Walkability editor** — Visual overlay showing which tiles are walkable vs blocked.

## Maps & Persistence

- [ ] **Map rename/delete** — Manage maps from within the tool.
- [ ] **Export/import** — Download/upload map as a zip for sharing or backup.
- [ ] **Map templates** — Start from a preset (blank, island, dungeon layout).
- [ ] **Version diff viewer** — Compare current vs old vs deployed versions visually.

## Game Integration

- [ ] **Live preview** — Run the game engine in a viewport alongside the editor.
- [ ] **Warp graph visualiser** — Show connections between maps as a node graph.
- [ ] **NPC placement** — Place and configure NPC entities with dialogue/behavior.
- [ ] **Event triggers** — Define tile-based events (cutscenes, battles, dialogue).

---

> **To add a feature:** Move it from this list into the implementation plan, break it into steps, write tests, implement, verify in browser, then check it off here.
