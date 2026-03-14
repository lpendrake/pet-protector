import { StartupScreen } from './screens/StartupScreen.js';
import { GameScreen } from './screens/GameScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { LogScreen } from './screens/LogScreen.js';
import { loadState, saveState, createNewState } from './state.js';

const { Application } = PIXI;

class App {
    constructor() {
        this.pixiApp = null;
        this.state = null;
        this.currentScreen = null;
        this.screens = {};
    }

    async init() {
        this.pixiApp = new Application({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x6b7b6b,
            antialias: true,
        });
        document.body.appendChild(this.pixiApp.view);

        // Create screens
        this.screens = {
            startup: new StartupScreen(this),
            game: new GameScreen(this),
            settings: new SettingsScreen(this),
            log: new LogScreen(this),
        };

        // Keyboard input
        window.addEventListener('keydown', (e) => {
            if (this.currentScreen) {
                this.currentScreen.handleInput(e);
            }
        });

        // Game loop via PIXI ticker
        this.pixiApp.ticker.add((delta) => {
            if (document.hidden) return; // Pause logic if tab is hidden
            const deltaMS = this.pixiApp.ticker.deltaMS;
            if (this.currentScreen) {
                this.currentScreen.update(deltaMS);
            }
        });

        // Tab visibility / Syncing
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.state) {
                console.log('App: Tab became visible. Re-syncing state from storage...');
                const latest = loadState();
                if (latest) {
                    this.state = latest;
                    if (this.currentScreen && this.currentScreen.onStateSync) {
                        this.currentScreen.onStateSync(this.state);
                    }
                }
            }
        });

        // Start at startup screen
        this.switchScreen('startup');
    }

    switchScreen(name) {
        if (this.currentScreen) {
            this.currentScreen.exit();
            this.pixiApp.stage.removeChild(this.currentScreen.container);
        }
        this.currentScreen = this.screens[name];
        this.pixiApp.stage.addChild(this.currentScreen.container);
        const result = this.currentScreen.enter();
        if (result && typeof result.catch === 'function') {
            result.catch(err => console.error('Screen enter error:', err));
        }
    }

    startGame() {
        let state = loadState();
        if (!state) {
            state = createNewState('Buddy', 'Bear');
        }
        this.state = state;
        saveState(this.state);
        this.switchScreen('game');
    }
}

const app = new App();
app.init().catch(err => console.error('Failed to init app:', err));
