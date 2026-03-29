import tileData from '../data/tile_defs.json' with { type: 'json' };

/**
 * Wraps tile_defs.json and provides typed lookup methods.
 *
 * Ground tiles are data-driven — add a new tile type by:
 *   1. Adding an entry to src/data/tile_defs.json
 *   2. Adding a color + label to src/rendering/TileColors.js
 * No code changes required elsewhere.
 *
 * The module-level singleton `Registry` is what all consumers should import.
 */
export class TileDefs {
    constructor() {
        this.tiles = tileData || {};
    }

    /**
     * Look up a tile definition by ID.
     * Falls back to 'empty' if the ID is unknown.
     * @param {string} id - Tile ID (e.g. 'grass_v1', 'water_deep')
     * @returns {{ id: string, name: string, category: string, walkable: boolean }}
     */
    getTile(id) {
        return this.tiles[id] || this.tiles['empty'];
    }

    /**
     * Returns all tile definitions as an array, each with its id injected.
     * @returns {Array<{ id: string, name: string, category: string, walkable: boolean }>}
     */
    getAllTiles() {
        return Object.entries(this.tiles).map(([id, data]) => ({ id, ...data }));
    }

    /**
     * Returns all tile definitions matching a given category.
     * @param {string} category - e.g. 'natural', 'water', 'dungeon', 'path'
     */
    getTilesByCategory(category) {
        return this.getAllTiles().filter(t => t.category === category);
    }
}

/** Singleton — import this, not the class directly. */
export const Registry = new TileDefs();
