/**
 * Visual constants for the map editor's tile renderer.
 *
 * CONTRIBUTING: To add a new tile type, add entries to:
 *   - data/tile_defs.json   (tile definition — id, name, category, walkable, etc.)
 *   - TILE_COLORS           (hex color for the tile in the render canvas)
 *   - TILE_LABELS           (1-2 char label shown in the editor palette)
 *
 * These are editor-only constants. The game engine does not import this file.
 */

export const TILE_COLORS = {
    'empty':         0x222222,
    'grass_v1':      0x3a5a40,
    'forest_v1':     0x1e4d2b,
    'dirt_path':     0xa68a64,
    'water_shallow': 0x4da6d4,
    'water_deep':    0x0d4f8c,
    'rock_v1':       0x7a7a7a,
    'cave_v1':       0x3a3040,
    'ruins_v1':      0x6b5030,
};

// Short label shown on each tile in the editor palette (1-2 chars)
export const TILE_LABELS = {
    'grass_v1':      'G',
    'forest_v1':     'F',
    'dirt_path':     'D',
    'water_shallow': '~',
    'water_deep':    '≈',
    'rock_v1':       'R',
    'cave_v1':       'C',
    'ruins_v1':      'X',
};

export const LAYER_COLORS = {
    'decoration': 0xffd166,
    'pickup': 0xef476f,
    'zone': 0x06d6a0,
    'warp': 0x118ab2
};

/**
 * Returns the hex color for a tile type. Falls back to the 'empty' color if unknown.
 * @param {string} id - Tile type ID (e.g. 'grass_v1')
 * @returns {number} 24-bit hex color
 */
export function getTileColor(id) {
    return TILE_COLORS[id] || TILE_COLORS['empty'];
}

/**
 * Returns the hex color for a tile layer overlay (decoration, pickup, zone, warp).
 * Falls back to white (0xffffff) if the layer name is unknown.
 * @param {string} layer
 * @returns {number} 24-bit hex color
 */
export function getLayerColor(layer) {
    return LAYER_COLORS[layer] || 0xffffff;
}
