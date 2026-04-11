import { BrushTool } from './BrushTool.js';
import { EraseTool } from './EraseTool.js';
import { FillTool } from './FillTool.js';
import { SelectTool } from './SelectTool.js';
import { SpawnerTool } from './SpawnerTool.js';
import { WarpTool } from './WarpTool.js';
import { ZoneTool } from './ZoneTool.js';

/**
 * Owns all pointer input and delegates to the currently active tool.
 * Also wires tile/item selection events to configure the brush tool.
 *
 * Listens to:
 *   'tile:selected'       → configures brush + fill with the selected tile
 *   'item:selected'       → configures brush with the selected item
 *   'tool:changed'        → activates the named tool
 *   'erase:layer-changed' → sets the erase tool's target layer
 *
 * Emits:
 *   'tool:active' → after a tool switch, with the new tool name
 */
export class ToolManager {
    /**
     * @param {EventBus|null} bus
     * @param {MapState} state
     * @param {TileDefs|null} [tileDefs=null] - Passed to WarpTool for walkability checks
     */
    constructor(bus, state, tileDefs = null) {
        this.bus = bus;
        this.state = state;
        this.tools = new Map();

        this.tools.set('brush',   new BrushTool(state));
        this.tools.set('erase',   new EraseTool(state));
        this.tools.set('fill',    new FillTool(state, bus));
        this.tools.set('select',  new SelectTool(state, bus));
        this.tools.set('spawner', new SpawnerTool(state));
        this.tools.set('warp',    new WarpTool(state, tileDefs));
        this.tools.set('zone',    new ZoneTool(state));

        this.activeTool = this.tools.get('brush');

        if (this.bus) {
            this.bus.on('tile:selected', (id) => {
                this.tools.get('brush').setConfig({ layer: 'base', value: id });
                this.tools.get('fill').setConfig({ layer: 'base', value: id });
            });
            this.bus.on('item:selected', (id) => {
                this.tools.get('brush').setConfig({ layer: 'pickup', value: id });
            });
            this.bus.on('tool:changed', (name) => this.setTool(name));
            this.bus.on('erase:layer-changed', (layer) => {
                this.tools.get('erase').setConfig({ layer });
            });
        }
    }

    /**
     * Activate a tool by name. Emits 'tool:active' on success.
     * Silent no-op if the name is not registered.
     * @param {string} name - Key in the tools Map (e.g. 'brush', 'erase')
     */
    setTool(name) {
        if (this.tools.has(name)) {
            this.activeTool = this.tools.get(name);
            if (this.bus) this.bus.emit('tool:active', name);
        }
    }

    /** @param {number} tx - Tile X coordinate */
    onPointerDown(tx, ty) {
        this.activeTool.onDown(tx, ty);
    }

    /** @param {number} tx - Tile X coordinate */
    onPointerMove(tx, ty) {
        this.activeTool.onMove(tx, ty);
    }

    onPointerUp() {
        this.activeTool.onUp();
    }

    /**
     * Register each tool's declared keyboard shortcut with a ShortcutManager.
     * Tools with `static shortcut = ''` are skipped. Tools with `static shortcut = null`
     * will cause ShortcutManager to throw (missing declaration).
     * @param {ShortcutManager} shortcutManager
     */
    registerShortcuts(shortcutManager) {
        shortcutManager.registerToolShortcuts(this);
    }
}
