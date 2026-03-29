export class ShortcutManager {
    constructor() {
        this._registry = new Map(); // canonical string -> { action, description }
        this._handler = null;
    }

    /**
     * Register a keyboard shortcut.
     * Throws if the canonical key is already registered — collisions are programmer errors.
     */
    register({ key, ctrlKey = false, shiftKey = false, action, description = '' }) {
        const canonical = this._canonical(key, ctrlKey, shiftKey);
        if (this._registry.has(canonical)) {
            throw new Error(
                `ShortcutManager: "${canonical}" already registered ` +
                `(existing: "${this._registry.get(canonical).description}")`
            );
        }
        this._registry.set(canonical, { action, description });
    }

    /**
     * Register the app-wide shortcuts that aren't tool-owned (undo, redo, save).
     * Called once from main.js.
     */
    registerCoreShortcuts(state, bus) {
        this.register({ key: 'z', ctrlKey: true,                description: 'Undo', action: () => state.undo() });
        this.register({ key: 'Z', ctrlKey: true, shiftKey: true, description: 'Redo', action: () => state.redo() });
        this.register({ key: 's', ctrlKey: true,                description: 'Save', action: () => bus.emit('save:requested') });
    }

    /**
     * Walk toolManager.tools and register each tool's static shortcut.
     * - null shortcut   → throws (developer forgot to declare one)
     * - '' shortcut     → skipped silently (intentionally no shortcut)
     * - 'b' etc.        → registered
     */
    registerToolShortcuts(toolManager) {
        for (const [name, instance] of toolManager.tools) {
            const key = instance.constructor.shortcut;
            if (key === null) {
                throw new Error(
                    `Tool "${name}" (${instance.constructor.name}) has shortcut = null. ` +
                    `Set '' for no shortcut, or a key string like 'b'.`
                );
            }
            if (key === '') continue;
            this.register({
                key,
                description: `Tool: ${name}`,
                action: () => toolManager.setTool(name),
            });
        }
    }

    /**
     * Handle a keyboard event — pure dispatch logic, no DOM coupling.
     * Called by the attached listener, and directly in tests.
     */
    handleEvent(e) {
        if (e.repeat) return; // ignore OS key-repeat — one action per intentional keypress
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const entry = this._registry.get(this._canonical(e.key, e.ctrlKey, e.shiftKey));
        if (entry) {
            e.preventDefault();
            entry.action();
        }
    }

    /**
     * Attach the keydown listener to a target (default: window).
     */
    attach(target = window) {
        this._handler = (e) => this.handleEvent(e);
        target.addEventListener('keydown', this._handler);
    }

    /** Remove the listener — important for test isolation. */
    detach(target = window) {
        if (this._handler) {
            target.removeEventListener('keydown', this._handler);
            this._handler = null;
        }
    }

    /** Returns a copy of the registry — safe for tests and a future help panel. */
    getAll() {
        return new Map(this._registry);
    }

    _canonical(key, ctrlKey, shiftKey) {
        const parts = [];
        if (ctrlKey) parts.push('ctrl');
        if (shiftKey) parts.push('shift');
        // Do NOT normalise case — 'z' (zone tool) and 'Z' (ctrl+shift+Z redo) are distinct
        parts.push(key);
        return parts.join('+');
    }
}
