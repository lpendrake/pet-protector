export class Action {
    constructor() {
        this.timestamp = Date.now();
    }
    execute(state) {}
    undo(state) {}
}

export class PaintTileAction extends Action {
    constructor(x, y, layer, newValue, oldValue) {
        super();
        this.x = x;
        this.y = y;
        this.layer = layer; // 'base', 'item', 'zone', 'warp'
        this.newValue = newValue;
        this.oldValue = oldValue;
    }

    execute(state) {
        state.setTileData(this.x, this.y, this.layer, this.newValue);
    }

    undo(state) {
        state.setTileData(this.x, this.y, this.layer, this.oldValue);
    }
}

export class ActionHistory {
    constructor(maxSize = 100) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = maxSize;
    }

    push(action, state) {
        action.execute(state);
        this.undoStack.push(action);
        if (this.undoStack.length > this.maxSize) this.undoStack.shift();
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
