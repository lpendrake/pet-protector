import { Tool } from './BrushTool.js';
import { PaintTileAction } from '../core/Actions.js';

/**
 * Erases a single configured layer from a tile.
 *
 * The target layer is set via setConfig({ layer }) — driven by the erase layer picker
 * rendered in PropertyPanel when this tool is active.
 *
 * If no layer is configured (config.layer === null), erase is a safe no-op.
 * This prevents accidental erasure when the tool is first activated.
 */
export class EraseTool extends Tool {
    static shortcut = 'e';

    constructor(state) {
        super(state);
        this.config = { layer: null };
        this._painting = false;
    }

    onDown(tx, ty) {
        this._painting = true;
        this.erase(tx, ty);
    }

    onMove(tx, ty) {
        if (this._painting) this.erase(tx, ty);
    }

    onUp() {
        this._painting = false;
    }

    erase(tx, ty) {
        const { layer } = this.config;
        if (!layer) return;

        const oldData = this.state.getTileData(tx, ty);

        if (layer === 'base') {
            if (oldData.base !== 'empty') {
                this.state.applyAction(new PaintTileAction(tx, ty, 'base', 'empty', oldData.base));
            }
        } else if (oldData[layer] != null) {
            this.state.applyAction(new PaintTileAction(tx, ty, layer, null, oldData[layer]));
        }
    }
}
