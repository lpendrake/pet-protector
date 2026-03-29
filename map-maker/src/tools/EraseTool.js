import { Tool } from './BrushTool.js';
import { PaintTileAction } from '../core/Actions.js';

/**
 * Erases all layers from a tile, restoring it to the blank default state.
 * Clears decoration, pickup, zone, and warp layers, then resets base to 'empty'.
 * Each cleared layer is a separate Action so undo restores them individually.
 */
export class EraseTool extends Tool {
    static shortcut = 'e';

    onDown(tx, ty) {
        this.erase(tx, ty);
    }

    onMove(tx, ty) {
        this.erase(tx, ty);
    }

    erase(tx, ty) {
        const layers = ['decoration', 'pickup', 'zone', 'warp'];
        const oldData = this.state.getTileData(tx, ty);

        layers.forEach(layer => {
            if (oldData[layer] !== null) {
                this.state.applyAction(new PaintTileAction(tx, ty, layer, null, oldData[layer]));
            }
        });

        if (oldData.base !== 'empty') {
            this.state.applyAction(new PaintTileAction(tx, ty, 'base', 'empty', oldData.base));
        }
    }
}
