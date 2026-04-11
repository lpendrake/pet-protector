import { FloatingWindow } from './FloatingWindow.js';
import { PaintTileAction, RemoveEntityAction } from '../core/Actions.js';

/**
 * Factory for floating property-editor windows.
 * Creates pinnable FloatingWindow instances for inspecting tiles and editing entities.
 *
 * Supports multiple simultaneous windows via pinning:
 *   - Unpinned window is reused when a new entity/tile is selected
 *   - Pinned windows are preserved; a new window is created instead
 *
 * Also creates a temporary "Erase Target" window when the erase tool is active.
 *
 * Listens to:
 *   'entity:selected'     → opens/reuses a property window for the entity
 *   'tile:inspected'      → opens/reuses a property window for the tile
 *   'tool:active'         → manages erase picker window lifecycle
 *
 * Emits:
 *   'erase:layer-changed' → when user picks a layer in the erase picker
 *   'state:changed'       → after any field edit or deletion
 */

/** Maps entity type → tile layer that stores a reference to it. */
const ENTITY_TILE_LAYER = {
    warps: 'warp',
};

export class PropertyPanel {
    /**
     * @param {EventBus} bus
     * @param {MapState} state
     * @param {HTMLElement} parent - Container to append windows to (usually #viewport-container)
     */
    constructor(bus, state, parent) {
        this.bus = bus;
        this.state = state;
        this.parent = parent || document.getElementById('viewport-container');

        /** @type {Map<string, FloatingWindow>} Open property windows keyed by target ID */
        this._windows = new Map();

        /** @type {FloatingWindow|null} The erase picker window (auto-closes on tool change) */
        this._eraseWindow = null;

        /** Counter for staggering new window positions */
        this._windowOffset = 0;

        if (this.bus) {
            this.bus.on('entity:selected', (ent) => {
                this._openEntityEditor(ent);
            });
            this.bus.on('tile:inspected', (data) => {
                this._openTileInspector(data);
            });
            this.bus.on('tool:active', (tool) => {
                if (tool === 'erase') {
                    this._openErasePicker();
                } else if (this._eraseWindow) {
                    this._eraseWindow.close();
                    this._eraseWindow.destroy();
                    this._eraseWindow = null;
                }
            });
        }
    }

    init() {}

    // ── Window management ───────────────────────────────────────────────

    /**
     * Find or create a property window for the given key.
     * @param {string} key - Unique ID for this target
     * @param {string} title - Window title
     * @returns {FloatingWindow}
     */
    _getOrCreateWindow(key, title) {
        // 1. Existing window for this exact target → bring to front
        const existing = this._windows.get(key);
        if (existing) {
            existing.bringToFront();
            return existing;
        }

        // 2. Find an unpinned window to reuse
        for (const [existingKey, win] of this._windows) {
            if (!win.isPinned()) {
                // Reuse it: remove old key, re-key with new target
                this._windows.delete(existingKey);
                this._windows.set(key, win);
                win.setTitle(title);
                win.bringToFront();
                return win;
            }
        }

        // 3. All windows are pinned (or none exist) → create new
        this._windowOffset = (this._windowOffset + 1) % 8;
        const win = new FloatingWindow({
            id: `prop-${key}`,
            title,
            parent: this.parent,
            x: 350 + this._windowOffset * 20,
            y: 80 + this._windowOffset * 20,
            width: 240,
            pinnable: true,
            closable: true,
            onClose: () => {
                this._windows.delete(key);
            },
        });
        this._windows.set(key, win);
        return win;
    }

    // ── Entity editor ───────────────────────────────────────────────────

    /** @param {object} ent - Entity with .type, .id, .name, .x, .y */
    _openEntityEditor(ent) {
        if (!ent) return;
        const key = `entity-${ent.type}-${ent.id}`;
        const win = this._getOrCreateWindow(key, `${ent.name || ent.id}`);

        const container = document.createElement('div');
        container.style.fontSize = '11px';

        container.appendChild(this._textField('Name', ent.name, v => { ent.name = v; this._entityChanged(ent); }));

        if (ent.type === 'warps') {
            container.appendChild(this._textField('Target Map', ent.targetMap ?? '', v => { ent.targetMap = v; this._entityChanged(ent); }));
            if (!ent.targetPos) ent.targetPos = { x: 0, y: 0 };
            container.appendChild(this._numberField('Target X', ent.targetPos.x, v => { ent.targetPos.x = v; this._entityChanged(ent); }));
            container.appendChild(this._numberField('Target Y', ent.targetPos.y, v => { ent.targetPos.y = v; this._entityChanged(ent); }));
        }

        // Coordinates (read-only info)
        const coordInfo = document.createElement('div');
        coordInfo.style.cssText = 'color: #555; font-size: 10px; margin-top: 6px;';
        coordInfo.textContent = `Position: (${ent.x}, ${ent.y})`;
        container.appendChild(coordInfo);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'DELETE ENTITY';
        delBtn.style.cssText = 'width: 100%; padding: 5px; background: #900; color: white; border: none; margin-top: 10px; cursor: pointer; border-radius: 4px;';
        delBtn.addEventListener('click', () => {
            this.state.applyAction(new RemoveEntityAction(ent.type, ent));
            win.close();
            win.destroy();
            this._windows.delete(key);
        });
        container.appendChild(delBtn);

        win.setContent(container);
        if (!win.isOpen()) win.open();
    }

    // ── Tile inspector ──────────────────────────────────────────────────

    /** @param {{ tx: number, ty: number, tileData: object, entities: Array }} data */
    _openTileInspector({ tx, ty, tileData, entities }) {
        const key = `tile-${tx}-${ty}`;
        const win = this._getOrCreateWindow(key, `Tile (${tx}, ${ty})`);

        const container = document.createElement('div');
        container.style.fontSize = '11px';

        // Tile layers
        const simpleLayers = ['base', 'decoration', 'pickup'];
        simpleLayers.forEach(layer => {
            const value = tileData[layer];
            if (!value && layer !== 'base') return;

            const canDelete = layer !== 'base' && value != null;
            const row = this._layerRow(
                layer,
                value,
                canDelete ? () => {
                    const target = layer === 'base' ? 'empty' : null;
                    this.state.applyAction(new PaintTileAction(tx, ty, layer, target, value));
                    this._refreshTileInspector(win, key, tx, ty);
                } : null
            );
            container.appendChild(row);
        });

        // Entities at this coordinate
        if (entities.length > 0) {
            const sep = document.createElement('div');
            sep.style.cssText = 'border-top: 1px solid #333; margin: 8px 0 6px; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;';
            sep.textContent = 'Entities';
            container.appendChild(sep);

            entities.forEach(ent => {
                container.appendChild(this._entityRow(ent, tx, ty, win, key));
            });
        }

        win.setContent(container);
        if (!win.isOpen()) win.open();
    }

    /** Re-render tile inspector after a change (e.g. layer delete). */
    _refreshTileInspector(win, key, tx, ty) {
        const tileData = this.state.getTileData(tx, ty);
        const entities = [];
        for (const [type, value] of Object.entries(this.state.manifest)) {
            if (Array.isArray(value)) {
                value.filter(e => e.x === tx && e.y === ty)
                     .forEach(e => entities.push({ ...e, _type: type }));
            }
        }
        // Re-render content in the same window
        this._openTileInspector({ tx, ty, tileData, entities });
    }

    // ── Erase layer picker ──────────────────────────────────────────────

    _openErasePicker() {
        if (this._eraseWindow) {
            this._eraseWindow.bringToFront();
            return;
        }

        this._eraseWindow = new FloatingWindow({
            id: 'erase-target',
            title: 'Erase Target',
            parent: this.parent,
            x: 10,
            y: 200,
            width: 180,
            pinnable: false,
            closable: true,
            onClose: () => { this._eraseWindow = null; },
        });

        const container = document.createElement('div');

        const label = document.createElement('div');
        label.style.cssText = 'color: #888; margin-bottom: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;';
        label.textContent = 'Target layer';
        container.appendChild(label);

        const layers = [
            { key: 'base',        label: 'Base / Terrain' },
            { key: 'decoration',  label: 'Decoration' },
            { key: 'pickup',      label: 'Pickup / Item' },
            { key: 'warp',        label: 'Warp' },
        ];

        layers.forEach(({ key, label }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.dataset.layer = key;
            btn.style.cssText = 'display: block; width: 100%; padding: 6px 8px; margin-bottom: 4px; background: var(--bg-hover); color: var(--text); border: 2px solid transparent; border-radius: 4px; cursor: pointer; text-align: left; font-size: 11px;';
            btn.addEventListener('click', () => {
                container.querySelectorAll('button[data-layer]').forEach(b => {
                    b.style.borderColor = 'transparent';
                });
                btn.style.borderColor = 'var(--accent)';
                this.bus.emit('erase:layer-changed', key);
            });
            container.appendChild(btn);
        });

        this._eraseWindow.setContent(container);
        this._eraseWindow.open();
    }

    // ── Shared rendering helpers ────────────────────────────────────────

    _layerRow(layer, value, onDelete) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; padding: 4px 0; border-bottom: 1px solid #222;';

        const lbl = document.createElement('span');
        lbl.style.cssText = 'color: #666; font-size: 10px; width: 70px; flex-shrink: 0;';
        lbl.textContent = layer + ':';

        const val = document.createElement('span');
        val.style.cssText = 'color: #ddd; font-size: 10px; flex: 1; padding: 0 4px;';
        val.textContent = value ?? '\u2014'; // —

        row.appendChild(lbl);
        row.appendChild(val);

        if (onDelete) {
            const del = document.createElement('button');
            del.textContent = '\u00D7'; // ×
            del.title = `Clear ${layer}`;
            del.style.cssText = 'padding: 1px 6px; background: #400; color: #f88; border: 1px solid #600; border-radius: 3px; cursor: pointer; font-size: 12px; flex-shrink: 0;';
            del.addEventListener('click', onDelete);
            row.appendChild(del);
        }

        return row;
    }

    _entityRow(ent, tx, ty, win, key) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'border-bottom: 1px solid #222; padding: 4px 0;';

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; cursor: pointer; gap: 4px;';

        const icon = document.createElement('span');
        icon.style.cssText = 'font-size: 12px;';
        icon.textContent = this._entityIcon(ent._type);

        const name = document.createElement('span');
        name.style.cssText = 'color: #ddd; font-size: 11px; flex: 1;';
        name.textContent = ent.name;

        const del = document.createElement('button');
        del.textContent = '\u00D7'; // ×
        del.style.cssText = 'padding: 1px 6px; background: #400; color: #f88; border: 1px solid #600; border-radius: 3px; cursor: pointer; font-size: 12px;';
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            this._deleteEntity(ent, tx, ty);
            this._refreshTileInspector(win, key, tx, ty);
        });

        header.appendChild(icon);
        header.appendChild(name);
        header.appendChild(del);

        // Expandable fields
        const fields = document.createElement('div');
        fields.style.cssText = 'display: none; padding-top: 6px;';
        this._buildEntityFields(ent, fields);

        header.addEventListener('click', () => {
            fields.style.display = fields.style.display === 'none' ? 'block' : 'none';
        });

        wrapper.appendChild(header);
        wrapper.appendChild(fields);
        return wrapper;
    }

    _buildEntityFields(ent, container) {
        container.appendChild(this._textField('Name', ent.name, v => { ent.name = v; this._entityChanged(ent); }));

        if (ent._type === 'warps') {
            container.appendChild(this._textField('Target Map', ent.targetMap ?? '', v => { ent.targetMap = v; this._entityChanged(ent); }));
            if (!ent.targetPos) ent.targetPos = { x: 0, y: 0 };
            container.appendChild(this._numberField('Target X', ent.targetPos.x, v => { ent.targetPos.x = v; this._entityChanged(ent); }));
            container.appendChild(this._numberField('Target Y', ent.targetPos.y, v => { ent.targetPos.y = v; this._entityChanged(ent); }));
        }
    }

    _entityChanged(ent) {
        this.state.dirty = true;
        this.bus.emit('state:changed', { type: 'entity:updated', ent });
    }

    _deleteEntity(ent, tx, ty) {
        const { _type, ...entityData } = ent;
        const tileLayer = ENTITY_TILE_LAYER[_type];
        if (tileLayer) {
            const oldData = this.state.getTileData(tx, ty);
            if (oldData[tileLayer] === entityData.id) {
                this.state.applyAction(new PaintTileAction(tx, ty, tileLayer, null, entityData.id));
            }
        }
        this.state.applyAction(new RemoveEntityAction(_type, entityData));
    }

    _entityIcon(type) {
        const icons = { spawnPoints: '\u{1F6A9}', warps: '\u{1F300}' };
        return icons[type] ?? '\u25CF'; // ●
    }

    // ── Field builders ──────────────────────────────────────────────────

    _textField(label, value, onChange) {
        const div = document.createElement('div');
        div.style.marginBottom = '8px';
        const lbl = document.createElement('label');
        lbl.style.cssText = 'color: #888; font-size: 10px; display: block;';
        lbl.textContent = label;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.addEventListener('change', (e) => onChange(e.target.value));
        input.addEventListener('keydown', (e) => e.stopPropagation());
        div.appendChild(lbl);
        div.appendChild(input);
        return div;
    }

    _numberField(label, value, onChange) {
        const div = document.createElement('div');
        div.style.marginBottom = '8px';
        const lbl = document.createElement('label');
        lbl.style.cssText = 'color: #888; font-size: 10px; display: block;';
        lbl.textContent = label;
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value ?? 0;
        input.addEventListener('change', (e) => onChange(parseInt(e.target.value, 10) || 0));
        input.addEventListener('keydown', (e) => e.stopPropagation());
        div.appendChild(lbl);
        div.appendChild(input);
        return div;
    }
}
