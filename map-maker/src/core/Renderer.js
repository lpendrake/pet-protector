import * as PIXI from 'pixi.js';
import { GlobalState, CHUNK_SIZE } from './State.js';
import { Registry } from './Items.js';

export const TILE_SIZE = 32;

export class Renderer {
    constructor(container) {
        this.app = new PIXI.Application();
        this.container = container;
        this.world = new PIXI.Container();
        this.spawnerLayer = new PIXI.Container();
        this.chunks = new Map(); // id -> PIXI.Container
        this.initialized = false;
    }

    async init() {
        await this.app.init({
            resizeTo: this.container,
            backgroundColor: 0x222222,
            antialias: true
        });
        this.container.appendChild(this.app.canvas);
        this.app.stage.addChild(this.world);
        this.world.addChild(this.spawnerLayer);
        this.initialized = true;
    }

    update() {
        if (!this.initialized) return;
        this._renderVisibleChunks();
        this._renderSpawners();
        GlobalState.needsRedraw = false;
    }

    _renderSpawners() {
        this.spawnerLayer.removeChildren();
        GlobalState.manifest.spawnPoints.forEach(s => {
            const g = new PIXI.Graphics();
            g.rect(s.x * TILE_SIZE + 4, s.y * TILE_SIZE + 4, TILE_SIZE-8, TILE_SIZE-8);
            g.fill({ color: 0xFF0000, alpha: 0.8 });
            
            const txt = new PIXI.Text('🚩', { fontSize: 16 });
            txt.x = s.x * TILE_SIZE + TILE_SIZE / 2;
            txt.y = s.y * TILE_SIZE + TILE_SIZE / 2;
            txt.anchor.set(0.5);
            
            this.spawnerLayer.addChild(g);
            this.spawnerLayer.addChild(txt);
        });
    }

    _renderVisibleChunks() {
        for (const [id, chunk] of Object.entries(GlobalState.chunks)) {
            if (!this.chunks.has(id)) {
                this._createChunkGraphics(id, chunk);
            } else if (GlobalState.needsRedraw) {
                this._updateChunkGraphics(id, chunk);
            }
        }
    }

    _createChunkGraphics(id, chunk) {
        const container = new PIXI.Container();
        const [_, cx, cy] = id.split('_').map(Number);
        container.x = cx * CHUNK_SIZE * TILE_SIZE;
        container.y = cy * CHUNK_SIZE * TILE_SIZE;

        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const tileContainer = new PIXI.Container();
                tileContainer.name = `tile_${x}_${y}`;
                tileContainer.x = x * TILE_SIZE;
                tileContainer.y = y * TILE_SIZE;

                const bg = new PIXI.Graphics();
                bg.name = 'bg';
                tileContainer.addChild(bg);

                const itemText = new PIXI.Text('', { fontSize: 16, align: 'center' });
                itemText.name = 'item';
                itemText.anchor.set(0.5);
                itemText.x = TILE_SIZE / 2;
                itemText.y = TILE_SIZE / 2;
                tileContainer.addChild(itemText);

                container.addChild(tileContainer);
                this._drawTile(tileContainer, chunk.tiles[y][x]);
            }
        }

        this.world.addChild(container);
        this.chunks.set(id, container);
    }

    _updateChunkGraphics(id, chunk) {
        const container = this.chunks.get(id);
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const tileContainer = container.getChildByName(`tile_${x}_${y}`);
                this._drawTile(tileContainer, chunk.tiles[y][x]);
            }
        }
    }

    _drawTile(tileContainer, data) {
        const bg = tileContainer.getChildByName('bg');
        const item = tileContainer.getChildByName('item');

        bg.clear();
        console.log(`[Renderer] Drawing tile ${data.base} at position`);
        const color = this._getBaseColor(data.base);
        bg.rect(0, 0, TILE_SIZE, TILE_SIZE);
        bg.fill(color);
        
        // Zone overlay
        if (data.zone) {
            bg.rect(0, 0, TILE_SIZE, TILE_SIZE);
            bg.fill({ color: 0xFF00FF, alpha: 0.2 }); // Semi-transparent magenta for zones
        }

        // Warp indicator
        if (data.warp) {
            bg.stroke({ color: 0x00FFFF, width: 2, alpha: 0.8 });
            bg.circle(TILE_SIZE/2, TILE_SIZE/2, TILE_SIZE/3);
        }

        bg.stroke({ color: 0xFFFFFF, width: 1, alpha: 0.05 });
        bg.rect(0, 0, TILE_SIZE, TILE_SIZE);

        if (data.item) {
            const itemDef = Registry.getItem(data.item);
            if (itemDef) {
                item.text = itemDef.emoji;
                item.visible = true;
            }
        } else {
            item.visible = false;
        }
    }

    _getBaseColor(id) {
        switch (id) {
            case 'grassland': return 0x7ec850;
            case 'forest':    return 0x2d5a1e;
            case 'ruins':     return 0xc4a46c;
            case 'water':      return 0x4287f5;
            case 'cave':       return 0x444444;
            case 'rock':       return 0x555555;
            case 'river':      return 0x003366;
            case 'stream':     return 0x3399ff;
            case 'deep_water': return 0x000080;
            default: return 0x000000;
        }
    }
}
