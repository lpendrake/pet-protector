import { Screen } from './Screen.js';
import { saveState } from '../state.js';

const { Text, Graphics, Container } = PIXI;

export class SettingsScreen extends Screen {
    constructor(app) {
        super(app);
        this.options = [
            { label: 'Tick Rate', key: 'tickRate', values: [1000, 3000, 10000, 60000], display: ['Fast (1s)', 'Normal (3s)', 'Slow (10s)', 'Snail (1m)'] },
            { label: 'Notifications', key: 'notifications', values: [true, false], display: ['On', 'Off'] }
        ];
        this.selectedIdx = 0;
        this.tempSettings = {};
        this._built = false;
    }

    enter() {
        this.tempSettings = { ...this.app.state.settings };
        this.selectedIdx = 0;
        if (!this._built) {
            this._build();
            this._built = true;
        }
        this._render();
    }

    _build() {
        this.bg = new Graphics();
        this.container.addChild(this.bg);

        this.titleText = new Text('⚙️ Settings', {
            fontFamily: '"VT323", monospace', fontSize: 28, fill: 0x7ec8e3, fontWeight: 'bold'
        });
        this.titleText.x = 30;
        this.titleText.y = 20;
        this.container.addChild(this.titleText);

        this.helpText = new Text('↑↓ Navigate   ←→ Change   Enter: Save   Esc: Cancel', {
            fontFamily: '"VT323", monospace', fontSize: 14, fill: 0x888888
        });
        this.helpText.x = 30;
        this.helpText.y = 60;
        this.container.addChild(this.helpText);

        this.optionsContainer = new Container();
        this.optionsContainer.x = 30;
        this.optionsContainer.y = 110;
        this.container.addChild(this.optionsContainer);
    }

    _render() {
        this.bg.clear();
        this.bg.beginFill(0x16213e);
        this.bg.drawRect(0, 0, 9999, 9999);
        this.bg.endFill();

        this.optionsContainer.removeChildren();

        this.options.forEach((opt, idx) => {
            const isSelected = idx === this.selectedIdx;
            const currentVal = this.tempSettings[opt.key];
            const valIdx = opt.values.indexOf(currentVal);
            const valDisplay = valIdx !== -1 ? opt.display[valIdx] : String(currentVal);

            const label = new Text(`${isSelected ? '▶ ' : '  '}${opt.label}:`, {
                fontFamily: '"VT323", monospace', fontSize: 20,
                fill: isSelected ? 0x00ccff : 0xaaaaaa,
                fontWeight: isSelected ? 'bold' : 'normal',
            });
            label.y = idx * 45;
            this.optionsContainer.addChild(label);

            const value = new Text(isSelected ? `◀ ${valDisplay} ▶` : valDisplay, {
                fontFamily: '"VT323", monospace', fontSize: 20,
                fill: isSelected ? 0xffffff : 0x666666,
                fontWeight: isSelected ? 'bold' : 'normal',
            });
            value.x = 260;
            value.y = idx * 45;
            this.optionsContainer.addChild(value);
        });
    }

    handleInput(e) {
        const key = e.key;
        if (key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIdx = (this.selectedIdx - 1 + this.options.length) % this.options.length;
            this._render();
        } else if (key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIdx = (this.selectedIdx + 1) % this.options.length;
            this._render();
        } else if (key === 'ArrowRight') {
            e.preventDefault();
            this._modifyValue(1);
            this._render();
        } else if (key === 'ArrowLeft') {
            e.preventDefault();
            this._modifyValue(-1);
            this._render();
        } else if (key === 'Enter') {
            this.app.state.settings = { ...this.tempSettings };
            saveState(this.app.state);
            this.app.switchScreen('game');
        } else if (key === 'Escape') {
            this.app.switchScreen('game');
        }
    }

    _modifyValue(dir) {
        const opt = this.options[this.selectedIdx];
        const currentVal = this.tempSettings[opt.key];
        let valIdx = opt.values.indexOf(currentVal);
        if (valIdx === -1) valIdx = 0;
        valIdx = (valIdx + dir + opt.values.length) % opt.values.length;
        this.tempSettings[opt.key] = opt.values[valIdx];
    }
}
