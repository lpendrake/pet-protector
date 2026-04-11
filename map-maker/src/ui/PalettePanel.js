import { FloatingWindow } from './FloatingWindow.js';
import { TILE_COLORS, TILE_LABELS } from '../rendering/TileColors.js';

/**
 * Floating panel showing ground tile and item palettes.
 * Hover-managed by the Toolbar.
 *
 * Tiles with sprite data are rendered as canvas previews (scaled 2x for
 * visibility). Tiles without sprites fall back to colored squares.
 *
 * Emits:
 *   'tile:selected' → when a ground tile is clicked
 *   'item:selected' → when an item is clicked
 */
export class PalettePanel {
    /**
     * @param {EventBus} bus
     * @param {TileDefs} tiles
     * @param {ItemRegistry} items
     * @param {HTMLElement} parent
     * @param {import('../rendering/SpriteAtlas.js').SpriteAtlas|null} atlas
     */
    constructor(bus, tiles, items, parent, atlas = null) {
        this.bus = bus;
        this.tiles = tiles;
        this.items = items;
        this.atlas = atlas;

        this.window = new FloatingWindow({
            id: 'palette',
            title: 'Tiles & Items',
            parent,
            x: 10,
            y: 60,
            width: 260,
            pinnable: true,
            closable: true,
        });

        this._selectedTileName = null;
        this._tileGrid = null;
        this._allTiles = [];
        this._activeCategory = 'all';
        this._buildContent();
    }

    /** Re-render the tile grid (call after atlas.load() completes). */
    refresh() {
        this._renderTileGrid();
    }

    /** Proxy for Toolbar hybrid wiring */
    get el() { return this.window.el; }
    open() { this.window.open(); }
    close() { this.window.close(); }
    toggle() { this.window.toggle(); }
    isOpen() { return this.window.isOpen(); }
    isPinned() { return this.window.isPinned(); }
    setPosition(x, y) { this.window.setPosition(x, y); }
    set onPinChange(fn) { this.window._onPinChange = fn; }

    _buildContent() {
        const container = document.createElement('div');

        // ── Ground Tiles ────────────────────────────────────────────────
        const tileSection = document.createElement('div');
        tileSection.style.marginBottom = '12px';

        const tileTitle = document.createElement('div');
        tileTitle.className = 'palette-title';
        tileTitle.textContent = 'Ground Tiles';
        tileSection.appendChild(tileTitle);

        this._selectedTileName = document.createElement('div');
        this._selectedTileName.style.cssText = 'font-size: 12px; margin-bottom: 5px; color: #aaa;';
        this._selectedTileName.textContent = 'Selected: none';
        tileSection.appendChild(this._selectedTileName);

        // Category filter
        this._allTiles = this.tiles.getAllTiles().filter(t => t.id !== 'empty');
        const categories = ['all', ...new Set(this._allTiles.map(t => t.category))];

        const filterRow = document.createElement('div');
        filterRow.style.cssText = 'margin-bottom: 6px; display: flex; gap: 4px; align-items: center;';

        const filterLabel = document.createElement('span');
        filterLabel.textContent = 'Filter:';
        filterLabel.style.cssText = 'font-size: 11px; color: #888;';
        filterRow.appendChild(filterLabel);

        const filterSelect = document.createElement('select');
        filterSelect.style.cssText = 'flex: 1; font-size: 11px; background: #333; color: #ccc; border: 1px solid #555; border-radius: 3px; padding: 2px 4px;';
        for (const cat of categories) {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat === 'all' ? 'All categories' : cat;
            filterSelect.appendChild(opt);
        }
        filterSelect.addEventListener('change', () => {
            this._activeCategory = filterSelect.value;
            this._renderTileGrid();
        });
        filterRow.appendChild(filterSelect);
        tileSection.appendChild(filterRow);

        // Tile grid (scrollable)
        this._tileGrid = document.createElement('div');
        this._tileGrid.className = 'tile-grid';
        this._tileGrid.style.maxHeight = '300px';
        this._tileGrid.style.overflowY = 'auto';
        this._renderTileGrid();
        tileSection.appendChild(this._tileGrid);

        container.appendChild(tileSection);

        // ── Items ───────────────────────────────────────────────────────
        const itemSection = document.createElement('div');

        const itemTitle = document.createElement('div');
        itemTitle.className = 'palette-title';
        itemTitle.textContent = 'Items';
        itemSection.appendChild(itemTitle);

        const itemGrid = document.createElement('div');
        itemGrid.className = 'tile-grid';

        this.items.getAllItems().forEach(item => {
            const el = document.createElement('div');
            el.className = 'tile-item';
            el.title = item.name;
            el.textContent = item.emoji || '\u{1F4E6}'; // 📦
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                itemGrid.querySelectorAll('.tile-item').forEach(t => t.classList.remove('active'));
                el.classList.add('active');
                this.bus.emit('item:selected', item.id);
            });
            itemGrid.appendChild(el);
        });

        itemSection.appendChild(itemGrid);
        container.appendChild(itemSection);

        this.window.setContent(container);
    }

    /**
     * Render/re-render the tile grid based on the active category filter.
     */
    _renderTileGrid() {
        const grid = this._tileGrid;
        grid.innerHTML = '';

        const filtered = this._activeCategory === 'all'
            ? this._allTiles
            : this._allTiles.filter(t => t.category === this._activeCategory);

        for (const tile of filtered) {
            // Try sprite preview — skip tiles that are fully transparent
            const spriteEl = tile.sprite ? this._createSpritePreview(tile) : null;
            if (tile.sprite && !spriteEl) continue; // transparent sprite, skip entirely

            const el = document.createElement('div');
            el.className = 'tile-item';
            el.title = `${tile.name} (${tile.category || 'ground'})`;
            el.dataset.id = tile.id;

            if (spriteEl) {
                el.appendChild(spriteEl);
            } else {
                // Fallback to colored square with label (tiles without sprite data)
                const hexNum = TILE_COLORS[tile.id] ?? 0x555555;
                const bg = '#' + hexNum.toString(16).padStart(6, '0');
                const label = TILE_LABELS[tile.id] ?? tile.name[0];
                el.style.cssText += `background-color: ${bg}; color: #fff; font-size: 13px; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.8);`;
                el.textContent = label;
            }

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                grid.querySelectorAll('.tile-item').forEach(t => t.classList.remove('active'));
                el.classList.add('active');
                this._selectedTileName.textContent = `Selected: ${tile.name}`;
                this.bus.emit('tile:selected', tile.id);
            });
            grid.appendChild(el);
        }
    }

    /**
     * Create a canvas element showing the tile's sprite, scaled 2x.
     * Returns null if no sprite data or atlas is unavailable.
     * @param {{ id: string, sprite?: object }} tile
     * @returns {HTMLCanvasElement | null}
     */
    _createSpritePreview(tile) {
        if (!this.atlas || !tile.sprite) return null;

        const sprite = tile.sprite;
        const tileSize = this.tiles.getConfig()?.tileSize || 16;
        const displaySize = 32; // 2x scale for visibility

        if (sprite.sheet) {
            const img = this.atlas.getSheetImage(sprite.sheet);
            if (!img) return null;

            // Check for fully transparent tile at native size first
            const checkCanvas = document.createElement('canvas');
            checkCanvas.width = tileSize;
            checkCanvas.height = tileSize;
            const checkCtx = checkCanvas.getContext('2d');
            const sx = sprite.col * tileSize;
            const sy = sprite.row * tileSize;
            checkCtx.drawImage(img, sx, sy, tileSize, tileSize, 0, 0, tileSize, tileSize);
            const pixels = checkCtx.getImageData(0, 0, tileSize, tileSize).data;

            // Check alpha channel — if all pixels are transparent, skip
            let hasContent = false;
            for (let i = 3; i < pixels.length; i += 4) {
                if (pixels[i] > 0) { hasContent = true; break; }
            }
            if (!hasContent) return null;

            // Draw at display size
            const canvas = document.createElement('canvas');
            canvas.width = displaySize;
            canvas.height = displaySize;
            canvas.style.cssText = 'display: block; width: 100%; height: 100%;';
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, sx, sy, tileSize, tileSize, 0, 0, displaySize, displaySize);

            return canvas;
        }

        // Individual file — atlas stores it as a full texture
        // For now, fallback; individual file previews will come with Phase 6
        return null;
    }
}
