import * as PIXI from 'pixi.js';
import { getTileColor, getLayerColor } from './TileColors.js';
import { CHUNK_SIZE } from '../core/MapState.js';

/**
 * Renders the tile map using PixiJS v8.
 *
 * Render pipeline (per frame, only when dirty):
 *   1. Tile layer   — one Graphics object per chunk, redrawn on `state:changed`
 *   2. Entity layer — spawn points (gold star) and warps (blue diamond)
 *
 * Layer Z-order (back to front): tileLayer → entityLayer
 */
export class MapRenderer {
    /**
     * @param {HTMLElement} container - DOM element the PIXI canvas is appended to
     * @param {EventBus|null} bus
     * @param {MapState} state
     * @param {ItemRegistry} items
     */
    constructor(container, bus, state, items) {
        this.container = container;
        this.bus = bus;
        this.state = state;
        this.items = items;
        this.app = new PIXI.Application();

        this.tileLayer = new PIXI.Container();
        this.entityLayer = new PIXI.Container();

        this.chunkGraphics = new Map(); // chunkId -> PIXI.Graphics
        this.tileSize = 32;

        this._needsRedraw = true;

        if (this.bus) {
            this.bus.on('state:changed', () => this._needsRedraw = true);
        }
    }

    /**
     * Create and mount the PIXI application into `this.container`, then start the render loop.
     * Must be called once before the renderer is usable.
     */
    async init() {
        console.log('[DEBUG] MapRenderer.init() starting...');
        try {
            await this.app.init({
                resizeTo: this.container,
                backgroundColor: 0x1a1a1a,
                antialias: true
            });
            console.log('[DEBUG] PIXI app initialized successfully');
        } catch (e) {
            console.error('[DEBUG] PIXI app.init FAILED:', e);
            throw e;
        }

        this.container.appendChild(this.app.canvas);

        this.app.stage.addChild(this.tileLayer);
        this.app.stage.addChild(this.entityLayer);

        this.startLoop();
    }

    /**
     * Register the per-frame ticker callback. Renders only when `_needsRedraw` is true,
     * avoiding unnecessary GPU work on idle frames.
     */
    startLoop() {
        this.app.ticker.add(() => {
            if (this._needsRedraw) {
                this.render();
                this._needsRedraw = false;
            }
        });
    }

    /** Redraw all chunks and entities. */
    render() {
        for (const [id, chunk] of this.state.chunks) {
            this._renderChunk(id, chunk);
        }
        this._renderEntities();
    }

    /**
     * Redraw a single chunk into its cached Graphics object.
     * Creates the Graphics on first call for this chunk ID.
     *
     * Rendering order per tile: base color → decoration → pickup dot → zone → warp overlay.
     *
     * @param {string} id - Chunk ID in "chunk_X_Y" format
     * @param {object} chunk - Chunk data from MapState
     */
    _renderChunk(id, chunk) {
        if (!this.chunkGraphics.has(id)) {
            const g = new PIXI.Graphics();
            this.tileLayer.addChild(g);
            this.chunkGraphics.set(id, g);
        }
        
        const g = this.chunkGraphics.get(id);
        g.clear();
        
        // Parse ID "chunk_X_Y"
        const parts = id.split('_');
        const cx = parseInt(parts[1]);
        const cy = parseInt(parts[2]);
        const offsetX = cx * CHUNK_SIZE * this.tileSize;
        const offsetY = cy * CHUNK_SIZE * this.tileSize;

        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const tile = chunk.tiles[y][x];
                const tx = offsetX + x * this.tileSize;
                const ty = offsetY + y * this.tileSize;

                g.rect(tx, ty, this.tileSize, this.tileSize)
                 .fill(getTileColor(tile.base));

                // 2. Deco/Pickup/Zone/Warp Overlays
                if (tile.decoration) {
                    g.rect(tx, ty, this.tileSize, this.tileSize)
                     .fill({ color: getLayerColor('decoration'), alpha: 0.2 });
                }
                if (tile.pickup) {
                    g.circle(tx + 16, ty + 16, 6)
                     .fill(getLayerColor('pickup'))
                     .stroke({ color: 0xffffff, width: 1 });
                }
                if (tile.zone) {
                    g.rect(tx, ty, this.tileSize, this.tileSize)
                     .fill({ color: getLayerColor('zone'), alpha: 0.3 })
                     .stroke({ color: getLayerColor('zone'), width: 2, alpha: 0.8 });
                }
                if (tile.warp) {
                    g.rect(tx, ty, this.tileSize, this.tileSize)
                     .fill({ color: getLayerColor('warp'), alpha: 0.3 })
                     .stroke({ color: getLayerColor('warp'), width: 2, alpha: 0.8 });
                }
            }
        }
    }

    /**
     * Rebuild the entity layer from the current manifest.
     *   - Spawn points → gold 5-pointed star
     *   - Warps        → blue diamond (matches LAYER_COLORS.warp)
     */
    _renderEntities() {
        this.entityLayer.removeChildren();

        const spawnPoints = this.state.manifest.spawnPoints || [];
        spawnPoints.forEach(p => {
            const g = new PIXI.Graphics();
            g.star(p.x * this.tileSize + 16, p.y * this.tileSize + 16, 5, 10)
             .fill(0xffcc00);
            this.entityLayer.addChild(g);
        });

        const warps = this.state.manifest.warps || [];
        warps.forEach(w => {
            const g = new PIXI.Graphics();
            const cx = w.x * this.tileSize + 16;
            const cy = w.y * this.tileSize + 16;
            g.poly([cx, cy - 10, cx + 10, cy, cx, cy + 10, cx - 10, cy])
             .fill(0x118ab2);
            this.entityLayer.addChild(g);
        });
    }

    /**
     * Convert a world-space (PixiJS stage) coordinate to tile indices.
     * @param {number} worldX
     * @param {number} worldY
     * @returns {{ tx: number, ty: number }}
     */
    worldToTile(worldX, worldY) {
        return {
            tx: Math.floor(worldX / this.tileSize),
            ty: Math.floor(worldY / this.tileSize)
        };
    }
}
