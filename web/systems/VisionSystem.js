const { Container, Graphics } = PIXI;
import { TILE_SIZE } from '../world.js';

export class VisionSystem {
    constructor(world, worldLayer, visionRadius) {
        this.world = world;
        this.worldLayer = worldLayer;
        this.visionRadius = visionRadius;
        this.fogLayer = new Container();
        this.fogCells = [];
        
        // Insert between world tiles (index 0) and markers
        this.worldLayer.addChildAt(this.fogLayer, 1);
        this._build();
    }

    _build() {
        const pad = 6;
        const x0 = -pad, y0 = -pad;
        const x1 = this.world.width + pad;
        const y1 = this.world.height + pad;

        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                const fog = new Graphics();
                fog.beginFill(0x6b7b6b);
                fog.drawRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                fog.endFill();
                this.fogLayer.addChild(fog);
                this.fogCells.push({ x, y, gfx: fog });
            }
        }
    }

    update(state, spiritPos, petPos, petGfx) {
        if (!state.seenTiles) state.seenTiles = {};

        // 1. Mark current live vision in state
        const sx = spiritPos.x, sy = spiritPos.y;
        for (let dy = -this.visionRadius; dy <= this.visionRadius; dy++) {
            for (let dx = -this.visionRadius; dx <= this.visionRadius; dx++) {
                const tx = sx + dx, ty = sy + dy;
                if (this._dist({x: tx, y: ty}, spiritPos) <= this.visionRadius) {
                    if (tx >= 0 && tx < this.world.width && ty >= 0 && ty < this.world.height) {
                        state.seenTiles[`${tx},${ty}`] = true;
                    }
                }
            }
        }

        // 2. Update fog cell visuals
        for (const cell of this.fogCells) {
            const outside = cell.x < 0 || cell.y < 0 ||
                            cell.x >= this.world.width || cell.y >= this.world.height;
            const dist = this._dist(cell, spiritPos);
            const isSeen = state.seenTiles[`${cell.x},${cell.y}`];

            if (outside) {
                cell.gfx.alpha = 1;
            } else if (dist <= 1) {
                cell.gfx.alpha = 0; // Live
            } else if (dist <= 2) {
                cell.gfx.alpha = 0.1; // Live
            } else if (dist <= this.visionRadius) {
                cell.gfx.alpha = 0.3; // Live
            } else if (isSeen) {
                cell.gfx.alpha = 0.75; // Stale (Memory)
            } else {
                cell.gfx.alpha = 1.0; // Hidden
            }
            
            // Interaction: Pet and Tiles visibility
            const isLive = dist <= this.visionRadius;
            const ts = this.world.tileSprites && this.world.tileSprites[cell.y] && this.world.tileSprites[cell.y][cell.x];
            
            if (ts) {
                ts.bg.visible = (isSeen || isLive);
                ts.label.visible = (isSeen || isLive);
                ts.bg.alpha = isLive ? 1.0 : 0.4;
            }

            // Hide Buddy if out of live vision
            const petDist = this._dist(cell, { x: Math.round(petPos.x), y: Math.round(petPos.y) });
            if (petDist === 0) {
                if (petGfx) petGfx.visible = isLive;
            }
        }
    }

    _dist(a, b) {
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
    }
}
