import { TILE_COLORS } from '../rendering/TileColors.js';
import { EntityNavigator } from './EntityNavigator.js';
import eraserImg from '../assets/eraser.avif';

/**
 * Compact draggable button bar — the primary entry point to all floating panels.
 *
 * Buttons: Tool | Placeables | Entities | Maps | Save
 *
 * Supports two panel-open patterns:
 *   - Hybrid hover/toggle: when unpinned, panel snaps to toolbar and hover-opens;
 *     when pinned, panel is freely draggable and the button click-toggles it
 *   - Toggle-on-click: panel toggles visibility on click
 *
 * Listens to:
 *   'tool:active'    → update tool button icon
 *   'tile:selected'  → update placeables button appearance
 *   'item:selected'  → update placeables button appearance
 *
 * Emits:
 *   'save:requested' → when the save button is clicked
 */

/**
 * Tool name → icon. String values are emoji text; null means use an image asset.
 * Tools with image assets are handled separately in _updateToolIcon().
 */
const TOOL_ICONS = {
    brush:   '\u{1F58C}\uFE0F', // 🖌️
    erase:   null,               // uses eraserImg asset
    fill:    '\u{1FAA3}',       // 🪣
    select:  '\u{1F50D}',       // 🔍
    spawner: '\u{1F6A9}',       // 🚩
    warp:    '\u{1F300}',       // 🌀
    zone:    '\u{1F5FA}\uFE0F', // 🗺️
};

/** Tool name → image asset URL (for tools that use pixel art instead of emoji) */
const TOOL_IMAGES = {
    erase: eraserImg,
};

export class Toolbar {
    /**
     * @param {EventBus} bus
     * @param {HTMLElement} parent - Container to append to (usually #viewport-container)
     */
    constructor(bus, parent) {
        this.bus = bus;
        this.parent = parent;
        this._activeTool = 'brush';
        this._selectedTileId = null;

        /** @type {Map<string, { panel: object, closeTimer: number|null }>} */
        this._hoverPanels = new Map();
        /** @type {Map<string, object>} */
        this._togglePanels = new Map();
        /** @type {Map<string, EntityNavigator>} */
        this._entityNavigators = new Map();

        // ── Build DOM ──────────────────────────────────────────────────
        this.el = document.createElement('div');
        this.el.className = 'toolbar';
        this.el.style.left = '10px';
        this.el.style.top = '10px';

        // Restore position from localStorage
        this._restorePosition();

        // Tool button
        this._toolBtn = this._createButton('tool', TOOL_ICONS.brush, 'Tools');
        // Placeables button
        this._placeablesBtn = this._createButton('placeables', '\u{1F7E9}', 'Tiles & Items'); // 🟩
        // Entities button
        this._entitiesBtn = this._createButton('entities', '\u{1F4CD}', 'Entities'); // 📍
        // Maps button
        this._mapsBtn = this._createButton('maps', '\u{1F5FA}\uFE0F', 'Maps'); // 🗺️
        // Save button
        this._saveBtn = this._createButton('save', '\u{1F4BE}', 'Save'); // 💾

        this.el.appendChild(this._toolBtn);
        this.el.appendChild(this._placeablesBtn);

        // Entities button with dropdown
        const entitiesWrapper = document.createElement('div');
        entitiesWrapper.style.cssText = 'position: relative; display: flex;';
        entitiesWrapper.appendChild(this._entitiesBtn);
        this._entitiesDropdown = this._buildEntitiesDropdown();
        entitiesWrapper.appendChild(this._entitiesDropdown);
        this._wireEntitiesHover(this._entitiesBtn, this._entitiesDropdown);
        this.el.appendChild(entitiesWrapper);

        this.el.appendChild(this._mapsBtn);
        this.el.appendChild(this._saveBtn);

        // ── Dragging ───────────────────────────────────────────────────
        this._dragOffset = { x: 0, y: 0 };
        this._isDragging = false;
        this._onDragStart = this._onDragStart.bind(this);
        this._onDragMove = this._onDragMove.bind(this);
        this._onDragEnd = this._onDragEnd.bind(this);
        this.el.addEventListener('mousedown', this._onDragStart);

        // Prevent clicks from reaching canvas
        this.el.addEventListener('pointerdown', (e) => e.stopPropagation());

        // ── Save button ────────────────────────────────────────────────
        this._saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bus.emit('save:requested');
        });

        // ── Bus listeners ──────────────────────────────────────────────
        if (this.bus) {
            this.bus.on('tool:active', (tool) => {
                this._activeTool = tool;
                this._updateToolIcon(tool);
            });
            this.bus.on('tile:selected', (tileId) => {
                this._selectedTileId = tileId;
                this._updatePlaceablesIcon();
            });
            this.bus.on('item:selected', () => {
                this._selectedTileId = null;
                this._placeablesBtn.textContent = '\u{1F4E6}'; // 📦
            });
        }

        // ── Append ─────────────────────────────────────────────────────
        this.parent.appendChild(this.el);
    }

    // ── Panel wiring ────────────────────────────────────────────────────

    /**
     * Wire a panel with hybrid hover/toggle behaviour.
     *
     * **Unpinned** — panel snaps adjacent to the toolbar button and uses hover-to-open
     * with a 200ms close delay (the original behaviour).
     *
     * **Pinned** — panel is freely draggable and the button becomes a click toggle.
     * Hover listeners are still attached but short-circuited when pinned.
     *
     * When the user toggles the pin, we switch modes on the fly via onPinChange.
     *
     * @param {string} buttonName - 'tool' or 'placeables'
     * @param {object} panel - Object with open/close/toggle/isOpen/isPinned/setPosition/onPinChange and `el`
     */
    wireHoverPanel(buttonName, panel) {
        const btn = this._getButton(buttonName);
        if (!btn) return;

        const state = { panel, closeTimer: null };
        this._hoverPanels.set(buttonName, state);

        const cancelClose = () => {
            if (state.closeTimer !== null) {
                clearTimeout(state.closeTimer);
                state.closeTimer = null;
            }
        };

        const scheduleClose = () => {
            cancelClose();
            state.closeTimer = setTimeout(() => {
                panel.close();
                state.closeTimer = null;
            }, 200);
        };

        /** Snap panel position adjacent to the toolbar (below the button). */
        const snapToButton = () => {
            const tbRect = this.el.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();
            const parentRect = this.parent.getBoundingClientRect();
            // Align left edge with button, place just below the toolbar
            const x = btnRect.left - parentRect.left;
            const y = tbRect.bottom - parentRect.top + 4;
            panel.setPosition(x, y);
        };

        // ── Hover listeners (active when unpinned) ────────────────────
        btn.addEventListener('mouseenter', () => {
            if (panel.isPinned()) return;
            cancelClose();
            if (!panel.isOpen()) {
                snapToButton();
                panel.open();
            }
        });
        btn.addEventListener('mouseleave', () => {
            if (panel.isPinned()) return;
            scheduleClose();
        });

        panel.el.addEventListener('mouseenter', () => {
            if (panel.isPinned()) return;
            cancelClose();
        });
        panel.el.addEventListener('mouseleave', () => {
            if (panel.isPinned()) return;
            scheduleClose();
        });

        // ── Click listener (active when pinned) ───────────────────────
        btn.addEventListener('click', (e) => {
            if (!panel.isPinned()) return;
            e.stopPropagation();
            panel.toggle();
        });

        // ── Pin-change callback — switch modes on the fly ─────────────
        panel.onPinChange = (pinned) => {
            if (!pinned) {
                // Returned to unpinned: snap back to button
                snapToButton();
            }
        };
    }

    /**
     * Wire a panel to toggle on click of a toolbar button.
     * @param {string} buttonName - 'entities', 'maps'
     * @param {object} panel - Object with toggle()
     */
    wireTogglePanel(buttonName, panel) {
        const btn = this._getButton(buttonName);
        if (!btn) return;

        this._togglePanels.set(buttonName, panel);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.toggle();
        });
    }

    // ── Entities dropdown ─────────────────────────────────────────────────

    /**
     * Wire the entities dropdown for use — requires state and parent refs.
     * Call once from main.js after construction.
     * @param {MapState} state
     */
    setEntityState(state) {
        this._entityState = state;
    }

    _buildEntitiesDropdown() {
        const dropdown = document.createElement('div');
        dropdown.style.cssText = `
            position: absolute; left: 50%; transform: translateX(-50%);
            background: rgba(26, 26, 29, 0.95); backdrop-filter: blur(8px);
            border: 1px solid var(--border); border-radius: 6px;
            padding: 4px; display: none;
            flex-direction: column; gap: 2px; min-width: 100px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5); z-index: 400;
        `;

        const types = [
            { key: 'warps',       label: '\u{1F300} Warps' },
            { key: 'spawnPoints', label: '\u{1F6A9} Spawners' },
            { key: 'zones',      label: '\u{1F5FA}\uFE0F Zones' },
        ];

        types.forEach(({ key, label }) => {
            const item = document.createElement('button');
            item.textContent = label;
            item.style.cssText = `
                display: block; width: 100%; padding: 5px 10px; text-align: left;
                background: transparent; color: var(--text); border: none;
                border-radius: 4px; cursor: pointer; font-size: 11px; white-space: nowrap;
            `;
            item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-hover)'; });
            item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleEntityNavigator(key);
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(item);
        });

        return dropdown;
    }

    _wireEntitiesHover(btn, dropdown) {
        let closeTimer = null;
        const cancel = () => { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } };
        const schedule = () => { cancel(); closeTimer = setTimeout(() => { dropdown.style.display = 'none'; }, 200); };

        const showDropdown = () => {
            cancel();
            dropdown.style.display = 'flex';
            // Flip direction: default is above (bottom: 100%), flip below if no room
            const tbRect = this.el.getBoundingClientRect();
            const ddHeight = dropdown.offsetHeight;
            if (tbRect.top < ddHeight + 10) {
                // Not enough room above — show below
                dropdown.style.bottom = '';
                dropdown.style.top = '100%';
                dropdown.style.marginBottom = '';
                dropdown.style.marginTop = '6px';
            } else {
                // Enough room above — default position
                dropdown.style.top = '';
                dropdown.style.bottom = '100%';
                dropdown.style.marginTop = '';
                dropdown.style.marginBottom = '6px';
            }
        };

        btn.addEventListener('mouseenter', showDropdown);
        btn.addEventListener('mouseleave', schedule);
        dropdown.addEventListener('mouseenter', cancel);
        dropdown.addEventListener('mouseleave', schedule);
    }

    /** @param {string} entityType */
    _toggleEntityNavigator(entityType) {
        const existing = this._entityNavigators.get(entityType);
        if (existing) {
            existing.toggle();
            return;
        }
        if (!this._entityState) {
            console.warn('Toolbar: setEntityState() not called, cannot open EntityNavigator');
            return;
        }
        const nav = new EntityNavigator(this.bus, this._entityState, this.parent, entityType);
        this._entityNavigators.set(entityType, nav);
        nav.open();
    }

    // ── Private helpers ─────────────────────────────────────────────────

    /**
     * @param {string} name
     * @param {string} icon - Emoji text
     * @param {string} title - Tooltip
     * @returns {HTMLElement}
     */
    _createButton(name, icon, title) {
        const btn = document.createElement('button');
        btn.className = 'toolbar-btn';
        btn.dataset.name = name;
        btn.title = title;
        btn.textContent = icon;
        return btn;
    }

    /** @param {string} name */
    _getButton(name) {
        return this.el.querySelector(`[data-name="${name}"]`);
    }

    /** Update the tool button to show the active tool's icon (emoji or image). */
    _updateToolIcon(tool) {
        const imgSrc = TOOL_IMAGES[tool];
        if (imgSrc) {
            this._toolBtn.textContent = '';
            // Reuse existing img or create one
            let img = this._toolBtn.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.style.cssText = 'width: 22px; height: 22px; image-rendering: pixelated; pointer-events: none;';
                this._toolBtn.appendChild(img);
            }
            img.src = imgSrc;
            img.alt = tool;
        } else {
            // Remove any existing img and set emoji text
            const existing = this._toolBtn.querySelector('img');
            if (existing) existing.remove();
            this._toolBtn.textContent = TOOL_ICONS[tool] || '\u{1F58C}\uFE0F';
        }
    }

    _updatePlaceablesIcon() {
        if (this._selectedTileId) {
            const hexNum = TILE_COLORS[this._selectedTileId] ?? 0x555555;
            const bg = '#' + hexNum.toString(16).padStart(6, '0');
            this._placeablesBtn.textContent = '';
            this._placeablesBtn.style.backgroundColor = bg;
        } else {
            this._placeablesBtn.style.backgroundColor = '';
            this._placeablesBtn.textContent = '\u{1F7E9}'; // 🟩
        }
    }

    // ── Drag ────────────────────────────────────────────────────────────

    /** @param {MouseEvent} e */
    _onDragStart(e) {
        // Only drag on left button, ignore clicks on buttons
        if (e.button !== 0) return;
        if (e.target.closest('.toolbar-btn')) return;

        this._isDragging = true;
        this._dragOffset.x = e.clientX - this.el.offsetLeft;
        this._dragOffset.y = e.clientY - this.el.offsetTop;
        this.el.classList.add('toolbar-dragging');

        window.addEventListener('mousemove', this._onDragMove);
        window.addEventListener('mouseup', this._onDragEnd);

        e.preventDefault();
        e.stopPropagation();
    }

    /** @param {MouseEvent} e */
    _onDragMove(e) {
        if (!this._isDragging) return;
        const parentRect = this.parent.getBoundingClientRect();
        const x = Math.max(0, Math.min(parentRect.width - this.el.offsetWidth, e.clientX - this._dragOffset.x));
        const y = Math.max(0, Math.min(parentRect.height - this.el.offsetHeight, e.clientY - this._dragOffset.y));
        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;
    }

    _onDragEnd() {
        if (!this._isDragging) return;
        this._isDragging = false;
        this.el.classList.remove('toolbar-dragging');
        window.removeEventListener('mousemove', this._onDragMove);
        window.removeEventListener('mouseup', this._onDragEnd);
        this._savePosition();
    }

    // ── localStorage ────────────────────────────────────────────────────

    _savePosition() {
        try {
            localStorage.setItem('toolbar-pos', JSON.stringify({
                x: parseInt(this.el.style.left, 10) || 10,
                y: parseInt(this.el.style.top, 10) || 10,
            }));
        } catch { /* silent */ }
    }

    _restorePosition() {
        try {
            const raw = localStorage.getItem('toolbar-pos');
            if (!raw) return;
            const { x, y } = JSON.parse(raw);
            if (typeof x === 'number') this.el.style.left = `${x}px`;
            if (typeof y === 'number') this.el.style.top = `${y}px`;
        } catch { /* silent */ }
    }
}
