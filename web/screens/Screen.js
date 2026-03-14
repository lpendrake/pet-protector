const { Container } = PIXI;

export class Screen {
    constructor(app) {
        this.app = app;
        this.container = new Container();
    }

    /** Called when this screen becomes active */
    enter() { }

    /** Called when leaving this screen */
    exit() { }

    /** Called on keydown events */
    handleInput(e) { }

    /** Called every frame. deltaMS = milliseconds since last frame */
    update(deltaMS) { }
}
