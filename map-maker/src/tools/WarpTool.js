import { Tool } from './BrushTool.js';
import { PlaceEntityAction, PaintTileAction } from '../core/Actions.js';

/**
 * Places a warp transition point at the clicked tile.
 * A warp links a tile on this map to a named spawn point on another map (or the same map).
 * The player triggers it by moving onto the tile with their pet.
 *
 * Placing a warp does two things:
 *   1. Adds a warp entity to manifest.warps (holds the targetMap and targetSpawn metadata)
 *   2. Sets the tile's 'warp' layer to the warp's id (so the renderer can highlight it)
 *
 * Target map and destination spawn point are edited via the Properties panel after placement.
 * Defaults: targetMap='main', targetPos={x:0, y:0}.
 *
 * Placement is blocked on non-walkable tiles (e.g. deep water, rock) — a warp the
 * player/pet can never reach would be unreachable in-game.
 */
export class WarpTool extends Tool {
    static shortcut = 'w';

    /**
     * @param {MapState} state
     * @param {TileDefs|null} tileDefs - Used to check walkability before placement.
     *                                    If null, the walkability check is skipped.
     */
    constructor(state, tileDefs = null) {
        super(state);
        this.tileDefs = tileDefs;
    }

    onDown(tx, ty) {
        if (this.tileDefs) {
            const tileData = this.state.getTileData(tx, ty);
            const tileDef = this.tileDefs.getTile(tileData.base);
            if (!tileDef.walkable) return;
        }

        const id = `warp_${Date.now()}`;
        const data = {
            id,
            name: `Warp ${id.slice(-4)}`,
            x: tx, y: ty,
            targetMap: 'main',
            targetPos: { x: 0, y: 0 }
        };

        this.state.applyAction(new PlaceEntityAction('warps', data));
        this.state.applyAction(new PaintTileAction(tx, ty, 'warp', id, null));
    }
}
