import { Renderer } from './core/Renderer.js';
import { Viewport } from './core/Viewport.js';
import { GlobalState } from './core/State.js';
import { Registry } from './core/Items.js';
import { PaintTileAction } from './core/Actions.js';

const viewportContainer = document.getElementById('viewport-container');
const renderer = new Renderer(viewportContainer);
const viewport = new Viewport(renderer);

// Simple Loop
function animate() {
    requestAnimationFrame(animate);
    renderer.update();
}
animate();

// Initialize Ground Palette
const groundGrid = document.getElementById('ground-grid');
const groundTiles = [
    'grassland', 'forest', 'ruins', 
    'water', 'cave', 'rock', 
    'river', 'stream', 'deep_water'
];
let selectedGround = 'grassland';

groundTiles.forEach(id => {
    const el = document.createElement('div');
    el.className = `tile-item ${id === selectedGround ? 'active' : ''}`;
    el.style.background = renderer._getBaseColor(id);
    el.title = id.replace('_', ' '); // tooltips
    el.onclick = () => {
        document.querySelectorAll('#sidebar .tile-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
        selectedGround = id;
        selectedItem = null;
    };
    groundGrid.appendChild(el);
});

// Initialize Item Palette
const itemGrid = document.getElementById('item-grid');
let selectedItem = null;

Registry.getAllItems().forEach(item => {
    const el = document.createElement('div');
    el.className = 'tile-item';
    el.innerHTML = item.emoji;
    el.onclick = () => {
        document.querySelectorAll('#sidebar .tile-item').forEach(i => i.classList.remove('active'));
        if (selectedItem === item.id) {
            selectedItem = null;
            selectedGround = 'grass_v1';
            document.querySelector('#ground-grid .tile-item').classList.add('active');
        } else {
            el.classList.add('active');
            selectedItem = item.id;
        }
    };
    itemGrid.appendChild(el);
});

// Click to paint
renderer.app.view.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !e.altKey) {
        const worldPos = viewport.screenToWorld(e.clientX - renderer.app.view.offsetLeft, e.clientY - renderer.app.view.offsetTop);
        const tx = Math.floor(worldPos.x / 32);
        const ty = Math.floor(worldPos.y / 32);
        
        const oldData = GlobalState.getTileData(tx, ty);
        
        if (selectedItem) {
            if (oldData.item !== selectedItem) {
                const action = new PaintTileAction(tx, ty, 'item', selectedItem, oldData.item);
                GlobalState.applyAction(action);
            }
        } else {
            if (oldData.base !== selectedGround) {
                const action = new PaintTileAction(tx, ty, 'base', selectedGround, oldData.base);
                GlobalState.applyAction(action);
            }
        }
    }
});

// Keybinds for Undo/Redo
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        GlobalState.undo();
    }
    if (e.ctrlKey && e.key === 'y') {
        GlobalState.redo();
    }
});

// Manual Save (Promotion)
document.getElementById('save-master-btn').onclick = async () => {
    try {
        const resp = await fetch('http://localhost:3001/api/save-master', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mapName: GlobalState.mapName,
                manifest: GlobalState.manifest,
                chunks: GlobalState.chunks
            })
        });
        if (resp.ok) {
            const data = await resp.json();
            GlobalState.manifest.version = data.version;
            alert('Master saved and promoted!');
            refreshMapsList();
        }
    } catch (e) {
        console.error('Save failed', e);
    }
};

// Maps Manager
async function refreshMapsList() {
    try {
        const resp = await fetch('http://localhost:3001/api/maps');
        const maps = await resp.json();
        const list = document.getElementById('maps-list');
        list.innerHTML = '';
        
        maps.forEach(map => {
            const div = document.createElement('div');
            div.style.padding = '5px';
            div.style.borderBottom = '1px solid #333';
            
            const isOutdated = map.version > (map.deployedVersion || 0);
            
            div.innerHTML = `
                <div style="font-weight:bold; color: ${isOutdated ? '#ffaa00' : '#fff'}">${map.name}</div>
                <div>v${map.version || 0} (Deployed: ${map.deployedVersion || 'None'})</div>
                <label><input type="checkbox" ${map.deployedVersion !== null ? 'checked' : ''} onchange="toggleDeploy('${map.name}', this.checked)"> Deployed</label>
            `;
            list.appendChild(div);
        });
    } catch (e) {}
}

window.toggleDeploy = async (mapName, deploy) => {
    await fetch('http://localhost:3001/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapName, deploy })
    });
    refreshMapsList();
};

// Entity Snap
function refreshEntityList() {
    const list = document.getElementById('entity-list');
    list.innerHTML = '';
    
    // Spawners
    GlobalState.manifest.spawnPoints.forEach(s => {
        addEntityItem(list, `Spawn: ${s.name}`, s.x, s.y);
    });
    
    // Warps
    GlobalState.manifest.warps.forEach(w => {
        addEntityItem(list, `Warp: ${w.name}`, w.x, w.y);
    });
}

function addEntityItem(list, label, x, y) {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.padding = '2px 5px';
    div.innerHTML = `<span>${label}</span> <button onclick="snapTo(${x}, ${y})">Snap</button>`;
    list.appendChild(div);
}

window.snapTo = (x, y) => {
    const worldX = x * 32;
    const worldY = y * 32;
    renderer.world.x = (renderer.app.screen.width / 2) - (worldX * renderer.world.scale.x);
    renderer.world.y = (renderer.app.screen.height / 2) - (worldY * renderer.world.scale.y);
};

// Auto-save Loop
let lastAutoSave = Date.now();
setInterval(async () => {
    if (GlobalState.dirty) {
        try {
            const resp = await fetch('http://localhost:3001/api/auto-save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mapName: GlobalState.mapName,
                    manifest: GlobalState.manifest,
                    chunks: GlobalState.chunks
                })
            });
            if (resp.ok) {
                GlobalState.dirty = false;
                lastAutoSave = Date.now();
            }
        } catch (e) {
            console.error('Auto-save failed', e);
        }
    }
    updateStatusBar();
}, 5000);

function updateStatusBar() {
    const timer = document.getElementById('auto-save-timer');
    const version = document.getElementById('map-version');
    
    const diff = Math.floor((Date.now() - lastAutoSave) / 1000);
    timer.innerText = `${diff}s ago`;
    version.innerText = GlobalState.manifest.version;
}

refreshMapsList();
refreshEntityList();
updateStatusBar();
