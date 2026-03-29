/**
 * Displays and edits properties of the currently selected entity (spawn point or warp).
 *
 * Listens to:
 *   'entity:selected' → calls render() with the selected entity (or null to clear)
 *
 * Emits:
 *   'state:changed' → after any field edit or entity deletion, to trigger a redraw
 *
 * Entity mutations (name, targetMap, targetPos) are applied directly to the manifest
 * object in-place, then `state.dirty = true` is set. No Action is created — these
 * edits are not currently undoable.
 */
export class PropertyPanel {
    /**
     * @param {EventBus} bus
     * @param {MapState} state
     */
    constructor(bus, state) {
        this.bus = bus;
        this.state = state;
        this.container = document.getElementById('property-panel');
        this.selectedEntity = null;

        if (this.bus) {
            this.bus.on('entity:selected', (ent) => this.render(ent));
        }
    }

    init() {}

    /**
     * Render the property fields for an entity, or a placeholder if none is selected.
     * For warp entities, also renders Target Map, Target X, and Target Y fields.
     * @param {object|null} ent - Entity from manifest (with `.type`, `.id`, `.name`, `.x`, `.y`)
     */
    render(ent) {
        this.selectedEntity = ent;
        this.container.innerHTML = '';
        
        if (!ent) {
            this.container.innerHTML = '<p style="color: #666;">No entity selected</p>';
            return;
        }

        const createField = (label, value, key) => {
            const div = document.createElement('div');
            div.style.marginBottom = '8px';
            div.innerHTML = `<label style="color: #888;">${label}</label>`;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.onchange = (e) => {
                ent[key] = e.target.value;
                this.state.dirty = true;
                this.bus.emit('state:changed', { type: 'entity:updated', ent });
            };
            div.appendChild(input);
            return div;
        };

        this.container.appendChild(createField('Name', ent.name, 'name'));

        if (ent.type === 'warps') {
            this.container.appendChild(createField('Target Map', ent.targetMap || '', 'targetMap'));

            const createNestedField = (label, obj, key) => {
                const div = document.createElement('div');
                div.style.marginBottom = '8px';
                div.innerHTML = `<label style="color: #888;">${label}</label>`;
                const input = document.createElement('input');
                input.type = 'number';
                input.value = obj[key] ?? 0;
                input.onchange = (e) => {
                    obj[key] = parseInt(e.target.value, 10) || 0;
                    this.state.dirty = true;
                    this.bus.emit('state:changed', { type: 'entity:updated', ent });
                };
                div.appendChild(input);
                return div;
            };

            if (!ent.targetPos) ent.targetPos = { x: 0, y: 0 };
            this.container.appendChild(createNestedField('Target X', ent.targetPos, 'x'));
            this.container.appendChild(createNestedField('Target Y', ent.targetPos, 'y'));
        }

        const delBtn = document.createElement('button');
        delBtn.innerText = 'DELETE ENTITY';
        delBtn.style.cssText = 'width: 100%; padding: 5px; background: #900; color: white; border: none; margin-top: 10px; cursor: pointer;';
        delBtn.onclick = () => {
            this.state.removeEntity(ent.type, ent.id);
            this.render(null);
        };
        this.container.appendChild(delBtn);
    }
}
