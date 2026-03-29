import { ActionHistory } from './ActionHistory.js';

/** Number of tiles along each side of a chunk. Changing this is a breaking data change. */
export const CHUNK_SIZE = 32;

/**
 * The single source of truth for all map data.
 *
 * Stores tiles in fixed-size chunks (CHUNK_SIZE × CHUNK_SIZE) for efficient
 * rendering and serialization. Chunks are created lazily on first access,
 * so the map is effectively infinite in all directions.
 *
 * Also holds the manifest (spawn points, zones, warps) and the undo/redo history.
 *
 * Must contain no DOM, PIXI, or HTTP logic — pure data only.
 * Emits 'state:changed' via the EventBus on every mutation.
 */
export class MapState {
    /** @param {EventBus} bus */
    constructor(bus) {
        this.bus = bus;
        this.mapName = 'new_map';
        this.manifest = {
            version: 0,
            spawnPoints: [],
            zones: [],
            warps: []
        };
        this.chunks = new Map(); // chunkId -> { tiles: Tile[][] }
        this.history = new ActionHistory();
        this.dirty = false;      // true when there are unsaved changes
        this.needsRedraw = true; // true when the renderer should re-render
    }

    /**
     * Apply an action through the undo/redo history.
     * All tile and entity mutations should go through here.
     * @param {Action} action
     */
    applyAction(action) {
        this.history.push(action, this);
    }

    /** Undo the most recent action. */
    undo() {
        this.history.undo(this);
    }

    /** Redo the most recently undone action. */
    redo() {
        this.history.redo(this);
    }

    /**
     * Returns the chunk ID string for a given world tile coordinate.
     * @param {number} x - World tile X
     * @param {number} y - World tile Y
     * @returns {string} e.g. 'chunk_0_0', 'chunk_-1_2'
     */
    getChunkId(x, y) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        return `chunk_${cx}_${cy}`;
    }

    /**
     * Returns the chunk containing the given world tile coordinate.
     * Creates and registers an empty chunk if it doesn't exist yet.
     * @param {number} x - World tile X
     * @param {number} y - World tile Y
     * @returns {{ tiles: Tile[][] }}
     */
    getChunk(x, y) {
        const id = this.getChunkId(x, y);
        if (!this.chunks.has(id)) {
            this.chunks.set(id, this._createEmptyChunk());
            this.needsRedraw = true;
        }
        return this.chunks.get(id);
    }

    /**
     * Creates a blank CHUNK_SIZE × CHUNK_SIZE grid with all layers defaulted to null.
     * @returns {{ tiles: Tile[][] }}
     */
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

    /**
     * Returns the tile data at world coordinates (x, y).
     * Creates the enclosing chunk lazily if needed.
     * @param {number} x
     * @param {number} y
     * @returns {Tile}
     */
    getTileData(x, y) {
        const chunk = this.getChunk(x, y);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.tiles[ly][lx];
    }

    /**
     * Directly mutates a tile layer. Prefer going through applyAction()
     * so the change participates in undo/redo history.
     * @param {number} x
     * @param {number} y
     * @param {string} layer - 'base' | 'decoration' | 'pickup' | 'zone' | 'warp'
     * @param {string|null} value
     * @returns {boolean} false if the value was already set (no-op)
     */
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

    /**
     * Adds an entity to manifest[type]. Emits 'state:changed'.
     * @param {string} type - 'spawnPoints' | 'warps' | 'zones'
     * @param {Object} data - Must include a unique `id` field
     */
    addEntity(type, data) {
        if (!this.manifest[type]) this.manifest[type] = [];
        this.manifest[type].push(data);
        this.dirty = true;
        if (this.bus) {
            this.bus.emit('state:changed', { type: 'entity:added', entityType: type, data });
        }
    }

    /**
     * Removes an entity from manifest[type] by id. Emits 'state:changed'.
     * @param {string} type - 'spawnPoints' | 'warps' | 'zones'
     * @param {string} id
     */
    removeEntity(type, id) {
        if (!this.manifest[type]) return;
        this.manifest[type] = this.manifest[type].filter(e => e.id !== id);
        this.dirty = true;
        if (this.bus) {
            this.bus.emit('state:changed', { type: 'entity:removed', entityType: type, id });
        }
    }

    /**
     * Serializes the full map state to a plain object for saving.
     * @returns {{ mapName: string, manifest: Object, chunks: Object }}
     */
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

    /**
     * Restores state from a serialized snapshot (e.g. loaded from server).
     * Resets dirty/needsRedraw flags and emits 'state:changed' to trigger a re-render.
     * @param {{ mapName: string, manifest: Object, chunks: Object }} data
     */
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
