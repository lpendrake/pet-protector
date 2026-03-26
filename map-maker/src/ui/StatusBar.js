export class StatusBar {
    constructor(bus) {
        this.bus = bus;
        this.timerEl = document.getElementById('auto-save-timer');
        this.versionEl = document.getElementById('map-version');
        this.lastSaveTime = null;
    }

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

    updateTimer() {
        if (!this.lastSaveTime) {
            this.timerEl.innerText = 'Never';
            return;
        }
        const diff = Math.floor((Date.now() - this.lastSaveTime) / 1000);
        this.timerEl.innerText = `${diff}s ago`;
    }

    updateCoordinates(x, y) {
        this.coordEl.innerText = `Cursor: (${x}, ${y})`;
    }
}
