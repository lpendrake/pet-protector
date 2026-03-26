export class Viewport {
    constructor(renderer) {
        this.renderer = renderer;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };
    }

    init(canvas) {
        canvas.addEventListener('wheel', (e) => this.onWheel(e));
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', () => this.onMouseUp());
    }

    onWheel(e) {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom(delta, e.offsetX, e.offsetY);
    }

    zoom(delta, mouseX, mouseY) {
        // Zoom relative to mouse position
        const worldPos = this.screenToWorld(mouseX, mouseY);
        this.scale *= delta;
        this.scale = Math.max(0.1, Math.min(10, this.scale));
        
        const newScreenPos = this.worldToScreen(worldPos.x, worldPos.y);
        this.offset.x += mouseX - newScreenPos.x;
        this.offset.y += mouseY - newScreenPos.y;
        
        this.apply();
    }

    onMouseDown(e) {
        if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+Left
            this.isPanning = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        }
    }

    onMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.offset.x += dx;
            this.offset.y += dy;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.apply();
        }
    }

    onMouseUp() {
        this.isPanning = false;
    }

    apply() {
        this.renderer.app.stage.scale.set(this.scale);
        this.renderer.app.stage.position.set(this.offset.x, this.offset.y);
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.offset.x) / this.scale,
            y: (sy - this.offset.y) / this.scale
        };
    }

    worldToScreen(wx, wy) {
        return {
            x: wx * this.scale + this.offset.x,
            y: wy * this.scale + this.offset.y
        };
    }
}
