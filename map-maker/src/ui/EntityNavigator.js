import { FloatingWindow } from './FloatingWindow.js';

/**
 * Per-type floating window for browsing manifest entities.
 * Each instance shows one entity type (warps, spawnPoints, zones).
 * Multiple can be open simultaneously.
 *
 * Features:
 *   - Search box: filters by name or ID (case-insensitive substring)
 *   - Edit action: emits 'entity:selected' to open in PropertyPanel
 *   - Locate action: emits 'viewport:snap' to center view on entity
 *
 * Listens to:
 *   'state:changed' → rebuilds the entity list (preserves search filter)
 *
 * Emits:
 *   'entity:selected' → when an entity row's edit action is clicked
 *   'viewport:snap'   → when an entity row's locate action is clicked
 */

const TYPE_LABELS = {
    warps:       'Warps',
    spawnPoints: 'Spawners',
    zones:       'Zones',
};

const TYPE_ICONS = {
    warps:       '\u{1F300}',       // 🌀
    spawnPoints: '\u{1F6A9}',       // 🚩
    zones:       '\u{1F5FA}\uFE0F', // 🗺️
};

export class EntityNavigator {
    /**
     * @param {EventBus} bus
     * @param {MapState} state
     * @param {HTMLElement} parent
     * @param {string} entityType - 'warps' | 'spawnPoints' | 'zones'
     */
    constructor(bus, state, parent, entityType) {
        this.bus = bus;
        this.state = state;
        this.entityType = entityType;
        this._searchQuery = '';

        this.window = new FloatingWindow({
            id: `entity-nav-${entityType}`,
            title: TYPE_LABELS[entityType] || entityType,
            parent,
            x: 200 + Object.keys(TYPE_LABELS).indexOf(entityType) * 30,
            y: 60 + Object.keys(TYPE_LABELS).indexOf(entityType) * 30,
            width: 260,
            closable: true,
            onClose: () => {},
        });

        this._listEl = null;
        this._buildContent();
        this._refresh();

        if (this.bus) {
            this.bus.on('state:changed', () => this._refresh());
        }
    }

    // Proxy for Toolbar toggle wiring
    get el() { return this.window.el; }
    open() { this.window.open(); }
    close() { this.window.close(); }
    toggle() { this.window.toggle(); }
    isOpen() { return this.window.isOpen(); }

    _buildContent() {
        const container = document.createElement('div');

        // Search box
        const searchBox = document.createElement('input');
        searchBox.type = 'text';
        searchBox.placeholder = `Search ${TYPE_LABELS[this.entityType] || this.entityType}...`;
        searchBox.style.cssText = 'width: 100%; margin-bottom: 8px; box-sizing: border-box;';
        searchBox.addEventListener('input', (e) => {
            this._searchQuery = e.target.value.toLowerCase();
            this._refresh();
        });
        // Prevent keyboard shortcuts from firing while typing in search
        searchBox.addEventListener('keydown', (e) => e.stopPropagation());
        container.appendChild(searchBox);

        // Entity list
        this._listEl = document.createElement('div');
        this._listEl.style.cssText = 'max-height: 300px; overflow-y: auto;';
        container.appendChild(this._listEl);

        this.window.setContent(container);
    }

    _refresh() {
        if (!this._listEl) return;
        this._listEl.innerHTML = '';

        const entities = this.state.manifest[this.entityType] || [];
        const filtered = entities.filter(ent => {
            if (!this._searchQuery) return true;
            const name = (ent.name || '').toLowerCase();
            const id = (ent.id || '').toLowerCase();
            return name.includes(this._searchQuery) || id.includes(this._searchQuery);
        });

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color: #555; font-size: 11px; padding: 8px 0;';
            empty.textContent = this._searchQuery ? 'No matches' : 'No entities';
            this._listEl.appendChild(empty);
            return;
        }

        filtered.forEach(ent => {
            this._listEl.appendChild(this._createRow(ent));
        });
    }

    /**
     * @param {object} ent - Entity object with .name, .x, .y, .id
     * @returns {HTMLElement}
     */
    _createRow(ent) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; padding: 4px 0; border-bottom: 1px solid #222; gap: 4px; font-size: 11px;';

        // Icon
        const icon = document.createElement('span');
        icon.style.cssText = 'font-size: 12px; flex-shrink: 0;';
        icon.textContent = TYPE_ICONS[this.entityType] || '\u25CF'; // ●
        row.appendChild(icon);

        // Name + coords
        const label = document.createElement('span');
        label.style.cssText = 'flex: 1; color: #ddd; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        label.textContent = `${ent.name || ent.id} (${ent.x}, ${ent.y})`;
        label.title = `${ent.name || ent.id} at (${ent.x}, ${ent.y})`;
        row.appendChild(label);

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.textContent = '\u270E'; // ✎
        editBtn.title = 'Edit';
        editBtn.style.cssText = 'padding: 1px 5px; background: var(--bg-hover); color: var(--text-muted); border: 1px solid var(--border); border-radius: 3px; cursor: pointer; font-size: 11px; flex-shrink: 0;';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bus.emit('entity:selected', { ...ent, type: this.entityType });
        });
        row.appendChild(editBtn);

        // Locate button
        const locateBtn = document.createElement('button');
        locateBtn.textContent = '\u2316'; // ⌖ (crosshair/reticle)
        locateBtn.title = 'Locate';
        locateBtn.style.cssText = 'padding: 1px 5px; background: var(--bg-hover); color: var(--text-muted); border: 1px solid var(--border); border-radius: 3px; cursor: pointer; font-size: 11px; flex-shrink: 0;';
        locateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bus.emit('viewport:snap', { x: ent.x, y: ent.y });
        });
        row.appendChild(locateBtn);

        return row;
    }
}
