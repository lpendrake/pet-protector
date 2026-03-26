import { ActionHistory } from './ActionHistory.js';

export const CHUNK_SIZE = 32;

export class MapState {
    constructor(bus) {
        this.bus = bus;
        this.mapName = 'new_map';
        this.manifest = {
            version: 0,
            spawnPoints: [],
            zones: [],
            warps: []
        };
        this.chunks = new Map(); // id -> { tiles: [][] }
        this.history = new ActionHistory();
        this.dirty = false;
        this.needsRedraw = true;
    }

    applyAction(action) {
        this.history.push(action, this);
    }

    undo() {
        this.history.undo(this);
    }

    redo() {
        this.history.redo(this);
    }

    getChunkId(x, y) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        return `chunk_${cx}_${cy}`;
    }

    getChunk(x, y) {
        const id = this.getChunkId(x, y);
        if (!this.chunks.has(id)) {
            this.chunks.set(id, this._createEmptyChunk());
            this.needsRedraw = true;
        }
        return this.chunks.get(id);
    }

    _createEmptyChunk() {
        const tiles = [];
        for (let y = 0; y < CHUNK_SIZE; y++) {
            tiles[y] = [];
            for (let x = 0; x < CHUNK_SIZE; x++) {
                tiles[y][x] = { 
                    base: 'empty', 
                    decoration: null, 
                    pickup: null, 
                    zone: null, 
                    warp: null 
                };
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
        
        const oldTile = chunk.tiles[ly][lx];
        if (oldTile[layer] === value) return false;

        oldTile[layer] = value;
        this.dirty = true;
        this.needsRedraw = true;
        
        if (this.bus) {
            this.bus.emit('state:changed', { type: 'tile', x, y, layer, value });
        }
        return true;
    }

    addEntity(type, data) {
        if (!this.manifest[type]) this.manifest[type] = [];
        this.manifest[type].push(data);
        this.dirty = true;
        if (this.bus) {
            this.bus.emit('state:changed', { type: 'entity:added', entityType: type, data });
        }
    }

    removeEntity(type, id) {
        if (!this.manifest[type]) return;
        this.manifest[type] = this.manifest[type].filter(e => e.id !== id);
        this.dirty = true;
        if (this.bus) {
            this.bus.emit('state:changed', { type: 'entity:removed', entityType: type, id });
        }
    }

    serialize() {
        const chunksObj = {};
        for (const [id, data] of this.chunks) {
            chunksObj[id] = data;
        }
        return {
            mapName: this.mapName,
            manifest: this.manifest,
            chunks: chunksObj
        };
    }

    deserialize(data) {
        this.mapName = data.mapName || 'unnamed';
        this.manifest = data.manifest || { version: 0, spawnPoints: [], zones: [], warps: [] };
        this.chunks = new Map();
        if (data.chunks) {
            for (const [id, chunkData] of Object.entries(data.chunks)) {
                this.chunks.set(id, chunkData);
            }
        }
        this.dirty = false;
        this.needsRedraw = true;
        if (this.bus) {
            this.bus.emit('state:changed', { type: 'load' });
        }
    }
}
