import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const MAPS_DIR = path.resolve(__dirname, '../../maps');
const DEPLOY_DIR = path.resolve(__dirname, '../../../web/maps');

// Ensure maps directory exists
async function ensureDir(dir) {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

// Atomic Safe Promotion Logic
app.post('/api/save-master', async (req, res) => {
    const { mapName, manifest, chunks } = req.body;
    if (!mapName) return res.status(400).send('Map name required');

    const masterDir = path.join(MAPS_DIR, mapName);
    const tmpDir = path.join(MAPS_DIR, `${mapName}_tmp`);
    const oldDir = path.join(MAPS_DIR, `${mapName}_old`);
    const oldDelDir = path.join(MAPS_DIR, `${mapName}_old_del`);

    try {
        // 1. Version Bump (Internal logic before rename)
        manifest.version = (manifest.version || 0) + 1;

        // 2. Preparation: Clean old_del
        try { await fs.rm(oldDelDir, { recursive: true, force: true }); } catch (e) {}

        // 3. Backup: Rename old to old_del
        try {
            if (await fs.stat(oldDir).catch(() => null)) {
                await fs.rename(oldDir, oldDelDir);
            }
        } catch (e) {}

        // 4. Rotation: Rename master to old
        try {
            if (await fs.stat(masterDir).catch(() => null)) {
                await fs.rename(masterDir, oldDir);
            }
        } catch (e) {}

        // 5. Promotion: Move tmp to master
        await fs.writeFile(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
        
        try {
            await fs.rename(tmpDir, masterDir);
        } catch (renameErr) {
            console.warn('Rename failed, using copy fallback (Windows EPERM?):', renameErr.message);
            await ensureDir(masterDir);
            const filesToPromote = await fs.readdir(tmpDir, { recursive: true });
            for (const file of filesToPromote) {
                const src = path.join(tmpDir, file);
                const dest = path.join(masterDir, file);
                try {
                    const stat = await fs.stat(src);
                    if (stat.isDirectory()) {
                        await ensureDir(dest);
                    } else {
                        await fs.copyFile(src, dest);
                    }
                } catch (copyErr) {
                    console.warn(`Could not promote ${file}:`, copyErr.message);
                }
            }
            // Optional: try to clean tmp but don't fail if locked
            await fs.rm(tmpDir, { recursive: true, force: true }).catch(e => console.warn('Could not clean tmp:', e.message));
        }

        // 6. Finalization: Ensure tmp exists and matches master
        await ensureDir(tmpDir);
        const filesToSync = await fs.readdir(masterDir, { recursive: true });
        for (const file of filesToSync) {
            const src = path.join(masterDir, file);
            const dest = path.join(tmpDir, file);
            const stat = await fs.stat(src);
            if (stat.isDirectory()) {
                await ensureDir(dest);
            } else {
                await fs.copyFile(src, dest);
            }
        }

        // 7. Cleanup OLD_DEL
        try { await fs.rm(oldDelDir, { recursive: true, force: true }); } catch (e) {}

        res.json({ success: true, version: manifest.version });
    } catch (err) {
        console.error('Save master failed:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Auto-save to _tmp
app.post('/api/auto-save', async (req, res) => {
    const { mapName, manifest, chunks } = req.body;
    if (!mapName) return res.status(400).send('Map name required');

    const tmpDir = path.join(MAPS_DIR, `${mapName}_tmp`);
    const chunksDir = path.join(tmpDir, 'chunks');

    try {
        await ensureDir(chunksDir);
        await fs.writeFile(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

        for (const [chunkId, chunkData] of Object.entries(chunks)) {
            await fs.writeFile(path.join(chunksDir, `${chunkId}.json`), JSON.stringify(chunkData, null, 2));
        }

        res.json({ success: true, timestamp: Date.now() });
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// Deploy sync
app.post('/api/deploy', async (req, res) => {
    const { mapName, deploy } = req.body;
    const srcDir = path.join(MAPS_DIR, mapName);
    const destDir = path.join(DEPLOY_DIR, mapName);

    try {
        if (deploy) {
            await ensureDir(destDir);
            await ensureDir(path.join(destDir, 'chunks'));
            const files = await fs.readdir(srcDir, { recursive: true });
            for (const file of files) {
                const src = path.join(srcDir, file);
                const dest = path.join(destDir, file);
                const stat = await fs.stat(src);
                if (stat.isDirectory()) {
                    await ensureDir(dest);
                } else {
                    await fs.copyFile(src, dest);
                }
            }
        } else {
            await fs.rm(destDir, { recursive: true, force: true });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/maps', async (req, res) => {
    try {
        await ensureDir(MAPS_DIR);
        const dirs = await fs.readdir(MAPS_DIR);
        const maps = {};

        for (const dir of dirs) {
            const isTmp = dir.endsWith('_tmp');
            const isOld = dir.endsWith('_old');
            const baseName = dir.replace(/(_tmp|_old)$/, '');
            
            if (!maps[baseName]) maps[baseName] = { name: baseName };
            
            const manifestPath = path.join(MAPS_DIR, dir, 'manifest.json');
            try {
                const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
                if (isTmp) maps[baseName].tmpVersion = manifest.version;
                else if (isOld) maps[baseName].oldVersion = manifest.version;
                else maps[baseName].version = manifest.version;
            } catch (e) {}
        }

        // Check deployment status
        for (const mapName of Object.keys(maps)) {
            const deployPath = path.join(DEPLOY_DIR, mapName, 'manifest.json');
            try {
                const manifest = JSON.parse(await fs.readFile(deployPath, 'utf8'));
                maps[mapName].deployedVersion = manifest.version;
            } catch (e) {
                maps[mapName].deployedVersion = null;
            }
        }

        res.json(Object.values(maps));
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/create-map', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).send('Name required');

    const tmpDir = path.join(MAPS_DIR, `${name}_tmp`);
    const chunksDir = path.join(tmpDir, 'chunks');

    try {
        await ensureDir(tmpDir);
        await ensureDir(chunksDir);
        
        const manifest = { version: 0, spawnPoints: [], zones: [], warps: [] };
        await fs.writeFile(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
        
        res.json({ success: true, name });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/load-map/:name', async (req, res) => {
    const { name } = req.params;
    const masterDir = path.join(MAPS_DIR, name);
    const tmpDir = path.join(MAPS_DIR, `${name}_tmp`);
    
    // Favor tmp if it exists (active edits), otherwise master
    let targetDir = tmpDir;
    try {
        await fs.access(tmpDir);
    } catch {
        targetDir = masterDir;
    }

    try {
        const manifest = JSON.parse(await fs.readFile(path.join(targetDir, 'manifest.json'), 'utf8'));
        const chunks = {};
        const chunksDir = path.join(targetDir, 'chunks');
        
        try {
            const files = await fs.readdir(chunksDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const chunkId = path.basename(file, '.json');
                    const chunkData = JSON.parse(await fs.readFile(path.join(chunksDir, file), 'utf8'));
                    chunks[chunkId] = chunkData;
                }
            }
        } catch (e) {
            // No chunks yet, that's fine
        }

        res.json({ mapName: name, manifest, chunks });
    } catch (err) {
        res.status(500).send(`Map not found: ${err.message}`);
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Map Maker Server running on http://localhost:${PORT}`);
});
