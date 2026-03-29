/**
 * Undo/redo stack using the Command pattern.
 * All state mutations should go through here via MapState.applyAction()
 * so they can be reversed. Branching history is not supported — any new
 * action clears the redo stack.
 *
 * @see Actions.js for the action types that operate against MapState.
 */
export class ActionHistory {
    /**
     * @param {number} maxSize - Maximum number of undo steps retained.
     *   Oldest actions are dropped when this limit is exceeded.
     */
    constructor(maxSize = 100) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = maxSize;
    }

    /**
     * Execute an action and push it onto the undo stack.
     * Clears the redo stack — new actions invalidate any previously undone work.
     * @param {Action} action
     * @param {MapState} state
     */
    push(action, state) {
        action.execute(state);
        this.undoStack.push(action);
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    /**
     * Reverse the most recent action, moving it to the redo stack.
     * No-op if nothing to undo.
     * @param {MapState} state
     */
    undo(state) {
        if (this.undoStack.length === 0) return;
        const action = this.undoStack.pop();
        action.undo(state);
        this.redoStack.push(action);
    }

    /**
     * Re-apply the most recently undone action.
     * No-op if nothing to redo.
     * @param {MapState} state
     */
    redo(state) {
        if (this.redoStack.length === 0) return;
        const action = this.redoStack.pop();
        action.execute(state);
        this.undoStack.push(action);
    }
}
