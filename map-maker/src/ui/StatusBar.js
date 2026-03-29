/**
 * Updates the status bar at the bottom of the editor.
 * Displays time since last save, current map version, and cursor tile coordinates.
 *
 * Listens to:
 *   'save:completed' → updates lastSaveTime and version display
 *   'cursor:moved'   → updates the tile coordinate display
 */
export class StatusBar {
    /** @param {EventBus} bus */
    constructor(bus) {
        this.bus = bus;
        this.timerEl = document.getElementById('auto-save-timer');
        this.versionEl = document.getElementById('map-version');
        this.lastSaveTime = null;
    }

    /** Wire event listeners and start the 1-second save-timer tick. Call once after DOM is ready. */
    init() {
        if (this.bus) {
            this.bus.on('save:completed', (data) => {
                this.lastSaveTime = Date.now();
                this.versionEl.innerText = data.version || '0';
                this.updateTimer();
            });

            this.bus.on('cursor:moved', (pos) => {
                this.updateCoordinates(pos.tx, pos.ty);
            });
        }

        setInterval(() => this.updateTimer(), 1000);

        this.coordEl = document.getElementById('cursor-coords');
    }

    /** Refresh the "X ago" label. Shows 'Never' if no save has occurred this session. */
    updateTimer() {
        if (!this.lastSaveTime) {
            this.timerEl.innerText = 'Never';
            return;
        }
        const diff = Math.floor((Date.now() - this.lastSaveTime) / 1000);
        this.timerEl.innerText = `${diff}s ago`;
    }

    /**
     * @param {number} x - Tile X
     * @param {number} y - Tile Y
     */
    updateCoordinates(x, y) {
        this.coordEl.innerText = `Cursor: (${x}, ${y})`;
    }
}
