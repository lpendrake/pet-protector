/**
 * Base class for all floating panels in the map editor.
 * Creates a draggable, closable, optionally pinnable DOM panel
 * that stays within its parent element's bounds.
 *
 * DOM structure:
 *   .fw > .fw-titlebar ( .fw-title + .fw-controls ( .fw-pin? + .fw-close? ) )
 *        > .fw-body
 */
export class FloatingWindow {
    /** @type {number} Monotonically increasing z-index counter shared by all instances. */
    static _zCounter = 200;

    /**
     * @param {object} opts
     * @param {string}      opts.id        Unique identifier (used for DOM id and localStorage key)
     * @param {string}      opts.title     Titlebar text
     * @param {HTMLElement}  opts.parent    Container element to append to (usually #viewport-container)
     * @param {number}      [opts.x=20]    Initial left position (px)
     * @param {number}      [opts.y=20]    Initial top position (px)
     * @param {number}      [opts.width]   Optional fixed width (px); omit for auto-sizing
     * @param {boolean}     [opts.pinnable=false]  Show a pin toggle button
     * @param {boolean}     [opts.closable=true]   Show a close button
     * @param {Function}    [opts.onClose]  Called after the window is closed
     * @param {Function}    [opts.onPinChange]  Called with (pinned: boolean) when pin state changes
     */
    constructor({ id, title, parent, x = 20, y = 20, width, pinnable = false, closable = true, onClose, onPinChange }) {
        this.id = id;
        this.parent = parent;
        this._pinned = false;
        this._onClose = onClose;
        this._onPinChange = onPinChange;
        this._visible = false;

        // ── Build DOM ──────────────────────────────────────────────────
        this.el = document.createElement('div');
        this.el.className = 'fw';
        this.el.id = `fw-${id}`;
        if (width) this.el.style.width = `${width}px`;

        // Titlebar
        this._titlebar = document.createElement('div');
        this._titlebar.className = 'fw-titlebar';

        this._titleEl = document.createElement('span');
        this._titleEl.className = 'fw-title';
        this._titleEl.textContent = title;
        this._titlebar.appendChild(this._titleEl);

        const controls = document.createElement('div');
        controls.className = 'fw-controls';

        if (pinnable) {
            this._pinBtn = document.createElement('button');
            this._pinBtn.className = 'fw-pin';
            this._pinBtn.title = 'Pin';
            this._pinBtn.textContent = '\u{1F4CC}'; // 📌
            this._pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._togglePin();
            });
            controls.appendChild(this._pinBtn);
        }

        if (closable) {
            this._closeBtn = document.createElement('button');
            this._closeBtn.className = 'fw-close';
            this._closeBtn.title = 'Close';
            this._closeBtn.textContent = '\u2715'; // ✕
            this._closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
            controls.appendChild(this._closeBtn);
        }

        this._titlebar.appendChild(controls);
        this.el.appendChild(this._titlebar);

        // Body
        this.body = document.createElement('div');
        this.body.className = 'fw-body';
        this.el.appendChild(this.body);

        // ── Dragging ───────────────────────────────────────────────────
        this._dragOffset = { x: 0, y: 0 };
        this._isDragging = false;

        this._onDragStart = this._onDragStart.bind(this);
        this._onDragMove = this._onDragMove.bind(this);
        this._onDragEnd = this._onDragEnd.bind(this);

        this._titlebar.addEventListener('mousedown', this._onDragStart);

        // Prevent clicks inside the window from reaching the canvas
        this.el.addEventListener('mousedown', (e) => e.stopPropagation());
        this.el.addEventListener('pointerdown', (e) => e.stopPropagation());

        // ── Restore position from localStorage ─────────────────────────
        const saved = this._loadPosition();
        if (saved) {
            x = saved.x;
            y = saved.y;
        }
        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;

        // ── Append to parent ───────────────────────────────────────────
        this.parent.appendChild(this.el);

        // If saved state was "open", auto-open
        if (saved && saved.open) {
            this.open();
        }
    }

    // ── Public API ──────────────────────────────────────────────────────

    /** Show the window and bring it to front. */
    open() {
        this._visible = true;
        this.el.classList.add('fw-visible');
        this.bringToFront();
        this._clampToParent();
    }

    /** Hide the window. Calls onClose callback if provided. */
    close() {
        this._visible = false;
        this.el.classList.remove('fw-visible');
        this._savePosition();
        if (this._onClose) this._onClose(this);
    }

    /** Toggle visibility. */
    toggle() {
        if (this._visible) {
            this.close();
        } else {
            this.open();
        }
    }

    /** @returns {boolean} Whether the window is currently visible. */
    isOpen() {
        return this._visible;
    }

    /** Remove the window from the DOM entirely and clean up listeners. */
    destroy() {
        window.removeEventListener('mousemove', this._onDragMove);
        window.removeEventListener('mouseup', this._onDragEnd);
        this.el.remove();
    }

    /**
     * Replace the body contents with the given element.
     * @param {HTMLElement} el
     */
    setContent(el) {
        this.body.innerHTML = '';
        this.body.appendChild(el);
    }

    /** Set the titlebar text. */
    setTitle(title) {
        this._titleEl.textContent = title;
    }

    /** Raise this window above all other floating windows. */
    bringToFront() {
        this.el.style.zIndex = ++FloatingWindow._zCounter;
    }

    /** @returns {boolean} */
    isPinned() {
        return this._pinned;
    }

    /** @returns {{ x: number, y: number }} */
    getPosition() {
        return {
            x: parseInt(this.el.style.left, 10) || 0,
            y: parseInt(this.el.style.top, 10) || 0,
        };
    }

    /**
     * Move the window to the given position, clamped to parent bounds.
     * @param {number} x
     * @param {number} y
     */
    setPosition(x, y) {
        const clamped = this._clamp(x, y);
        this.el.style.left = `${clamped.x}px`;
        this.el.style.top = `${clamped.y}px`;
    }

    // ── Pin ─────────────────────────────────────────────────────────────

    _togglePin() {
        this._pinned = !this._pinned;
        if (this._pinBtn) {
            this._pinBtn.classList.toggle('fw-pin-active', this._pinned);
        }
        // When pinned, hide the close button so the user can't accidentally close a pinned panel
        if (this._closeBtn) {
            this._closeBtn.style.display = this._pinned ? 'none' : '';
        }
        if (this._onPinChange) this._onPinChange(this._pinned);
    }

    // ── Drag ────────────────────────────────────────────────────────────

    /** @param {MouseEvent} e */
    _onDragStart(e) {
        // Only drag on left button, ignore clicks on control buttons
        if (e.button !== 0) return;
        if (e.target.closest('.fw-controls')) return;

        this._isDragging = true;
        this._dragOffset.x = e.clientX - this.el.offsetLeft;
        this._dragOffset.y = e.clientY - this.el.offsetTop;

        this._titlebar.classList.add('fw-dragging');
        this.bringToFront();

        window.addEventListener('mousemove', this._onDragMove);
        window.addEventListener('mouseup', this._onDragEnd);

        e.preventDefault();
        e.stopPropagation();
    }

    /** @param {MouseEvent} e */
    _onDragMove(e) {
        if (!this._isDragging) return;
        const rawX = e.clientX - this._dragOffset.x;
        const rawY = e.clientY - this._dragOffset.y;
        const { x, y } = this._clamp(rawX, rawY);
        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;
    }

    _onDragEnd() {
        if (!this._isDragging) return;
        this._isDragging = false;
        this._titlebar.classList.remove('fw-dragging');
        window.removeEventListener('mousemove', this._onDragMove);
        window.removeEventListener('mouseup', this._onDragEnd);
        this._savePosition();
    }

    // ── Clamping ────────────────────────────────────────────────────────

    /**
     * Clamp x/y so the window stays within the parent's bounding rect.
     * @param {number} x
     * @param {number} y
     * @returns {{ x: number, y: number }}
     */
    _clamp(x, y) {
        const parentRect = this.parent.getBoundingClientRect();
        const elW = this.el.offsetWidth;
        const elH = this.el.offsetHeight;
        return {
            x: Math.max(0, Math.min(parentRect.width - elW, x)),
            y: Math.max(0, Math.min(parentRect.height - elH, y)),
        };
    }

    /** Re-clamp the current position (e.g. after parent resize or open). */
    _clampToParent() {
        const pos = this.getPosition();
        this.setPosition(pos.x, pos.y);
    }

    // ── localStorage persistence ────────────────────────────────────────

    _storageKey() {
        return `fw-pos-${this.id}`;
    }

    _savePosition() {
        try {
            const pos = this.getPosition();
            localStorage.setItem(this._storageKey(), JSON.stringify({
                x: pos.x,
                y: pos.y,
                open: this._visible,
            }));
        } catch { /* localStorage unavailable — silent fail */ }
    }

    /** @returns {{ x: number, y: number, open: boolean } | null} */
    _loadPosition() {
        try {
            const raw = localStorage.getItem(this._storageKey());
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (typeof data.x === 'number' && typeof data.y === 'number') return data;
        } catch { /* corrupt or unavailable */ }
        return null;
    }
}
