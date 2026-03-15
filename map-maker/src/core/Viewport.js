export class Viewport {
    constructor(renderer) {
        this.renderer = renderer;
        this.app = renderer.app;
        this.world = renderer.world;

        this.zoom = 1;
        this.isPanning = false;
        this.lastPos = { x: 0, y: 0 };

        this._setupEvents();
    }

    _setupEvents() {
        const view = this.app.view;

        view.addEventListener('wheel', (e) => {
            e.preventDefault();
            const scale = e.deltaY > 0 ? 0.9 : 1.1;
            this.world.scale.x *= scale;
            this.world.scale.y *= scale;
        });

        view.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+Left
                this.isPanning = true;
                this.lastPos = { x: e.clientX, y: e.clientY };
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.lastPos.x;
                const dy = e.clientY - this.lastPos.y;
                this.world.x += dx;
                this.world.y += dy;
                this.lastPos = { x: e.clientX, y: e.clientY };
            }
        });

        window.addEventListener('mouseup', () => {
            this.isPanning = false;
        });
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.world.x) / this.world.scale.x,
            y: (sy - this.world.y) / this.world.scale.y
        };
    }
}
