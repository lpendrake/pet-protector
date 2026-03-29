import { TILE_COLORS, TILE_LABELS } from '../rendering/TileColors.js';

/**
 * Drives all sidebar panels: tile/item palette, tool buttons, entity list, and maps manager.
 *
 * Listens to:
 *   'state:changed'   → refresh entity list
 *   'fill:error'      → show toast
 *   'save:error'      → show toast
 *   'tool:active'     → highlight the active tool button
 *   'save:completed'  → refresh maps manager (master saves only)
 *   'map:loaded'      → refresh maps manager
 *   'map:created'     → refresh maps manager
 *
 * Emits:
 *   'tile:selected'   → when a ground tile is clicked in the palette
 *   'item:selected'   → when an item is clicked in the palette
 *   'tool:changed'    → when a tool button is clicked
 *   'save:requested'  → when the Save Master button is clicked
 *   'entity:selected' → when an entity row in the list is clicked
 *   'viewport:snap'   → when an entity row is clicked (to center the viewport on it)
 */
export class SidebarUI {
    /**
     * @param {EventBus} bus
     * @param {MapState} state
     * @param {ItemRegistry} items
     * @param {TileDefs} tiles
     * @param {PersistenceClient} persistence
     */
    constructor(bus, state, items, tiles, persistence) {
        this.bus = bus;
        this.state = state;
        this.items = items;
        this.tiles = tiles;
        this.persistence = persistence;

        this.groundGrid = document.getElementById('ground-grid');
        this.itemGrid = document.getElementById('item-grid');
        this.selectedTileName = document.getElementById('selected-tile-name');

        if (this.bus) {
            this.bus.on('state:changed', () => this.refreshEntityList());
            this.bus.on('fill:error', (err) => {
                this.showToast(err.message, 'error');
            });
            this.bus.on('save:error', (err) => {
                this.showToast(`Save Error: ${err.message}`, 'error');
            });
            this.bus.on('tool:active', (tool) => this._setActiveTool(tool));
            this.bus.on('save:completed', (data) => {
                if (data.type === 'master') this.refreshMapsManager();
            });
            this.bus.on('map:loaded', () => this.refreshMapsManager());
            this.bus.on('map:created', () => this.refreshMapsManager());
        }
    }

    /**
     * Display a transient toast notification. Disappears after 4 seconds.
     * @param {string} message
     * @param {'info'|'error'} type
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    /** Wire up all palettes, tool buttons, and the save button. Call once after DOM is ready. */
    init() {
        this.renderGroundPalette();
        this.renderItemPalette();
        this.setupEntityTools();
        this.refreshEntityList();
        this.refreshMapsManager();

        document.getElementById('save-master-btn').onclick = () => {
            this.bus.emit('save:requested');
        };
    }

    /** Populate the ground tile palette from TileDefs. Skips the 'empty' sentinel tile. */
    renderGroundPalette() {
        if (!this.groundGrid) {
            console.error('groundGrid element NOT FOUND');
            return;
        }
        this.groundGrid.innerHTML = '';
        this.tiles.getAllTiles().forEach(tile => {
            if (tile.id === 'empty') return;
            const hexNum = TILE_COLORS[tile.id] ?? 0x555555;
            const bg = '#' + hexNum.toString(16).padStart(6, '0');
            const label = TILE_LABELS[tile.id] ?? tile.name[0];
            const el = document.createElement('div');
            el.className = 'tile-item';
            el.title = `${tile.name} (${tile.category || 'ground'})`;
            el.dataset.id = tile.id;
            el.style.cssText += `background-color: ${bg}; color: #fff; font-size: 13px; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.8);`;
            el.innerText = label;
            el.onclick = (e) => {
                e.stopPropagation();
                this._clearActive('#ground-grid .tile-item');
                el.classList.add('active');
                this.selectedTileName.innerText = `Selected: ${tile.name}`;
                this.bus.emit('tile:selected', tile.id);
            };
            this.groundGrid.appendChild(el);
        });
    }

    /** Populate the item palette from ItemRegistry. Items with no emoji fall back to '📦'. */
    renderItemPalette() {
        this.itemGrid.innerHTML = '';
        this.items.getAllItems().forEach(item => {
            const el = document.createElement('div');
            el.className = 'tile-item';
            el.title = item.name;
            el.innerText = item.emoji || '📦';
            el.onclick = () => {
                this._clearActive('.tile-item');
                el.classList.add('active');
                this.bus.emit('item:selected', item.id);
            };
            this.itemGrid.appendChild(el);
        });
    }

    /** Wire click handlers for each tool button. Emits 'tool:changed' on click. */
    setupEntityTools() {
        const tools = ['brush', 'spawner', 'warp', 'zone', 'fill', 'erase'];
        tools.forEach(tool => {
            const el = document.getElementById(`tool-${tool}`);
            if (el) {
                el.onclick = () => {
                    this.bus.emit('tool:changed', tool);
                };
            }
        });
    }

    /**
     * Highlight the active tool's button. Called when 'tool:active' is received.
     * Clears all `.tile-item` active states first — both palette items and tool buttons
     * share this class, so selecting a tool deselects any selected tile.
     * @param {string} tool - Tool name (e.g. 'brush', 'erase')
     */
    _setActiveTool(tool) {
        document.querySelectorAll('.tile-item').forEach(el => el.classList.remove('active'));
        const el = document.getElementById(`tool-${tool}`);
        if (el) el.classList.add('active');
    }

    /**
     * Rebuild the entity list panel from the current manifest (spawnPoints + warps).
     * Each row emits 'entity:selected' and 'viewport:snap' when clicked.
     */
    refreshEntityList() {
        const listEl = document.getElementById('entity-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        
        const entities = [
            ...(this.state.manifest.spawnPoints || []).map(e => ({ ...e, type: 'spawnPoints' })),
            ...(this.state.manifest.warps || []).map(e => ({ ...e, type: 'warps' }))
        ];

        entities.forEach(ent => {
            const el = document.createElement('div');
            el.style.cssText = 'padding: 5px; cursor: pointer; border-bottom: 1px solid #333; font-size: 11px;';
            el.innerText = `${ent.name} (${ent.x}, ${ent.y})`;
            el.onclick = () => {
                this.bus.emit('entity:selected', ent);
                this.bus.emit('viewport:snap', { x: ent.x, y: ent.y });
            };
            listEl.appendChild(el);
        });
    }

    /**
     * Fetch the map list from the server and rebuild the maps manager panel.
     * Each map row shows its master version, deployed version, and a Deploy button.
     * A deploy button deployes the current master to the game's web/maps directory.
     */
    async refreshMapsManager() {
        const listEl = document.getElementById('maps-list');
        if (!listEl || !this.persistence) return;
        listEl.innerHTML = '<span style="color: #555;">Loading...</span>';

        let maps;
        try {
            maps = await this.persistence.listMaps();
        } catch (e) {
            listEl.innerHTML = '<span style="color: #900;">Server unreachable</span>';
            return;
        }

        listEl.innerHTML = '';
        if (maps.length === 0) {
            listEl.innerHTML = '<span style="color: #555;">No maps found</span>';
            return;
        }

        maps.forEach(map => {
            const isDeployed = map.deployedVersion !== null;
            const needsDeploy = map.version > (map.deployedVersion ?? -1);

            const row = document.createElement('div');
            row.style.cssText = 'padding: 6px 0; border-bottom: 1px solid #2a2a2e; display: flex; align-items: center; gap: 6px;';

            const label = document.createElement('div');
            label.style.cssText = 'flex: 1; overflow: hidden;';
            label.innerHTML = `
                <div style="font-size: 11px; color: #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${map.name}</div>
                <div style="font-size: 10px; color: #555;">
                    master v${map.version ?? '—'}
                    ${isDeployed ? `· deployed v${map.deployedVersion}` : '· not deployed'}
                    ${needsDeploy ? '<span style="color: #f90;"> ●</span>' : ''}
                </div>`;

            const deployBtn = document.createElement('button');
            deployBtn.innerText = isDeployed && !needsDeploy ? '✓' : 'Deploy';
            deployBtn.style.cssText = `padding: 3px 6px; font-size: 10px; cursor: pointer; background: ${needsDeploy ? '#3d8c40' : '#2a2a2e'}; color: white; border: 1px solid #444;`;
            deployBtn.onclick = async () => {
                deployBtn.disabled = true;
                deployBtn.innerText = '...';
                try {
                    await this.persistence.deployMap(map.name);
                    this.showToast(`Deployed "${map.name}"`, 'info');
                    this.refreshMapsManager();
                } catch (e) {
                    this.showToast(`Deploy failed: ${e.message}`, 'error');
                    deployBtn.disabled = false;
                    deployBtn.innerText = 'Deploy';
                }
            };

            row.appendChild(label);
            row.appendChild(deployBtn);
            listEl.appendChild(row);
        });
    }

    /**
     * Remove the 'active' class from all elements matching a CSS selector.
     * @param {string} selector
     */
    _clearActive(selector) {
        document.querySelectorAll(selector).forEach(el => el.classList.remove('active'));
    }
}
