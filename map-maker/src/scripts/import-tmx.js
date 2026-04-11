#!/usr/bin/env node

/**
 * TMX Import Script
 *
 * Parses a Tiled .tmx file and generates tile_defs.json entries
 * with spritesheet coordinates for each tile. Uses sharp to read
 * pixel data and skip fully transparent cells.
 *
 * Usage:
 *   node src/scripts/import-tmx.js [path-to-tmx] [--all]
 *
 * By default, only imports tiles that:
 *   1. Appear in the example map's layer data, AND
 *   2. Have at least one non-transparent pixel
 *
 * Pass --all to skip the "used in example" filter (transparency
 * check still applies).
 *
 * Looks for .webp versions of spritesheets first, falls back to .png.
 * Tile defs reference .webp filenames.
 *
 * Defaults to the bundled Glades.tmx if no path is provided.
 * Writes output to src/data/tile_defs.json.
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

const DEFAULT_TMX = resolve(
    PROJECT_ROOT,
    'src/assets/craftpix-net-189510-grassland-top-down-tileset-pixel-art/Tiled_files/Glades.tmx'
);
const ASSET_DIR = resolve(
    PROJECT_ROOT,
    'src/assets/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG'
);
const OUTPUT_PATH = resolve(PROJECT_ROOT, 'src/data/tile_defs.json');

// ── Category mapping by tileset name ─────────────────────────────────
const CATEGORY_MAP = {
    'Ground_grass':        'natural',
    'Water_coasts':        'water',
    'Water_detilazation':  'water',
    'Trees_rocks':         'decoration',
    'Details':             'decoration',
};

const WALKABLE_BY_CATEGORY = {
    'natural':    true,
    'water':      false,
    'decoration': false,
};

// ── Parse tilesets from TMX XML ──────────────────────────────────────

function parseTilesets(xml) {
    const tilesets = [];
    const tilesetRegex = /<tileset\s+firstgid="(\d+)"\s+name="([^"]+)"\s+tilewidth="(\d+)"\s+tileheight="(\d+)"\s+tilecount="(\d+)"\s+columns="(\d+)">/g;
    let match;

    while ((match = tilesetRegex.exec(xml)) !== null) {
        const [, firstgid, name, tilewidth, tileheight, tilecount, columns] = match;
        const afterTileset = xml.slice(match.index);
        const imageMatch = afterTileset.match(/<image\s+source="([^"]+)"/);
        if (!imageMatch) continue;

        tilesets.push({
            firstgid: parseInt(firstgid),
            name,
            tileWidth: parseInt(tilewidth),
            tileHeight: parseInt(tileheight),
            tileCount: parseInt(tilecount),
            columns: parseInt(columns),
            imageSource: imageMatch[1],
        });
    }

    return tilesets;
}

// ── Collect used GIDs from layer data ────────────────────────────────

function collectUsedGids(xml) {
    const used = new Set();
    const chunkRegex = /<chunk[^>]*>([\s\S]*?)<\/chunk>/g;
    let match;

    while ((match = chunkRegex.exec(xml)) !== null) {
        const csv = match[1];
        const gids = csv.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
        gids.forEach(g => used.add(g));
    }

    return used;
}

// ── Normalise tileset name to a safe prefix ──────────────────────────

function toPrefix(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
}

// ── Check if a tile region has any non-transparent pixels ────────────

async function loadSheetPixels(imageSource) {
    // Prefer .webp, fall back to original (usually .png)
    const webpPath = resolve(ASSET_DIR, imageSource.replace(/\.png$/i, '.webp'));
    const origPath = resolve(ASSET_DIR, imageSource);
    const filePath = existsSync(webpPath) ? webpPath : origPath;

    const { data, info } = await sharp(filePath)
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });

    return { data, width: info.width, height: info.height, channels: info.channels };
}

function isTileTransparent(sheetData, col, row, tileW, tileH) {
    const { data, width, channels } = sheetData;
    const startX = col * tileW;
    const startY = row * tileH;

    for (let y = startY; y < startY + tileH; y++) {
        for (let x = startX; x < startX + tileW; x++) {
            const idx = (y * width + x) * channels;
            // Check alpha channel (4th channel, index 3)
            if (data[idx + 3] > 0) return false;
        }
    }
    return true;
}

// ── Resolve output filename (prefer .webp) ───────────────────────────

function outputFilename(imageSource) {
    const webpName = imageSource.replace(/\.png$/i, '.webp');
    const webpPath = resolve(ASSET_DIR, webpName);
    return existsSync(webpPath) ? webpName : imageSource;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const importAll = args.includes('--all');
    const tmxPath = args.find(a => !a.startsWith('--')) || DEFAULT_TMX;
    const xml = readFileSync(tmxPath, 'utf-8');

    console.log(`Parsing: ${tmxPath}`);

    const tilesets = parseTilesets(xml);
    console.log(`Found ${tilesets.length} tilesets:`);
    tilesets.forEach(ts => console.log(`  ${ts.name}: ${ts.tileCount} tiles (${ts.columns} cols), sheet=${ts.imageSource}`));

    const usedGids = collectUsedGids(xml);
    console.log(`\nGIDs used in map layers: ${usedGids.size}`);
    console.log(`Mode: ${importAll ? '--all (skip usage filter)' : 'used-only (default)'}`);
    console.log('Transparency check: enabled (sharp)\n');

    // Pre-load all sheet pixel data
    const sheetPixels = new Map();
    for (const ts of tilesets) {
        console.log(`  Loading ${ts.imageSource}...`);
        sheetPixels.set(ts.imageSource, await loadSheetPixels(ts.imageSource));
    }

    // Build tile definitions
    const defs = {
        _config: {
            assetBase: './assets/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG/',
            tileSize: 16,
        },
        empty: { name: 'Empty', category: 'system', walkable: true },
    };

    let totalTiles = 0;
    let skippedUsage = 0;
    let skippedTransparent = 0;

    for (const ts of tilesets) {
        const prefix = toPrefix(ts.name);
        const category = CATEGORY_MAP[ts.name] || 'unknown';
        const walkable = WALKABLE_BY_CATEGORY[category] ?? true;
        const pixels = sheetPixels.get(ts.imageSource);
        const sheetFile = outputFilename(ts.imageSource);

        for (let i = 0; i < ts.tileCount; i++) {
            const col = i % ts.columns;
            const row = Math.floor(i / ts.columns);
            const gid = ts.firstgid + i;

            // Filter: used in example map
            if (!importAll && !usedGids.has(gid)) {
                skippedUsage++;
                continue;
            }

            // Filter: skip fully transparent tiles
            if (isTileTransparent(pixels, col, row, ts.tileWidth, ts.tileHeight)) {
                skippedTransparent++;
                continue;
            }

            const id = `${prefix}_${col}_${row}`;
            defs[id] = {
                name: `${prefix} ${col},${row}`,
                category,
                walkable,
                sprite: { sheet: sheetFile, col, row },
            };
            totalTiles++;
        }
    }

    console.log(`\nGenerated ${totalTiles} tile definitions`);
    console.log(`  Skipped (not used in example): ${skippedUsage}`);
    console.log(`  Skipped (fully transparent): ${skippedTransparent}`);

    writeFileSync(OUTPUT_PATH, JSON.stringify(defs, null, 2) + '\n', 'utf-8');
    console.log(`\nWritten to: ${OUTPUT_PATH}`);

    // Summary by tileset
    console.log('\nBreakdown:');
    for (const ts of tilesets) {
        const prefix = toPrefix(ts.name);
        const maxGid = ts.firstgid + ts.tileCount - 1;
        const count = Object.keys(defs).filter(k => k.startsWith(prefix + '_')).length;
        console.log(`  ${prefix}: ${count} tiles imported`);
    }
}

main().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
