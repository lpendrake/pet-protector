import { BrushTool } from './BrushTool.js';
import { EraseTool } from './EraseTool.js';
import { FillTool } from './FillTool.js';
import { SpawnerTool } from './SpawnerTool.js';
import { WarpTool } from './WarpTool.js';
import { ZoneTool } from './ZoneTool.js';

export class ToolManager {
    constructor(bus, state) {
        this.bus = bus;
        this.state = state;
        this.tools = new Map();
        
        // Register default tools
        this.tools.set('brush', new BrushTool(state));
        this.tools.set('erase', new EraseTool(state));
        this.tools.set('fill', new FillTool(state, bus));
        this.tools.set('spawner', new SpawnerTool(state));
        this.tools.set('warp', new WarpTool(state));
        this.tools.set('zone', new ZoneTool(state));
        
        this.activeTool = this.tools.get('brush');
        
        if (this.bus) {
            this.bus.on('tile:selected', (id) => {
                this.setTool('brush');
                this.activeTool.setConfig({ layer: 'base', value: id });
            });
            this.bus.on('item:selected', (id) => {
                this.setTool('brush');
                this.activeTool.setConfig({ layer: 'pickup', value: id });
            });
            this.bus.on('tool:changed', (name) => this.setTool(name));
        }
    }

    setTool(name) {
        if (this.tools.has(name)) {
            this.activeTool = this.tools.get(name);
            if (this.bus) this.bus.emit('tool:active', name);
        }
    }

    onPointerDown(tx, ty) {
        this.activeTool.onDown(tx, ty);
    }

    onPointerMove(tx, ty) {
        this.activeTool.onMove(tx, ty);
    }

    onPointerUp() {
        this.activeTool.onUp();
    }
}
