export class PropertyPanel {
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
            // Could add targetX/Y here
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
