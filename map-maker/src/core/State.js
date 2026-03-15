import { ActionHistory } from './Actions.js';

export const CHUNK_SIZE = 32;

export class MapState {
    constructor() {
        this.mapName = 'new_map';
        this.manifest = {
            version: 0,
            spawnPoints: [],
            zones: [],
            warps: []
        };
        this.chunks = {}; // id -> { tiles: [][] }
        this.history = new ActionHistory();
        this.lastSaveTime = 0;
        this.dirty = false;
    }

    getChunkId(x, y) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        return `chunk_${cx}_${cy}`;
    }

    getChunk(x, y) {
        const id = this.getChunkId(x, y);
        if (!this.chunks[id]) {
            this.chunks[id] = this._createEmptyChunk();
        }
        return this.chunks[id];
    }

    _createEmptyChunk() {
        const tiles = [];
        for (let y = 0; y < CHUNK_SIZE; y++) {
            tiles[y] = [];
            for (let x = 0; x < CHUNK_SIZE; x++) {
                tiles[y][x] = { base: 'grassland', item: null, zone: null, warp: null };
            }
        }
        return { tiles };
    }

    getTileData(x, y) {
        const chunk = this.getChunk(x, y);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.tiles[ly][lx];
    }

    setTileData(x, y, layer, value) {
        const chunk = this.getChunk(x, y);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        chunk.tiles[ly][lx][layer] = value;
        this.dirty = true;
    }

    // Call this for user actions to support Undo
    applyAction(action) {
        this.history.push(action, this);
        this.dirty = true;
    }

    undo() {
        this.history.undo(this);
    }

    redo() {
        this.history.redo(this);
    }
}

export const GlobalState = new MapState();
