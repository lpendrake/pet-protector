/**
 * Manages transient toast notifications.
 * Owns the #toast-container element and listens for error/notification events.
 *
 * Listens to:
 *   'fill:error'     → show error toast
 *   'save:error'     → show error toast with "Save Error:" prefix
 *   'save:completed' → show success toast on master saves
 *   'toast:show'     → show toast with { message, type }
 */
export class ToastManager {
    /** @param {EventBus} bus */
    constructor(bus) {
        this.bus = bus;
        this.container = document.getElementById('toast-container');

        if (this.bus) {
            this.bus.on('fill:error', (err) => {
                this.show(err.message, 'error');
            });
            this.bus.on('save:error', (err) => {
                this.show(`Save Error: ${err.message}`, 'error');
            });
            this.bus.on('save:completed', (data) => {
                if (data.type === 'master') {
                    this.show(`Saved (v${data.version})`, 'info');
                }
            });
            this.bus.on('toast:show', ({ message, type }) => {
                this.show(message, type);
            });
        }
    }

    /**
     * Display a transient toast notification. Disappears after 4 seconds.
     * @param {string} message
     * @param {'info'|'error'} [type='info']
     */
    show(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        this.container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }
}
