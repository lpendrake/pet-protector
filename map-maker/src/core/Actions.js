/**
 * Base class for all undoable actions.
 *
 * Every state mutation must be wrapped in an Action subclass and applied
 * via MapState.applyAction() to participate in the undo/redo history.
 * Direct calls to state.setTileData() or state.addEntity() bypass history.
 */
export class Action {
    constructor() {
        // Stored for future use: timestamped history panel, merging rapid
        // consecutive paint strokes into one undo step, or conflict detection.
        this.timestamp = Date.now();
    }
    execute(state) {}
    undo(state) {}
}

/**
 * Applies a batch of tile paint operations as a single undoable action.
 * Use this instead of multiple PaintTileActions whenever a logical operation
 * affects more than one tile (e.g. flood fill) so the whole operation undoes
 * in one Ctrl+Z.
 *
 * Undo iterates in reverse order in case of any ordering dependencies between tiles.
 *
 * @param {Array<{ x: number, y: number, layer: string, newValue: string|null, oldValue: string|null }>} paints
 */
export class BatchPaintAction extends Action {
    constructor(paints) {
        super();
        this.paints = paints;
    }

    execute(state) {
        for (const p of this.paints) {
            state.setTileData(p.x, p.y, p.layer, p.newValue);
        }
    }

    undo(state) {
        for (const p of [...this.paints].reverse()) {
            state.setTileData(p.x, p.y, p.layer, p.oldValue);
        }
    }
}

/**
 * Paints a single value onto a single layer of a single tile.
 * Captures both old and new values so the operation is fully reversible.
 *
 * @param {number} x - World tile X coordinate
 * @param {number} y - World tile Y coordinate
 * @param {string} layer - Tile layer to modify ('base', 'decoration', 'pickup', 'zone', 'warp')
 * @param {string|null} newValue - The value to write
 * @param {string|null} oldValue - The value to restore on undo
 */
export class PaintTileAction extends Action {
    constructor(x, y, layer, newValue, oldValue) {
        super();
        this.x = x;
        this.y = y;
        this.layer = layer;
        this.newValue = newValue;
        this.oldValue = oldValue;
    }

    execute(state) {
        state.setTileData(this.x, this.y, this.layer, this.newValue);
    }

    undo(state) {
        state.setTileData(this.x, this.y, this.layer, this.oldValue);
    }
}

/**
 * Adds an entity to manifest[type] (e.g. a spawnPoint or warp).
 * Reversed by removing the entity by id.
 *
 * @param {string} type - Manifest array key ('spawnPoints', 'warps')
 * @param {Object} data - Entity data; must include a unique `id` field
 */
export class PlaceEntityAction extends Action {
    constructor(type, data) {
        super();
        this.type = type;
        this.data = data;
    }

    execute(state) {
        state.addEntity(this.type, this.data);
    }

    undo(state) {
        state.removeEntity(this.type, this.data.id);
    }
}

/**
 * Removes an entity from manifest[type] by id.
 * Reversed by re-adding the original entity data.
 *
 * @param {string} type - Manifest array key ('spawnPoints', 'warps')
 * @param {Object} data - Full entity data snapshot (needed to restore on undo)
 */
export class RemoveEntityAction extends Action {
    constructor(type, data) {
        super();
        this.type = type;
        this.data = data;
    }

    execute(state) {
        state.removeEntity(this.type, this.data.id);
    }

    undo(state) {
        state.addEntity(this.type, this.data);
    }
}
