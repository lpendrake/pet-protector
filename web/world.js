const { Container, Graphics, Text } = PIXI;

export const TILE_SIZE = 64;

export const TILE_DEFS = {
    'G': { name: 'Grassland', color: 0x7ec850, label: 'G' },
    'F': { name: 'Forest',    color: 0x2d5a1e, label: 'F' },
    'R': { name: 'Ruins',     color: 0xc4a46c, label: 'R' },
    'C': { name: 'Creature',  color: 0x8b6fc0, label: 'C' },
    'W': { name: 'Water',     color: 0x4287f5, label: 'W' },
    'V': { name: 'Cave',      color: 0x444444, label: 'V' },
    'A': { name: 'Apple',     color: 0x228822, label: 'A' },
};

export class World {
    constructor() {
        this.container = new Container();
        this.mapData = null;
        this.width = 0;
        this.height = 0;
    }

    async load(url) {
        const resp = await fetch(url);
        this.mapData = await resp.json();
        this.width = this.mapData.width;
        this.height = this.mapData.height;
        this._buildTiles();
    }

    _buildTiles() {
        this.tileSprites = [];
        this.container.removeChildren();
        for (let y = 0; y < this.height; y++) {
            this.tileSprites[y] = [];
            for (let x = 0; x < this.width; x++) {
                const tileId = this.mapData.tiles[y][x];
                const def = TILE_DEFS[tileId] || TILE_DEFS['G'];

                const g = new Graphics();
                g.beginFill(def.color);
                g.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
                g.endFill();
                g.lineStyle(1, 0x000000, 0.15);
                g.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
                g.x = x * TILE_SIZE;
                g.y = y * TILE_SIZE;
                this.container.addChild(g);

                const label = new Text(def.label, {
                    fontFamily: '"VT323", monospace',
                    fontSize: 16,
                    fill: 0x000000,
                    fontWeight: 'bold',
                });
                label.alpha = 0.25;
                label.anchor.set(0.5);
                label.x = x * TILE_SIZE + TILE_SIZE / 2;
                label.y = y * TILE_SIZE + TILE_SIZE / 2;
                this.container.addChild(label);
                
                this.tileSprites[y][x] = { bg: g, label: label };
            }
        }
    }

    getTile(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
        return this.mapData.tiles[y][x];
    }

    isPassable(x, y) {
        return this.getTile(x, y) !== null;
    }

    get startPosition() {
        return this.mapData.startPosition || { x: 0, y: 0 };
    }
}
