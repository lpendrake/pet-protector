import { FloatingWindow } from './FloatingWindow.js';

/**
 * Floating panel for managing maps: load, rename, create, deploy.
 * Toggle-opens from the Toolbar's Maps button.
 *
 * Listens to:
 *   'save:completed' → refresh (master saves only)
 *   'map:loaded'     → refresh
 *   'map:created'    → refresh
 *   'map:renamed'    → refresh
 *
 * Emits:
 *   'toast:show' → deploy/rename/create success/failure feedback
 */
export class MapsManagerPanel {
    /**
     * @param {EventBus} bus
     * @param {PersistenceClient} persistence
     * @param {HTMLElement} parent
     */
    constructor(bus, persistence, parent) {
        this.bus = bus;
        this.persistence = persistence;

        this.window = new FloatingWindow({
            id: 'maps-manager',
            title: 'Maps',
            parent,
            x: 300,
            y: 60,
            width: 280,
            closable: true,
        });

        this._listEl = null;
        this._buildContent();

        if (this.bus) {
            this.bus.on('save:completed', (data) => {
                if (data.type === 'master') this._refresh();
            });
            this.bus.on('map:loaded', () => this._refresh());
            this.bus.on('map:created', () => this._refresh());
            this.bus.on('map:renamed', () => this._refresh());
        }
    }

    // Proxy for Toolbar toggle wiring
    get el() { return this.window.el; }
    open() { this.window.open(); this._refresh(); }
    close() { this.window.close(); }
    toggle() { if (this.window.isOpen()) this.close(); else this.open(); }
    isOpen() { return this.window.isOpen(); }

    _buildContent() {
        const container = document.createElement('div');
        container.style.cssText = 'font-size: 11px;';

        // ── New Map bar ────────────────────────────────────────────────
        const newBar = document.createElement('div');
        newBar.style.cssText = 'display: flex; gap: 4px; margin-bottom: 8px;';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'new_map_name';
        nameInput.style.cssText = 'flex: 1; padding: 4px 6px; font-size: 11px; background: #1a1a1d; color: #ddd; border: 1px solid #444; border-radius: 3px;';
        nameInput.addEventListener('keydown', (e) => e.stopPropagation());

        const createBtn = document.createElement('button');
        createBtn.textContent = '+ New';
        createBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; cursor: pointer; background: #2a5a8c; color: white; border: 1px solid #444; border-radius: 3px;';
        createBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (!name) return;
            if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
                this.bus.emit('toast:show', { message: 'Invalid name (use letters, numbers, - or _)', type: 'error' });
                return;
            }
            createBtn.disabled = true;
            createBtn.textContent = '...';
            try {
                await this.persistence.createMap(name);
                this.bus.emit('toast:show', { message: `Created "${name}"`, type: 'info' });
                nameInput.value = '';
                this._refresh();
            } catch (e) {
                this.bus.emit('toast:show', { message: `Create failed: ${e.message}`, type: 'error' });
            } finally {
                createBtn.disabled = false;
                createBtn.textContent = '+ New';
            }
        });

        newBar.appendChild(nameInput);
        newBar.appendChild(createBtn);
        container.appendChild(newBar);

        // ── Map list ───────────────────────────────────────────────────
        this._listEl = document.createElement('div');
        this._listEl.innerHTML = '<span style="color: #555;">Loading...</span>';
        container.appendChild(this._listEl);

        this.window.setContent(container);
    }

    async _refresh() {
        if (!this._listEl || !this.persistence) return;
        this._listEl.innerHTML = '<span style="color: #555;">Loading...</span>';

        let maps;
        try {
            maps = await this.persistence.listMaps();
        } catch (e) {
            this._listEl.innerHTML = '<span style="color: #900;">Server unreachable</span>';
            return;
        }

        this._listEl.innerHTML = '';
        if (maps.length === 0) {
            this._listEl.innerHTML = '<span style="color: #555;">No maps found</span>';
            return;
        }

        const currentMap = this.persistence.state.mapName;

        maps.forEach(map => {
            const isDeployed = map.deployedVersion !== null;
            const needsDeploy = map.version > (map.deployedVersion ?? -1);
            const isCurrent = map.name === currentMap;

            const row = document.createElement('div');
            row.style.cssText = `padding: 6px 0; border-bottom: 1px solid #2a2a2e; display: flex; align-items: center; gap: 4px;${isCurrent ? ' background: rgba(255,255,255,0.03);' : ''}`;

            // ── Name label (click to load) ─────────────────────────────
            const label = document.createElement('div');
            label.style.cssText = 'flex: 1; overflow: hidden; cursor: pointer;';
            label.title = isCurrent ? 'Current map' : `Click to load "${map.name}"`;
            label.innerHTML = `
                <div style="font-size: 11px; color: ${isCurrent ? '#8cf' : '#ddd'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${isCurrent ? '\u25B6 ' : ''}${map.name}
                </div>
                <div style="font-size: 10px; color: #555;">
                    v${map.version ?? '\u2014'}
                    ${isDeployed ? `\u00B7 deployed v${map.deployedVersion}` : '\u00B7 not deployed'}
                    ${needsDeploy ? '<span style="color: #f90;"> \u25CF</span>' : ''}
                </div>`;

            if (!isCurrent) {
                label.addEventListener('click', async () => {
                    try {
                        await this.persistence.loadMap(map.name);
                        this.bus.emit('toast:show', { message: `Loaded "${map.name}"`, type: 'info' });
                    } catch (e) {
                        this.bus.emit('toast:show', { message: `Load failed: ${e.message}`, type: 'error' });
                    }
                });
            }

            // ── Rename button ──────────────────────────────────────────
            const renameBtn = document.createElement('button');
            renameBtn.textContent = '\u270E'; // ✎
            renameBtn.title = 'Rename';
            renameBtn.style.cssText = 'padding: 3px 5px; font-size: 11px; cursor: pointer; background: transparent; color: #888; border: 1px solid transparent; border-radius: 3px;';
            renameBtn.addEventListener('mouseenter', () => { renameBtn.style.borderColor = '#444'; });
            renameBtn.addEventListener('mouseleave', () => { renameBtn.style.borderColor = 'transparent'; });
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._startRename(row, map.name);
            });

            // ── Deploy button ──────────────────────────────────────────
            const deployBtn = document.createElement('button');
            deployBtn.textContent = isDeployed && !needsDeploy ? '\u2713' : 'Deploy';
            deployBtn.style.cssText = `padding: 3px 6px; font-size: 10px; cursor: pointer; background: ${needsDeploy ? '#3d8c40' : '#2a2a2e'}; color: white; border: 1px solid #444; border-radius: 3px;`;
            deployBtn.addEventListener('click', async () => {
                deployBtn.disabled = true;
                deployBtn.textContent = '...';
                try {
                    await this.persistence.deployMap(map.name);
                    this.bus.emit('toast:show', { message: `Deployed "${map.name}"`, type: 'info' });
                    this._refresh();
                } catch (e) {
                    this.bus.emit('toast:show', { message: `Deploy failed: ${e.message}`, type: 'error' });
                    deployBtn.disabled = false;
                    deployBtn.textContent = 'Deploy';
                }
            });

            row.appendChild(label);
            row.appendChild(renameBtn);
            row.appendChild(deployBtn);
            this._listEl.appendChild(row);
        });
    }

    /**
     * Replace a map row's content with an inline rename form.
     * @param {HTMLElement} row
     * @param {string} currentName
     */
    _startRename(row, currentName) {
        row.innerHTML = '';
        row.style.cssText += 'display: flex; align-items: center; gap: 4px;';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.style.cssText = 'flex: 1; padding: 3px 5px; font-size: 11px; background: #1a1a1d; color: #ddd; border: 1px solid #5a8abf; border-radius: 3px;';
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') confirmBtn.click();
            if (e.key === 'Escape') this._refresh();
        });

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '\u2713'; // ✓
        confirmBtn.style.cssText = 'padding: 3px 6px; font-size: 11px; cursor: pointer; background: #3d8c40; color: white; border: 1px solid #444; border-radius: 3px;';
        confirmBtn.addEventListener('click', async () => {
            const newName = input.value.trim();
            if (!newName || newName === currentName) { this._refresh(); return; }
            if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
                this.bus.emit('toast:show', { message: 'Invalid name (use letters, numbers, - or _)', type: 'error' });
                return;
            }
            confirmBtn.disabled = true;
            try {
                await this.persistence.renameMap(currentName, newName);
                this.bus.emit('toast:show', { message: `Renamed "${currentName}" \u2192 "${newName}"`, type: 'info' });
            } catch (e) {
                this.bus.emit('toast:show', { message: `Rename failed: ${e.message}`, type: 'error' });
                this._refresh();
            }
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '\u2715'; // ✕
        cancelBtn.style.cssText = 'padding: 3px 6px; font-size: 11px; cursor: pointer; background: #555; color: white; border: 1px solid #444; border-radius: 3px;';
        cancelBtn.addEventListener('click', () => this._refresh());

        row.appendChild(input);
        row.appendChild(confirmBtn);
        row.appendChild(cancelBtn);

        input.focus();
        input.select();
    }
}
