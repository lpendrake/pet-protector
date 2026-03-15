import * as PIXI from 'pixi.js';
import { GlobalState, CHUNK_SIZE } from './State.js';
import { Registry } from './Items.js';

export const TILE_SIZE = 32;

export class Renderer {
    constructor(container) {
        this.app = new PIXI.Application({
            resizeTo: container,
            backgroundColor: 0x222222,
            antialias: true
        });
        container.appendChild(this.app.view);

        this.world = new PIXI.Container();
        this.app.stage.addChild(this.world);

        this.chunks = new Map(); // id -> PIXI.Container
        this.lastCameraPos = { x: 0, y: 0 };
    }

    update() {
        // Culling and chunk loading logic
        const camera = this.app.stage.pivot;
        // ... simple for now
        this._renderVisibleChunks();
    }

    _renderVisibleChunks() {
        // In a real infinite setup, we'd only render chunks around the camera
        // For the initial MVP, we'll render a few chunks
        for (const [id, chunk] of Object.entries(GlobalState.chunks)) {
            if (!this.chunks.has(id)) {
                this._createChunkGraphics(id, chunk);
            } else {
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
        if (GlobalState.dirty) {
            for (let y = 0; y < CHUNK_SIZE; y++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const tileContainer = container.getChildByName(`tile_${x}_${y}`);
                    this._drawTile(tileContainer, chunk.tiles[y][x]);
                }
            }
        }
    }

    _drawTile(tileContainer, data) {
        const bg = tileContainer.getChildByName('bg');
        const item = tileContainer.getChildByName('item');

        bg.clear();
        const color = this._getBaseColor(data.base);
        bg.beginFill(color);
        bg.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
        bg.endFill();
        bg.lineStyle(1, 0xFFFFFF, 0.05);
        bg.drawRect(0, 0, TILE_SIZE, TILE_SIZE);

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
