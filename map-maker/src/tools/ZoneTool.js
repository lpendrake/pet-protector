import { Tool } from './BrushTool.js';
import { PaintTileAction } from '../core/Actions.js';

/**
 * Paints a named zone overlay onto tiles by clicking or dragging.
 *
 * Zones are invisible in-game behavioral regions. They do nothing by themselves —
 * they are named, referencable areas that game mechanics bind to. Examples:
 *   - Fishing zone (fish can spawn here for the pet to catch)
 *   - Orchard (apples randomly appear here)
 *   - Creature patrol zone (defines the area a creature paths around)
 *   - Food spawn zone (first planned use: keep the pet fed)
 *
 * The zone ID being painted is stored in `this.config.value` (default: 'active_zone').
 * On first use of a zone ID, a matching entry is created in manifest.zones so the
 * zone has a name and can be referenced by the game engine.
 *
 * // TODO: Needs a zone selector UI in the sidebar so the editor can paint multiple
 *          distinct named zones on the same map. Until then only 'active_zone' is paintable.
 */
export class ZoneTool extends Tool {
    static shortcut = 'z';

    constructor(state) {
        super(state);
        this.config = { value: 'active_zone' };
        this.isDragging = false;
    }

    onDown(tx, ty) {
        this.isDragging = true;
        this.paint(tx, ty);
    }

    onMove(tx, ty) {
        if (this.isDragging) this.paint(tx, ty);
    }

    onUp() {
        this.isDragging = false;
    }

    paint(tx, ty) {
        const oldData = this.state.getTileData(tx, ty);
        if (oldData.zone !== this.config.value) {
            this.state.applyAction(new PaintTileAction(tx, ty, 'zone', this.config.value, oldData.zone));

            // Ensure a zone definition exists in the manifest for this zone ID.
            // The tile layer stores only the ID; the manifest holds the name and properties.
            const zoneId = this.config.value;
            if (!this.state.manifest.zones.find(z => z.id === zoneId)) {
                const zoneNum = this.state.manifest.zones.length + 1;
                this.state.manifest.zones.push({ id: zoneId, name: `Zone ${zoneNum}` });
                this.state.dirty = true;
            }
        }
    }
}
