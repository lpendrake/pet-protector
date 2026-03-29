/**
 * Minimal pub/sub event system. The single communication channel between all modules.
 * Modules must never hold direct references to each other — use the bus instead.
 *
 * See implementation_plan.md for the full event catalogue.
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event.
     * @param {string} event - Event name (e.g. 'state:changed', 'tool:active')
     * @param {Function} callback - Invoked with the event payload when emitted
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    /**
     * Unsubscribe a previously registered callback.
     * @param {string} event
     * @param {Function} callback - Must be the same function reference passed to on()
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).delete(callback);
    }

    /**
     * Emit an event, calling all subscribers synchronously in registration order.
     * @param {string} event
     * @param {*} data - Payload passed to each subscriber
     */
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => callback(data));
    }
}
