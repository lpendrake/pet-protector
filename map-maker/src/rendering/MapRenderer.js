import * as PIXI from 'pixi.js';
import { getTileColor, getLayerColor } from './TileColors.js';
import { CHUNK_SIZE } from '../core/MapState.js';

export class MapRenderer {
    constructor(container, bus, state, items) {
        this.container = container;
        this.bus = bus;
        this.state = state;
        this.items = items;
        this.app = new PIXI.Application();
        
        this.tileLayer = new PIXI.Container();
        this.entityLayer = new PIXI.Container();
        this.gridLayer = new PIXI.Graphics();
        
        this.chunkGraphics = new Map(); // id -> Graphics
        this.tileSize = 32;
        
        this._needsRedraw = true;
        
        if (this.bus) {
            this.bus.on('state:changed', () => this._needsRedraw = true);
        }
    }

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
        this.app.stage.addChild(this.gridLayer);
        
        this.startLoop();
    }

    startLoop() {
        this.app.ticker.add(() => {
            if (this._needsRedraw) {
                this.render();
                this._needsRedraw = false;
            }
        });
    }

    render() {
        for (const [id, chunk] of this.state.chunks) {
            this._renderChunk(id, chunk);
        }
        this._renderEntities();
        this._renderGrid();
    }

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

    _renderEntities() {
        this.entityLayer.removeChildren();
        const spawnPoints = this.state.manifest.spawnPoints || [];
        spawnPoints.forEach(p => {
            const g = new PIXI.Graphics();
            g.star(p.x * this.tileSize + 16, p.y * this.tileSize + 16, 5, 10)
             .fill(0xffcc00);
            this.entityLayer.addChild(g);
        });
    }

    _renderGrid() {
        this.gridLayer.clear();
    }

    worldToTile(worldX, worldY) {
        return {
            tx: Math.floor(worldX / this.tileSize),
            ty: Math.floor(worldY / this.tileSize)
        };
    }
}
