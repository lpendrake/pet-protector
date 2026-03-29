import { PaintTileAction } from '../core/Actions.js';

/**
 * Base class for all editor tools.
 * Tools receive pointer events in tile coordinates from ToolManager
 * and mutate MapState exclusively via Actions (for undo/redo support).
 *
 * To add a new tool:
 *   1. Extend this class and implement onDown/onMove/onUp.
 *   2. Declare `static shortcut` ('b', 'e', '' for none — never null).
 *   3. Register it in ToolManager and add a button in index.html.
 *   See CONTRIBUTING.md for the full checklist.
 */
export class Tool {
    static shortcut = null; // null = forgot; '' = intentionally none; 'b' = key binding

    /** @param {MapState} state */
    constructor(state) {
        this.state = state;
        this.config = {};
    }

    /**
     * Merges additional configuration into this.config.
     * Used by ToolManager to set the active tile/item before painting.
     * @param {Object} config
     */
    setConfig(config) { this.config = { ...this.config, ...config }; }

    /** Called when the pointer is pressed down on the canvas (tile coordinates). */
    onDown(tx, ty) {}

    /** Called on pointer move while the button is held (tile coordinates). */
    onMove(tx, ty) {}

    /** Called when the pointer button is released. */
    onUp() {}
}

/**
 * Paints tiles by clicking or dragging.
 * Uses Bresenham's line algorithm to fill gaps between fast mouse moves,
 * ensuring continuous strokes even at high drag speeds.
 *
 * Operates on whichever layer and value are set in `config`
 * (defaults to base:'grass_v1', set by ToolManager on tile selection).
 */
export class BrushTool extends Tool {
    static shortcut = 'b';

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

    /**
     * Draws a straight line of tiles between two points using Bresenham's algorithm.
     * Ensures no gaps when the mouse moves faster than one tile per frame.
     */
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
