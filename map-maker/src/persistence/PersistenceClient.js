/**
 * HTTP client for the Express map server.
 *
 * Save architecture:
 *   - autoSave() → /api/auto-save → writes to `<mapName>_tmp/` (in-progress edits)
 *   - saveMaster() → /api/save-master → atomically promotes tmp to master (versioned)
 *   - deployMap()  → /api/deploy    → copies master to web/maps/ for the game to read
 *
 * Listens to:
 *   'save:requested' → triggers saveMaster()
 *
 * Emits:
 *   'save:completed' ({ version, type: 'auto'|'master' }) → on successful save
 *   'map:created'    ({ name }) → after createMap()
 *   'map:loaded'     ({ name }) → after loadMap()
 */
export class PersistenceClient {
    /**
     * @param {EventBus} bus
     * @param {MapState} state
     * @param {string} serverUrl - Base URL for the map server (e.g. 'http://localhost:3001')
     */
    constructor(bus, state, serverUrl) {
        this.bus = bus;
        this.state = state;
        this.serverUrl = serverUrl;
        this.autoSaveInterval = null;

        if (this.bus) {
            this.bus.on('save:requested', () => this.saveMaster());
        }
    }

    /**
     * Create a new empty map on the server and reset the local state to match.
     * Does NOT call state.deserialize — sets chunks and manifest directly.
     * @param {string} name
     */
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

    /**
     * Load a map from the server into the local state.
     * Server prefers _tmp (active edits) over master.
     * @param {string} name
     */
    async loadMap(name) {
        const response = await fetch(`${this.serverUrl}/api/load-map/${name}`);
        const data = await response.json();
        this.state.deserialize(data);
        if (this.bus) this.bus.emit('map:loaded', { name });
    }

    /**
     * Save the current state to the _tmp directory (in-progress checkpoint).
     * Silent no-op if the state is not dirty. Does not bump the manifest version.
     */
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

    /**
     * Promote the current state to the master directory via the server's atomic save logic.
     * On success the server bumps the version number and returns it.
     * On failure emits 'save:error' so SidebarUI can show a toast.
     */
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
                if (this.bus) this.bus.emit('save:error', { message: `Save failed: ${data.error}` });
            }
        } catch (err) {
            console.error('Master save failed:', err);
            if (this.bus) this.bus.emit('save:error', { message: 'Save failed: server unreachable or file lock. Check console.' });
        }
    }

    /**
     * Start polling autoSave every `intervalMs` milliseconds (default: 5s).
     * Replaces any existing interval — safe to call multiple times.
     * @param {number} [intervalMs=5000]
     */
    startAutoSave(intervalMs = 5000) {
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = setInterval(() => this.autoSave(), intervalMs);
    }

    /**
     * Fetch metadata for all maps from the server (name, version, deployedVersion).
     * @returns {Promise<Array<{ name: string, version: number, deployedVersion: number|null }>>}
     */
    async listMaps() {
        const response = await fetch(`${this.serverUrl}/api/maps`);
        return await response.json();
    }

    /**
     * Copy the master save for `name` to the game's web/maps directory.
     * Throws if the server returns a non-OK status.
     * @param {string} name
     */
    async deployMap(name) {
        const response = await fetch(`${this.serverUrl}/api/deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        return await response.json();
    }
}
