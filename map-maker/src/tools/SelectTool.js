import { Tool } from './BrushTool.js';

/**
 * Inspects a tile and all manifest entities located at its coordinates.
 *
 * Emits 'tile:inspected' with:
 *   { tx, ty, tileData, entities }
 *
 * Where:
 *   tileData  — the raw tile object ({ base, decoration, pickup, zone, warp })
 *   entities  — all manifest entries (any type) whose x/y matches the clicked tile,
 *               each augmented with _type (the manifest array key, e.g. 'spawnPoints')
 *
 * Entity discovery is intentionally generic: every array in manifest is scanned.
 * New entity types (NPCs, loot tables, etc.) are automatically included without
 * any changes to this file.
 */
export class SelectTool extends Tool {
    static shortcut = 'v';

    constructor(state, bus) {
        super(state);
        this.bus = bus;
    }

    onDown(tx, ty) {
        if (!this.bus) return;

        const tileData = this.state.getTileData(tx, ty);

        const entities = [];
        for (const [type, value] of Object.entries(this.state.manifest)) {
            if (Array.isArray(value)) {
                value
                    .filter(e => e.x === tx && e.y === ty)
                    .forEach(e => entities.push({ ...e, _type: type }));
            }
        }

        this.bus.emit('tile:inspected', { tx, ty, tileData, entities });
    }
}
