import { PaintTileAction } from '../core/Actions.js';

export class Tool {
    constructor(state) {
        this.state = state;
        this.config = {};
    }
    setConfig(config) { this.config = { ...this.config, ...config }; }
    onDown(tx, ty) {}
    onMove(tx, ty) {}
    onUp() {}
}

export class BrushTool extends Tool {
    constructor(state) {
        super(state);
        this.config = { layer: 'base', value: 'grass_v1' };
        this.lastPos = null;
    }

    onDown(tx, ty) {
        this.paint(tx, ty);
        this.lastPos = { x: tx, y: ty };
    }

    onMove(tx, ty) {
        if (this.lastPos && (this.lastPos.x !== tx || this.lastPos.y !== ty)) {
            this.drawLine(this.lastPos.x, this.lastPos.y, tx, ty);
            this.lastPos = { x: tx, y: ty };
        }
    }

    drawLine(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.paint(x0, y0);
            if ((x0 === x1) && (y0 === y1)) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }

    onUp() {
        this.lastPos = null;
    }

    paint(tx, ty) {
        const oldData = this.state.getTileData(tx, ty);
        const oldValue = oldData[this.config.layer];
        if (oldValue !== this.config.value) {
            this.state.applyAction(new PaintTileAction(tx, ty, this.config.layer, this.config.value, oldValue));
        }
    }
}
