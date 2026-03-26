export class SidebarUI {
    constructor(bus, state, items, tiles) {
        this.bus = bus;
        this.state = state;
        this.items = items; // ItemRegistry
        this.tiles = tiles; // TileDefs
        
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
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    init() {
        this.renderGroundPalette();
        this.renderItemPalette();
        this.setupEntityTools();
        this.refreshEntityList();
        
        document.getElementById('save-master-btn').onclick = () => {
            this.bus.emit('save:requested');
        };
    }

    renderGroundPalette() {
        const tilesList = this.tiles.getAllTiles();
        if (!this.groundGrid) {
            console.error('groundGrid element NOT FOUND');
            return;
        }
        this.groundGrid.innerHTML = '';
        this.tiles.getAllTiles().forEach(tile => {
            if (tile.id === 'empty') return;
            const el = document.createElement('div');
            el.className = 'tile-item';
            el.title = `${tile.name} (${tile.category || 'ground'})`;
            el.dataset.id = tile.id;
            el.style.backgroundColor = `#${tile.id.includes('water') ? '0077b6' : (tile.category === 'cave' ? '444444' : '3a5a40')}`;
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

    setupEntityTools() {
        const tools = ['spawner', 'warp', 'zone', 'fill', 'erase'];
        tools.forEach(tool => {
            const el = document.getElementById(`tool-${tool}`);
            if (el) {
                el.onclick = () => {
                    this._clearActive('.tile-item');
                    el.classList.add('active');
                    this.bus.emit('tool:changed', tool);
                };
            }
        });
    }

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

    _clearActive(selector) {
        document.querySelectorAll(selector).forEach(el => el.classList.remove('active'));
    }
}
