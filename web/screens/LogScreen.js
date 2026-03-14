import { Screen } from './Screen.js';

const { Text, Graphics, Container } = PIXI;

export class LogScreen extends Screen {
    constructor(app) {
        super(app);
        this._built = false;
    }

    enter() {
        if (!this._built) {
            this._build();
            this._built = true;
        }
        this._render();
    }

    _build() {
        this.bg = new Graphics();
        this.container.addChild(this.bg);

        this.titleText = new Text('📜 Event Log', {
            fontFamily: '"VT323", monospace', fontSize: 28, fill: 0x7ec8e3, fontWeight: 'bold'
        });
        this.titleText.x = 30;
        this.titleText.y = 20;
        this.container.addChild(this.titleText);

        this.helpText = new Text('Press ESC or ENTER to return', {
            fontFamily: '"VT323", monospace', fontSize: 14, fill: 0x888888
        });
        this.helpText.x = 30;
        this.helpText.y = this.app.pixiApp.screen.height - 40;
        this.container.addChild(this.helpText);

        this.eventsContainer = new Container();
        this.eventsContainer.x = 30;
        this.eventsContainer.y = 70;
        this.container.addChild(this.eventsContainer);
    }

    _render() {
        this.bg.clear();
        this.bg.beginFill(0x16213e);
        this.bg.drawRect(0, 0, 9999, 9999);
        this.bg.endFill();

        this.eventsContainer.removeChildren();

        const events = this.app.state?.events || [];
        const pageEvents = events.slice(0, 20);

        if (pageEvents.length === 0) {
            const noEvents = new Text('No events yet.', {
                fontFamily: '"VT323", monospace', fontSize: 16, fill: 0x666666
            });
            this.eventsContainer.addChild(noEvents);
        } else {
            pageEvents.forEach((evt, i) => {
                const evtText = new Text(evt, {
                    fontFamily: '"VT323", monospace', fontSize: 14, fill: 0xcccccc
                });
                evtText.y = i * 24;
                this.eventsContainer.addChild(evtText);
            });
        }
    }

    handleInput(e) {
        if (e.key === 'Escape' || e.key === 'Enter') {
            this.app.switchScreen('game');
        }
    }
}
