import { Tool } from './BrushTool.js';
import { BatchPaintAction } from '../core/Actions.js';

/**
 * Safety limit on flood fill area. Prevents runaway fills on large open maps.
 * If exceeded, the fill is aborted entirely (no partial fills) and a 'fill:error'
 * event is emitted so the UI can show a toast.
 */
const MAX_FILL_TILES = 10000;

/**
 * Flood-fills a contiguous area of matching tiles using BFS.
 * Works transparently across chunk boundaries — chunks are an implementation
 * detail, not a constraint on the fill area.
 *
 * The entire fill is wrapped in a single BatchPaintAction so the whole
 * operation undoes in one Ctrl+Z.
 */
export class FillTool extends Tool {
    static shortcut = 'f';

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

        this.state.applyAction(new BatchPaintAction(
            toPaint.map(p => ({ x: p.x, y: p.y, layer, newValue, oldValue: targetValue }))
        ));
    }
}
