import { EventBus } from './core/EventBus.js';
import { MapState } from './core/MapState.js';
import { ItemRegistryInstance } from './core/ItemRegistry.js';
import { Registry as TileDefs } from './core/TileDefs.js';
import { ToolManager } from './tools/ToolManager.js';
import { MapRenderer } from './rendering/MapRenderer.js';
import { Viewport } from './rendering/Viewport.js';
import { SidebarUI } from './ui/SidebarUI.js';
import { StatusBar } from './ui/StatusBar.js';
import { PropertyPanel } from './ui/PropertyPanel.js';
import { PersistenceClient } from './persistence/PersistenceClient.js';

const bus = new EventBus();
const state = new MapState(bus);
const items = ItemRegistryInstance;
const tiles = TileDefs;
const tools = new ToolManager(bus, state);
const renderer = new MapRenderer(document.getElementById('viewport-container'), bus, state, items);
const viewport = new Viewport(renderer);
const sidebar = new SidebarUI(bus, state, items, tiles);
const statusBar = new StatusBar(bus);
const propertyPanel = new PropertyPanel(bus, state);
const persistence = new PersistenceClient(bus, state, 'http://localhost:3001');

async function start() {
    try {
        await renderer.init();
    } catch (e) {
        console.error('Renderer initialization failed:', e);
    }
    
    viewport.init(renderer.app.canvas);
    console.log('[DEBUG] viewport initialized');
    
    // Wire up input from renderer to tool manager
    renderer.app.canvas.onmousedown = (e) => {
        const world = viewport.screenToWorld(e.offsetX, e.offsetY);
        const { tx, ty } = renderer.worldToTile(world.x, world.y);
        tools.onPointerDown(tx, ty);
    };
    
    renderer.app.canvas.onmousemove = (e) => {
        const world = viewport.screenToWorld(e.offsetX, e.offsetY);
        const { tx, ty } = renderer.worldToTile(world.x, world.y);
        tools.onPointerMove(tx, ty);
        bus.emit('cursor:moved', { tx, ty });
    };
    
    window.onmouseup = () => tools.onPointerUp();

    // Specific wiring
    bus.on('viewport:snap', (pos) => {
        // Center the view on tile coords
        viewport.offset.x = -pos.x * renderer.tileSize * viewport.scale + renderer.app.screen.width / 2;
        viewport.offset.y = -pos.y * renderer.tileSize * viewport.scale + renderer.app.screen.height / 2;
        viewport.apply();
    });

    sidebar.init();
    statusBar.init();
    propertyPanel.init();
    
    const maps = await persistence.listMaps();
    if (maps.length > 0) {
        await persistence.loadMap(maps[0].name);
    } else {
        await persistence.createMap('demo_map');
    }
    
    persistence.startAutoSave(5000);
}

start().catch(err => {
    console.error('Initalization failed:', err);
    document.body.innerHTML = `<div style="padding: 20px; color: red;"><h1>Init Failed</h1><pre>${err.message}\n${err.stack}</pre></div>`;
});
