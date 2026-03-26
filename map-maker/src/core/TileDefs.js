import tileData from '../data/tile_defs.json';

export class TileDefs {
    constructor() {
        console.log('[DEBUG] TileDefs constructor, raw data:', tileData);
        this.tiles = tileData || {};
    }

    getTile(id) {
        return this.tiles[id] || this.tiles['empty'];
    }

    getAllTiles() {
        return Object.entries(this.tiles).map(([id, data]) => ({ id, ...data }));
    }

    getTilesByCategory(category) {
        return this.getAllTiles().filter(t => t.category === category);
    }
}

export const Registry = new TileDefs();
