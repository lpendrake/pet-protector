import { Tool } from './BrushTool.js';
import { PlaceEntityAction } from '../core/Actions.js';

export class SpawnerTool extends Tool {
    onDown(tx, ty) {
        const id = `spawn_${Date.now()}`;
        const data = { id, name: `Spawner ${id.slice(-4)}`, x: tx, y: ty };
        this.state.applyAction(new PlaceEntityAction('spawnPoints', data));
    }
}
