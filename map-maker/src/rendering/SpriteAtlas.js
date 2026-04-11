import * as PIXI from 'pixi.js';

/**
 * Central texture cache for tile sprites.
 *
 * Loads spritesheet PNGs once, creates sub-textures for individual tile
 * regions, and provides O(1) lookup by tile ID. Supports two sprite source
 * types defined in tile_defs.json:
 *
 *   - Spritesheet region: { sheet, col, row }  → sub-texture from a larger PNG
 *   - Individual file:    { file }             → standalone PNG loaded as-is
 *
 * Usage:
 *   const atlas = new SpriteAtlas(tileDefs);
 *   await atlas.load();
 *   const tex = atlas.get('ground_grass_5_3');  // PIXI.Texture or null
 */
export class SpriteAtlas {
    /**
     * @param {import('../core/TileDefs.js').TileDefs} tileDefs
     * @param {import('../core/ItemRegistry.js').ItemRegistry|null} itemRegistry
     */
    constructor(tileDefs, itemRegistry = null) {
        this.tileDefs = tileDefs;
        this.itemRegistry = itemRegistry;

        /** @type {Map<string, PIXI.Texture>} base textures keyed by resolved URL */
        this._sheetTextures = new Map();

        /** @type {Map<string, PIXI.Texture>} cached sub-textures keyed by tile ID */
        this._frameCache = new Map();

        /** @type {Map<string, HTMLImageElement>} sheet images for palette previews */
        this._sheetImages = new Map();

        const config = tileDefs.getConfig();
        this._assetBase = config?.assetBase || './';
        this._tileSize = config?.tileSize || 16;
    }

    /**
     * Resolve a relative asset path to a URL usable by PIXI.Assets.
     * Uses Vite's import.meta-based resolution for correct dev/build paths.
     * @param {string} relativePath
     * @returns {string}
     */
    _resolvePath(relativePath) {
        // Build the URL relative to the src/ directory where assets live
        return new URL(`../assets/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG/${relativePath}`, import.meta.url).href;
    }

    /**
     * Load all spritesheets and individual files referenced by tile definitions.
     * Must be called once before `get()` returns valid textures.
     */
    async load() {
        const allTiles = this.tileDefs.getAllTiles();
        const allItems = this.itemRegistry ? this.itemRegistry.getAllItems() : [];

        // Collect unique sheet paths and file paths from both tiles and items
        const sheets = new Set();
        const files = new Set();

        for (const entry of [...allTiles, ...allItems]) {
            if (!entry.sprite) continue;
            if (entry.sprite.sheet) sheets.add(entry.sprite.sheet);
            if (entry.sprite.file) files.add(entry.sprite.file);
        }

        // Load all unique sources in parallel
        const loadPromises = [];

        for (const sheet of sheets) {
            const url = this._resolvePath(sheet);
            loadPromises.push(
                PIXI.Assets.load({ src: url, data: { scaleMode: 'nearest' } })
                    .then(texture => {
                        this._sheetTextures.set(sheet, texture);
                        // Store the source image for palette canvas previews
                        this._sheetImages.set(sheet, texture.source.resource);
                    })
            );
        }

        for (const file of files) {
            const url = this._resolvePath(file);
            loadPromises.push(
                PIXI.Assets.load({ src: url, data: { scaleMode: 'nearest' } })
                    .then(texture => {
                        // Individual files are stored as their own "sheet" for consistency
                        this._sheetTextures.set(file, texture);
                    })
            );
        }

        await Promise.all(loadPromises);

        // Pre-build sub-textures for all sprite tiles and items
        for (const entry of [...allTiles, ...allItems]) {
            if (!entry.sprite) continue;
            this._buildFrame(entry.id, entry.sprite);
        }

        console.log(`[SpriteAtlas] Loaded ${sheets.size} sheets, ${files.size} files, ${this._frameCache.size} textures`);
    }

    /**
     * Build and cache a sub-texture for a single tile sprite definition.
     * @param {string} id - Tile ID
     * @param {{ sheet?: string, col?: number, row?: number, file?: string }} sprite
     */
    _buildFrame(id, sprite) {
        if (sprite.file) {
            // Individual file — the loaded texture IS the tile texture
            const tex = this._sheetTextures.get(sprite.file);
            if (tex) this._frameCache.set(id, tex);
            return;
        }

        if (sprite.sheet) {
            const baseTex = this._sheetTextures.get(sprite.sheet);
            if (!baseTex) return;

            const w = this._tileSize;
            const h = this._tileSize;
            const x = sprite.col * w;
            const y = sprite.row * h;

            const frame = new PIXI.Rectangle(x, y, w, h);
            const subTexture = new PIXI.Texture({
                source: baseTex.source,
                frame,
            });

            this._frameCache.set(id, subTexture);
        }
    }

    /**
     * Get the texture for a tile ID.
     * @param {string} tileId
     * @returns {PIXI.Texture | null} The tile texture, or null if no sprite defined
     */
    get(tileId) {
        return this._frameCache.get(tileId) || null;
    }

    /**
     * Get the raw HTMLImageElement for a spritesheet, for use in canvas-based
     * palette previews.
     * @param {string} sheetName - e.g. 'ground_grasss.png'
     * @returns {HTMLImageElement | null}
     */
    getSheetImage(sheetName) {
        return this._sheetImages.get(sheetName) || null;
    }
}
