import { Tool } from './BrushTool.js';
import { PlaceEntityAction, PaintTileAction } from '../core/Actions.js';

export class WarpTool extends Tool {
    onDown(tx, ty) {
        const id = `warp_${Date.now()}`;
        const data = { 
            id, 
            name: `Warp ${id.slice(-4)}`, 
            x: tx, y: ty, 
            targetMap: 'main', 
            targetPos: { x: 0, y: 0 } 
        };
        
        // Multi-stage action: Add to manifest AND set tile layer
        this.state.applyAction(new PlaceEntityAction('warps', data));
        this.state.applyAction(new PaintTileAction(tx, ty, 'warp', id, null));
    }
}
