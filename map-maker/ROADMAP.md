# Map Maker — Feature Roadmap

Tracked features and ideas for future development. Items here are **not currently planned** but are architecturally anticipated. See `implementation_plan.md` for active work.

> **To activate a feature:** Move it from here into the implementation plan, break it into steps, write tests, implement, verify in browser, then check it off here.

---

## System Overhauls

These are architectural changes to the data model and core systems. Each is a significant body of work.

### Universal ID System

**Everything gets a stable ID.** Maps, items, warps, spawn points, zones, effects.

| Rule | Detail |
|------|--------|
| Format | Patterned random string: `warp_<random>`, `item_<random>`, `map_<random>` |
| Uniqueness | Duplicate check on generation |
| Stability | ID never changes on rename. `name` is display, `id` is reference. |
| Scope | Maps, items, warps, spawn points, zones, effects — all of them |

**Migration**: Add `id` field to maps (currently identified by name only). Ensure all entity creation uses patterned IDs with collision checks. Audit existing `Date.now()`-based IDs.

### Item Template System

Replace hardcoded `ItemRegistry.js` with a persisted, global item template registry.

**What is an item?** Any interactive thing in the world — not just consumables. Apples, pillars, keys, flowers, story objects.

**Template structure** (tentative):
```js
{
  id: 'item_abc123',
  name: 'Golden Apple',
  graphic: 'apple_gold',
  category: 'consumable',
  effects: [
    { type: 'stat_change', stat: 'nutrition', value: 25 },
  ],
  consumable: true,
  persistent: true,
}
```

**Two placement modes**, same template:
1. **Pre-placed** — editor places on a tile, game tracks state permanently
2. **Zone-spawned** — zone creates instances from template at runtime

**Editor UX**: Select tile → add item from dropdown of existing templates → or create new template inline → save. Templates are global across all maps and published alongside them.

**Decorations vs items**: Decorations are dumb visuals (the pillar graphic). Items are smart/interactive (the pillar's behaviour). Same tile can have both.

**Current `tile.pickup`** stores a raw string. Needs to become a template ID reference, with item instances tracked in the manifest for pre-placed items that need persistent state.

### Zone Redesign

Current `tile.zone` is a single string per tile — wrong. Zones need to be multi-tile, non-contiguous, and overlapping.

**Target model**: Zones as manifest entities with their own tile sets:
```js
{
  id: 'zone_orchard',
  name: 'Apple Orchard',
  tiles: [{ x: 5, y: 3 }, { x: 5, y: 4 }, { x: 6, y: 3 }],
  effects: [
    {
      type: 'spawn_item',
      itemTemplateId: 'item_apple',
      maxCount: 5,
      intervalMinutes: 5,
      spawnMode: 'random_tiles',
    }
  ]
}
```

**Key properties**:
- Multi-tile, non-contiguous (trees in an orchard, not paths between them)
- Overlapping (a tile can belong to multiple zones)
- Multiple effects per zone (spawn apples AND butterflies from same zone)
- Real-time tracking: zone spawning ticks even when player is off-map

**Zone painting**: The zone tool selects which zone to paint for (zone selector UI), then adds/removes tiles from that zone's tile set in the manifest. Remove `tile.zone` field entirely.

### Warp Linking

Change warp data model from raw coordinates to spawn point references:

```js
// Current
{ targetMap: 'forest', targetPos: { x: 10, y: 5 } }

// Target
{ targetMapId: 'map_forest', targetSpawnId: 'spawn_north_gate', requiresBoth: true }
```

**Editor UI**: Target Map dropdown (from `listMaps()`) → Target Spawn Point dropdown (loaded from target map's manifest). `requiresBoth` checkbox (default true — both spirit and pet must be on tile).

**Cross-map**: Editor uses saved maps (not deployed). Graceful runtime failure if target missing — debug log, no crash, player not stranded. One-way warps intentional (cliff falls, story).

### Structured Effect System

Most item/zone behaviours are configurable through structured builders:

| Effect type | Parameters | Example |
|-------------|-----------|---------|
| `stat_change` | `stat`, `value` | `+25 nutrition` |
| `spawn_item` | `itemTemplateId`, `maxCount`, `intervalMinutes`, `spawnMode` | Zone spawns apples |
| `transform` | `targetItemTemplateId`, `delayMinutes` | Flower → apple after 5 min |
| `teleport` | `targetMapId`, `targetSpawnId` | Dimensional key |
| `visual_change` | `newGraphic` | Pillar starts glowing |
| `trigger_event` | `eventId` | Story trigger |

Scripting (`run_script`) deferred — structured effects cover initial needs.

### Publishing & Content Pipeline

The editor produces more than maps — item templates, zone definitions, and eventually more. The deploy system needs to extend:
- Map files (chunks + manifest) — already handled
- Item template registry — new, needs save/load/deploy
- One "deploy" publishes everything a map needs to work

---

## Data Model Migration Order

| Step | What | Breaking? |
|------|------|-----------|
| 1 | Universal ID system (add IDs to maps, audit entities) | Non-breaking |
| 2 | Item template registry (replace `ItemRegistry.js`, persist globally) | Yes |
| 3 | Zone redesign (manifest entities with tile sets, remove `tile.zone`) | Yes |
| 4 | Warp linking (map ID + spawn ID, dropdown UI) | Yes |
| 5 | Effect system (structured builders in PropertyPanel) | Additive |

Each step is a separate session. The select tool + PropertyPanel foundation supports all of them.

---

## Rendering & Visual

- [ ] **Tileset theming** — Abstract tile IDs map to sprite sheets. Same map data, different visual styles.
- [ ] **Multi-decoration per tile** — `decoration` layer becomes `[{ id, offsetX, offsetY }]` for composing scenes.
- [ ] **Sub-tile offset placement** — Decorations and items can be offset from tile center.
- [ ] **Layer visibility toggles** — Hide zones/warps/decorations while painting terrain.
- [ ] **Minimap overlay** — Small overview map for orientation on large maps.
- [ ] **Animated tiles** — Water, fire, etc. with frame-based animation support.

## Tools & Editing

- [ ] **Smooth painting** — Bresenham's line algorithm in BrushTool (partially done, needs verification).
- [ ] **Multi-tile brush sizes** — 2x2, 3x3, custom rectangle brushes.
- [ ] **Copy/paste region** — Select, copy, and stamp regions of tiles.
- [ ] **Eyedropper tool** — Click a tile to select its type as the active brush.
- [ ] **Auto-tiling** — Smart tile placement (roads auto-select corners/edges based on neighbours).
- [ ] **Line tool** — Click two points, fill a straight line between them.
- [ ] **Rectangle tool** — Click and drag to fill a rectangular region.
- [ ] **Select/erase UX improvements** — Pending user feedback on current implementation.

## Maps & Persistence

- [ ] **Map rename/delete** — Manage maps from within the tool.
- [ ] **Export/import** — Download/upload map as a zip for sharing or backup.
- [ ] **Map templates** — Start from a preset (blank, island, dungeon layout).
- [ ] **Version diff viewer** — Compare current vs old vs deployed versions visually.

## Game Integration

- [ ] **Live preview** — Run the game engine in a viewport alongside the editor.
- [ ] **Warp graph visualiser** — Show connections between maps as a node graph.
- [ ] **NPC placement** — Place and configure NPC entities with dialogue/behavior.
- [ ] **Event triggers** — Define tile-based events (cutscenes, dialogue).
