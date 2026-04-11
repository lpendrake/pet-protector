import { FloatingWindow } from './FloatingWindow.js';
import eraserImg from '../assets/eraser.avif';

/**
 * Floating panel showing a grid of tool buttons.
 * Hover-managed by the Toolbar — opens on mouseenter, closes on mouseleave.
 *
 * Tools can use either an emoji icon or an image asset (img field).
 *
 * Listens to:
 *   'tool:active' → highlight the active tool button
 *
 * Emits:
 *   'tool:changed' → when a tool button is clicked
 */

const TOOLS = [
    { name: 'brush',   icon: '\u{1F58C}\uFE0F', label: 'Brush (B)' },
    { name: 'erase',   img: eraserImg,           label: 'Eraser (E)' },
    { name: 'fill',    icon: '\u{1FAA3}',        label: 'Fill (F)' },
    { name: 'select',  icon: '\u{1F50D}',        label: 'Select (V)' },
    { name: 'spawner', icon: '\u{1F6A9}',        label: 'Spawner (S)' },
    { name: 'warp',    icon: '\u{1F300}',        label: 'Warp (W)' },
    { name: 'zone',    icon: '\u{1F5FA}\uFE0F',  label: 'Zone (Z)' },
];

export class ToolPickerPanel {
    /**
     * @param {EventBus} bus
     * @param {HTMLElement} parent
     */
    constructor(bus, parent) {
        this.bus = bus;

        this.window = new FloatingWindow({
            id: 'tool-picker',
            title: 'Tools',
            parent,
            x: 10,
            y: 60,
            width: 180,
            pinnable: true,
            closable: true,
        });

        this._buttons = new Map();
        this._buildContent();

        if (this.bus) {
            this.bus.on('tool:active', (tool) => this._setActive(tool));
        }
    }

    /** Proxy for Toolbar hybrid wiring */
    get el() { return this.window.el; }
    open() { this.window.open(); }
    close() { this.window.close(); }
    toggle() { this.window.toggle(); }
    isOpen() { return this.window.isOpen(); }
    isPinned() { return this.window.isPinned(); }
    setPosition(x, y) { this.window.setPosition(x, y); }
    set onPinChange(fn) { this.window._onPinChange = fn; }

    _buildContent() {
        const grid = document.createElement('div');
        grid.className = 'tile-grid';

        TOOLS.forEach(({ name, icon, img, label }) => {
            const btn = document.createElement('div');
            btn.className = 'tile-item';
            btn.title = label;
            if (img) {
                const imgEl = document.createElement('img');
                imgEl.src = img;
                imgEl.alt = label;
                imgEl.style.cssText = 'width: 24px; height: 24px; image-rendering: pixelated; pointer-events: none;';
                btn.appendChild(imgEl);
            } else {
                btn.textContent = icon;
            }
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.bus.emit('tool:changed', name);
            });
            this._buttons.set(name, btn);
            grid.appendChild(btn);
        });

        this.window.setContent(grid);
    }

    /** @param {string} tool */
    _setActive(tool) {
        this._buttons.forEach((btn, name) => {
            btn.classList.toggle('active', name === tool);
        });
    }
}
