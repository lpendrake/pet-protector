import { Tool } from './BrushTool.js';
import { PaintTileAction } from '../core/Actions.js';

export class EraseTool extends Tool {
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

        // Note: 'base' is reset to 'empty' if needed, but usually we just erase top layers
        if (oldData.base !== 'empty') {
            this.state.applyAction(new PaintTileAction(tx, ty, 'base', 'empty', oldData.base));
        }
    }
}
