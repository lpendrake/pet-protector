const { Container, Graphics, Text } = PIXI;

export const TILE_SIZE = 64;

export const TILE_DEFS = {
    'G': { name: 'Grassland',  color: 0x7ec850, label: 'G' },
    'F': { name: 'Forest',     color: 0x2d5a1e, label: 'F' },
    'R': { name: 'Ruins',      color: 0xc4a46c, label: 'R' },
    'C': { name: 'Creature',   color: 0x8b6fc0, label: 'C' },
    'W': { name: 'Water',      color: 0x4287f5, label: 'W' },
    'V': { name: 'Cave',       color: 0x444444, label: 'V' },
    'A': { name: 'Apple',      color: 0x228822, label: 'A' },
    'O': { name: 'Rock',       color: 0x555555, label: 'O' }, // Impassable
    'I': { name: 'River',      color: 0x003366, label: 'I' }, // Impassable for Buddy
    'S': { name: 'Stream',     color: 0x3399ff, label: 'S' }, // Passable + Fish
    'D': { name: 'Deep Water', color: 0x000080, label: 'D' }, // Impassable for Buddy
};

export class World {
    constructor() {
        this.container = new Container();
        this.mapData = null;
        this.width = 0;
        this.height = 0;
        this.zones = [];
    }

    async load(url) {
        const resp = await fetch(url);
        this.mapData = await resp.json();
        this.width = this.mapData.width;
        this.height = this.mapData.height;
        this.zones = this.mapData.zones || [];
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

    isPassable(x, y, entityType = 'pet') {
        const tid = this.getTile(x, y);
        if (tid === null) return false;
        
        if (entityType === 'spirit') return true; // Spirit flies over everything
        
        // Rock, River, Deep Water, and original Water are impassable for Buddy
        if (tid === 'O' || tid === 'I' || tid === 'D' || tid === 'W') return false;
        
        return true;
    }

    // A* Pathfinding
    getPath(start, end, entityType = 'pet') {
        const nodes = [];
        const openSet = [{ x: start.x, y: start.y, g: 0, h: this._dist(start, end), f: this._dist(start, end), parent: null }];
        const closedSet = new Set();
        
        const toKey = (p) => `${p.x},${p.y}`;

        let bestNode = openSet[0];

        while (openSet.length > 0) {
            // Sort to get lowest F cost
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            
            // Track closest node to target
            if (current.h < bestNode.h) {
                bestNode = current;
            }

            if (current.x === end.x && current.y === end.y) {
                // Found exact path
                return this._reconstructPath(current);
            }

            closedSet.add(toKey(current));

            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 }
            ];

            for (const neighbor of neighbors) {
                if (!this.isPassable(neighbor.x, neighbor.y, entityType)) continue;
                if (closedSet.has(toKey(neighbor))) continue;

                const g = current.g + 1;
                const h = this._dist(neighbor, end);
                const f = g + h;

                const existing = openSet.find(o => o.x === neighbor.x && o.y === neighbor.y);
                if (existing) {
                    if (g < existing.g) {
                        existing.g = g;
                        existing.f = f;
                        existing.parent = current;
                    }
                } else {
                    openSet.push({ ...neighbor, g, h, f, parent: current });
                }
            }
        }

        // Return best partial path if target is unreachable
        return this._reconstructPath(bestNode);
    }

    _reconstructPath(node) {
        const path = [];
        let curr = node;
        while (curr.parent) {
            path.unshift({ x: curr.x, y: curr.y });
            curr = curr.parent;
        }
        return path;
    }

    _dist(p1, p2) {
        return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
    }

    get startPosition() {
        return this.mapData.startPosition || { x: 0, y: 0 };
    }
}
