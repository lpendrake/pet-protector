import { Tool } from './BrushTool.js';
import { PaintTileAction } from '../core/Actions.js';

export class ZoneTool extends Tool {
    constructor(state) {
        super(state);
        this.config = { value: 'active_zone' };
        this.isDragging = false;
    }

    onDown(tx, ty) {
        this.isDragging = true;
        this.paint(tx, ty);
    }

    onMove(tx, ty) {
        if (this.isDragging) this.paint(tx, ty);
    }

    onUp() {
        this.isDragging = false;
    }

    paint(tx, ty) {
        const oldData = this.state.getTileData(tx, ty);
        if (oldData.zone !== this.config.value) {
            this.state.applyAction(new PaintTileAction(tx, ty, 'zone', this.config.value, oldData.zone));
        }
    }
}
