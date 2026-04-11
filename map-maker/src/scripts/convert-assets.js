#!/usr/bin/env node

/**
 * Asset Converter — PNG → WebP (lossless)
 *
 * Converts all PNG spritesheets and images to WebP lossless format.
 * WebP lossless is 60-80% smaller than PNG for pixel art while
 * preserving every pixel exactly.
 *
 * Usage:
 *   node src/scripts/convert-assets.js [directory]
 *
 * Defaults to the bundled Craftpix asset directory if no path given.
 */

import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = resolve(
    __dirname,
    '../assets/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG'
);

function collectPngs(dir) {
    const results = [];
    for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            results.push(...collectPngs(full));
        } else if (extname(entry).toLowerCase() === '.png') {
            results.push(full);
        }
    }
    return results;
}

function fmtBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
    const targetDir = process.argv[2] || DEFAULT_DIR;
    const pngs = collectPngs(targetDir);
    console.log(`Converting ${pngs.length} PNG files → WebP lossless\n`);

    let totalPng = 0;
    let totalWebp = 0;

    for (const pngPath of pngs) {
        const pngSize = statSync(pngPath).size;
        const webpPath = pngPath.replace(/\.png$/i, '.webp');
        const name = pngPath.slice(targetDir.length + 1).replace(/\\/g, '/');

        await sharp(pngPath)
            .webp({ lossless: true, effort: 6 })
            .toFile(webpPath);

        const webpSize = statSync(webpPath).size;
        totalPng += pngSize;
        totalWebp += webpSize;

        const saved = ((1 - webpSize / pngSize) * 100).toFixed(0);
        console.log(`  ${name}: ${fmtBytes(pngSize)} → ${fmtBytes(webpSize)} (${saved}%)`);
    }

    const totalSaved = ((1 - totalWebp / totalPng) * 100).toFixed(1);
    console.log(`\nTotal: ${fmtBytes(totalPng)} → ${fmtBytes(totalWebp)} (${totalSaved}% smaller)`);
}

main().catch(err => {
    console.error('Conversion failed:', err);
    process.exit(1);
});
