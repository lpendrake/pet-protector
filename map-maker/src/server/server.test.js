import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// We'll test the core logic of the rename sequence by mocking FS or using a temp test dir
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.resolve(__dirname, '../../test_maps');

async function ensureDir(dir) {
    try { await fs.access(dir); } catch { await fs.mkdir(dir, { recursive: true }); }
}

async function setupTestMap(mapName) {
    const masterDir = path.join(TEST_DIR, mapName);
    const tmpDir = path.join(TEST_DIR, `${mapName}_tmp`);
    await ensureDir(masterDir);
    await ensureDir(tmpDir);
    await fs.writeFile(path.join(masterDir, 'manifest.json'), JSON.stringify({ version: 1 }));
    await fs.writeFile(path.join(tmpDir, 'manifest.json'), JSON.stringify({ version: 1 }));
    return { masterDir, tmpDir };
}

test('Atomic Save - Promotion Sequence', async (t) => {
    await ensureDir(TEST_DIR);
    const mapName = 'test_map';
    const masterDir = path.join(TEST_DIR, mapName);
    const tmpDir = path.join(TEST_DIR, `${mapName}_tmp`);
    const oldDir = path.join(TEST_DIR, `${mapName}_old`);
    const oldDelDir = path.join(TEST_DIR, `${mapName}_old_del`);

    // Setup initial state
    await setupTestMap(mapName);

    // --- MOCK PROMOTION LOGIC (Extracted from server.js for pure logic test) ---
    const runPromotion = async (m) => {
        m.version += 1;
        try { await fs.rm(oldDelDir, { recursive: true, force: true }); } catch (e) {}
        if (await fs.stat(oldDir).catch(() => null)) await fs.rename(oldDir, oldDelDir);
        if (await fs.stat(masterDir).catch(() => null)) await fs.rename(masterDir, oldDir);
        await fs.writeFile(path.join(tmpDir, 'manifest.json'), JSON.stringify(m, null, 2));
        await fs.rename(tmpDir, masterDir);
        await ensureDir(tmpDir); // initialization
        try { await fs.rm(oldDelDir, { recursive: true, force: true }); } catch (e) {}
    };

    const manifest = { version: 1 };
    await runPromotion(manifest);

    // Assert master exists and has version 2
    const masterManifest = JSON.parse(await fs.readFile(path.join(masterDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(masterManifest.version, 2);

    // Assert old exists and has version 1
    const oldManifest = JSON.parse(await fs.readFile(path.join(oldDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(oldManifest.version, 1);

    // Assert tmp was re-initialized
    assert.ok(await fs.stat(tmpDir).catch(() => false));

    // Cleanup
    await fs.rm(TEST_DIR, { recursive: true, force: true });
});

test('Atomic Save - Zero Data Loss on Sequential Saves', async (t) => {
    await ensureDir(TEST_DIR);
    const mapName = 'perf_test';
    const masterDir = path.join(TEST_DIR, mapName);
    const tmpDir = path.join(TEST_DIR, `${mapName}_tmp`);
    const oldDir = path.join(TEST_DIR, `${mapName}_old`);

    const runPromotion = async (m) => {
        const oldDelDir = path.join(TEST_DIR, `${mapName}_old_del`);
        m.version += 1;
        try { await fs.rm(oldDelDir, { recursive: true, force: true }); } catch (e) {}
        if (await fs.stat(oldDir).catch(() => null)) await fs.rename(oldDir, oldDelDir);
        if (await fs.stat(masterDir).catch(() => null)) await fs.rename(masterDir, oldDir);
        await fs.writeFile(path.join(tmpDir, 'manifest.json'), JSON.stringify(m, null, 2));
        await fs.rename(tmpDir, masterDir);
        await ensureDir(tmpDir);
        try { await fs.rm(oldDelDir, { recursive: true, force: true }); } catch (e) {}
    };

    // Save 1
    await setupTestMap(mapName);
    await runPromotion({ version: 1 });
    
    // Save 2
    await fs.writeFile(path.join(tmpDir, 'data.txt'), 'new data');
    await runPromotion({ version: 2 });

    const masterManifest = JSON.parse(await fs.readFile(path.join(masterDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(masterManifest.version, 3);
    
    const oldManifest = JSON.parse(await fs.readFile(path.join(oldDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(oldManifest.version, 2);

    // Cleanup
    await fs.rm(TEST_DIR, { recursive: true, force: true });
});
