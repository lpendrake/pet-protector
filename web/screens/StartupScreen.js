import { Screen } from './Screen.js';
import { CURRENT_VERSION } from '../state.js';

const { Text, Graphics } = PIXI;

export class StartupScreen extends Screen {
    constructor(app) {
        super(app);
        this._built = false;
    }

    enter() {
        if (!this._built) {
            this._build();
            this._built = true;
        }
        this.container.visible = true;
    }

    _build() {
        // Background
        const bg = new Graphics();
        bg.beginFill(0x1a1a2e);
        bg.drawRect(0, 0, 9999, 9999);
        bg.endFill();
        this.container.addChild(bg);

        const cx = this.app.pixiApp.screen.width / 2;
        const cy = this.app.pixiApp.screen.height / 2;

        // Title
        const title = new Text('🐾 Pet Protector', {
            fontFamily: '"VT323", monospace',
            fontSize: 48,
            fill: 0xe0aaff,
            fontWeight: 'bold',
        });
        title.anchor.set(0.5);
        title.x = cx;
        title.y = cy - 60;
        this.container.addChild(title);

        // Subtitle
        this._subtitle = new Text('Press any key to start', {
            fontFamily: '"VT323", monospace',
            fontSize: 20,
            fill: 0xaaaaaa,
        });
        this._subtitle.anchor.set(0.5);
        this._subtitle.x = cx;
        this._subtitle.y = cy + 60;
        this.container.addChild(this._subtitle);

        // Version
        const ver = new Text(`v${CURRENT_VERSION}`, {
            fontFamily: '"VT323", monospace',
            fontSize: 16,
            fill: 0x444444,
        });
        ver.anchor.set(1, 1);
        ver.x = this.app.pixiApp.screen.width - 10;
        ver.y = this.app.pixiApp.screen.height - 10;
        this.container.addChild(ver);

        this._blinkTimer = 0;
    }

    handleInput(e) {
        // Ignore modifier keys and browser shortcuts
        if (e.key === 'F5' || e.key === 'F12' || e.ctrlKey || e.altKey || e.metaKey) return;
        this.app.startGame();
    }

    update(deltaMS) {
        if (this._subtitle) {
            this._blinkTimer += deltaMS;
            this._subtitle.alpha = 0.5 + 0.5 * Math.sin(this._blinkTimer / 500);
        }
    }
}
