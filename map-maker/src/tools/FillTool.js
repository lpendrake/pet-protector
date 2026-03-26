import { Tool } from './BrushTool.js';
import { PaintTileAction } from '../core/Actions.js';

const MAX_FILL_TILES = 10000;

export class FillTool extends Tool {
    constructor(state, bus) {
        super(state);
        this.bus = bus;
        this.config = { layer: 'base', value: 'grass_v1' };
    }

    onDown(tx, ty) {
        const layer = this.config.layer;
        const newValue = this.config.value;
        const targetValue = this.state.getTileData(tx, ty)[layer];

        if (targetValue === newValue) return;

        const queue = [{ x: tx, y: ty }];
        const visited = new Set();
        visited.add(`${tx},${ty}`);
        
        const toPaint = [];

        while (queue.length > 0) {
            if (visited.size > MAX_FILL_TILES) {
                if (this.bus) {
                    this.bus.emit('fill:error', { 
                        message: `Fill area too large (> ${MAX_FILL_TILES} tiles). Paint a border first.` 
                    });
                }
                return;
            }

            const { x, y } = queue.shift();
            toPaint.push({ x, y });

            const neighbors = [
                { x: x + 1, y }, { x: x - 1, y },
                { x, y: y + 1 }, { x, y: y - 1 }
            ];

            for (const n of neighbors) {
                const id = `${n.x},${n.y}`;
                if (!visited.has(id)) {
                    const data = this.state.getTileData(n.x, n.y);
                    if (data[layer] === targetValue) {
                        visited.add(id);
                        queue.push(n);
                    }
                }
            }
        }

        // Apply all at once (optimally we'd use a single BatchPaintAction, but for now individual actions are undoable)
        toPaint.forEach(p => {
            this.state.applyAction(new PaintTileAction(p.x, p.y, layer, newValue, targetValue));
        });
    }
}
