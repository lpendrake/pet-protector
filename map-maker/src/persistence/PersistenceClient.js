export class PersistenceClient {
    constructor(bus, state, serverUrl) {
        this.bus = bus;
        this.state = state;
        this.serverUrl = serverUrl;
        this.autoSaveInterval = null;
        
        if (this.bus) {
            this.bus.on('save:requested', () => this.saveMaster());
        }
    }

    async createMap(name) {
        const response = await fetch(`${this.serverUrl}/api/create-map`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        this.state.mapName = name;
        this.state.chunks = new Map();
        this.state.manifest = { version: 0, spawnPoints: [], zones: [], warps: [] };
        this.state.dirty = false;
        if (this.bus) this.bus.emit('map:created', { name });
        return data;
    }

    async loadMap(name) {
        const response = await fetch(`${this.serverUrl}/api/load-map/${name}`);
        const data = await response.json();
        this.state.deserialize(data);
        if (this.bus) this.bus.emit('map:loaded', { name });
    }

    async autoSave() {
        if (!this.state.dirty) return;
        
        const payload = this.state.serialize();
        try {
            const response = await fetch(`${this.serverUrl}/api/auto-save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            this.state.dirty = false;
            if (this.bus) this.bus.emit('save:completed', { version: data.version, type: 'auto' });
        } catch (err) {
            console.error('Auto-save failed:', err);
        }
    }

    async saveMaster() {
        const payload = this.state.serialize();
        try {
            const response = await fetch(`${this.serverUrl}/api/save-master`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
                this.state.dirty = false;
                if (this.bus) this.bus.emit('save:completed', { version: data.version, type: 'master' });
            } else {
                console.error('Master save server error:', data.error);
                alert(`Save failed: ${data.error}`);
            }
        } catch (err) {
            console.error('Master save failed:', err);
            alert('Save failed: Server error or file lock. Check console for details.');
        }
    }

    startAutoSave(intervalMs = 5000) {
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = setInterval(() => this.autoSave(), intervalMs);
    }

    async listMaps() {
        const response = await fetch(`${this.serverUrl}/api/maps`);
        return await response.json();
    }
}
