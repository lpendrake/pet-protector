import { Tool } from './BrushTool.js';
import { PlaceEntityAction } from '../core/Actions.js';

/**
 * Places a spawn point entity at the clicked tile.
 * Spawn points define where the player/pet enters the map — one per entry point
 * (e.g. per road, cave exit, building door). A map can have any number of them.
 *
 * The game engine selects which spawn point to use based on how the player
 * arrives (e.g. a warp targeting this map points to a specific spawn point ID).
 *
 * The entity is added to manifest.spawnPoints and is rendered as a gold star.
 */
export class SpawnerTool extends Tool {
    static shortcut = 's';

    onDown(tx, ty) {
        const id = `spawn_${Date.now()}`;
        const data = { id, name: `Spawner ${id.slice(-4)}`, x: tx, y: ty };
        this.state.applyAction(new PlaceEntityAction('spawnPoints', data));
    }
}
