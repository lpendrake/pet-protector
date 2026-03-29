/**
 * Pan and zoom controller for the PIXI stage.
 *
 * Pan:  middle-click drag, or Alt+left-click drag
 * Zoom: scroll wheel, clamped to [0.1, 10]
 *
 * Applies transforms directly to renderer.app.stage — the renderer
 * does not need to know about pan/zoom; it just draws in world space.
 */
export class Viewport {
    /** @param {MapRenderer} renderer */
    constructor(renderer) {
        this.renderer = renderer;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };
    }

    /**
     * Attach mouse event listeners. Call once after the renderer canvas exists.
     * @param {HTMLCanvasElement} canvas
     */
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

    /**
     * Zoom relative to the mouse position so the point under the cursor stays fixed.
     * @param {number} delta - Scale multiplier (< 1 zooms out, > 1 zooms in)
     * @param {number} mouseX - Screen X of the zoom origin
     * @param {number} mouseY - Screen Y of the zoom origin
     */
    zoom(delta, mouseX, mouseY) {
        const worldPos = this.screenToWorld(mouseX, mouseY);
        this.scale *= delta;
        this.scale = Math.max(0.1, Math.min(10, this.scale));

        const newScreenPos = this.worldToScreen(worldPos.x, worldPos.y);
        this.offset.x += mouseX - newScreenPos.x;
        this.offset.y += mouseY - newScreenPos.y;

        this.apply();
    }

    onMouseDown(e) {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
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

    /** Push current scale and offset to the PIXI stage. */
    apply() {
        this.renderer.app.stage.scale.set(this.scale);
        this.renderer.app.stage.position.set(this.offset.x, this.offset.y);
    }

    /**
     * Convert a screen (canvas pixel) coordinate to world (PIXI stage) coordinate.
     * @param {number} sx
     * @param {number} sy
     * @returns {{ x: number, y: number }}
     */
    screenToWorld(sx, sy) {
        return {
            x: (sx - this.offset.x) / this.scale,
            y: (sy - this.offset.y) / this.scale
        };
    }

    /**
     * Convert a world coordinate back to screen space.
     * @param {number} wx
     * @param {number} wy
     * @returns {{ x: number, y: number }}
     */
    worldToScreen(wx, wy) {
        return {
            x: wx * this.scale + this.offset.x,
            y: wy * this.scale + this.offset.y
        };
    }
}
