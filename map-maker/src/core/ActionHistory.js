export class ActionHistory {
    constructor(maxSize = 100) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = maxSize;
    }

    push(action, state) {
        action.execute(state);
        this.undoStack.push(action);
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
        this.redoStack = []; // Clear redo on new action
    }

    undo(state) {
        if (this.undoStack.length === 0) return;
        const action = this.undoStack.pop();
        action.undo(state);
        this.redoStack.push(action);
    }

    redo(state) {
        if (this.redoStack.length === 0) return;
        const action = this.redoStack.pop();
        action.execute(state);
        this.undoStack.push(action);
    }
}
