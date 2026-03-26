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
        this.layer = layer;
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

export class PlaceEntityAction extends Action {
    constructor(type, data) {
        super();
        this.type = type;
        this.data = data;
    }

    execute(state) {
        state.addEntity(this.type, this.data);
    }

    undo(state) {
        state.removeEntity(this.type, this.data.id);
    }
}

export class RemoveEntityAction extends Action {
    constructor(type, data) {
        super();
        this.type = type;
        this.data = data;
    }

    execute(state) {
        state.removeEntity(this.type, this.data.id);
    }

    undo(state) {
        state.addEntity(this.type, this.data);
    }
}
