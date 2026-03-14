import { Screen } from './Screen.js';
import { World, TILE_SIZE, TILE_DEFS } from '../world.js';
import { tick, addNotification, DECAY_RATES } from '../game.js';
import { saveState, CURRENT_VERSION } from '../state.js';

const { Container, Graphics, Text } = PIXI;

const LEASH = 3;
const VISION = 3;
const CALL_STEP_MS = 100;

export class GameScreen extends Screen {
    constructor(app) {
        super(app);
        this.world = new World();
        this.spiritPos = { x: 0, y: 0 };
        this.petPos = { x: 0, y: 0 };
        this.tickAccum = 0;
        this.petAccum = 0;
        this.petCalling = false;
        this.showScene = false;
        this._built = false;
        this._loaded = false;
    }

    async enter() {
        if (!this._built) { this._build(); this._built = true; }
        if (!this._loaded) {
            await this.world.load('./maps/test.json');
            const st = this.app.state;
            console.log('GameScreen: Enter. App state:', st);
            
            if (st && st.spiritPos && st.petPos) {
                console.log('GameScreen: Resuming from saved positions:', st.spiritPos, st.petPos);
                this.spiritPos = { ...st.spiritPos };
                this.petPos = { ...st.petPos };
            } else {
                const s = this.world.startPosition;
                console.log('GameScreen: No saved positions found or state missing. Starting at:', s);
                this.spiritPos = { ...s };
                this.petPos = { ...s };
                if (st) {
                    st.spiritPos = { ...this.spiritPos };
                    st.petPos = { ...this.petPos };
                    saveState(st);
                }
            }

            this.worldLayer.addChildAt(this.world.container, 0);
            this._buildFog();
            this._loaded = true;
        }
        this._cam();
        this._markers();
        this._updateFog();
        this._petPip();
    }

    // ── BUILD ──────────────────────────────────────────────

    _build() {
        // Misty grey background — visible beyond map edges
        const bg = new Graphics();
        bg.beginFill(0x6b7b6b);
        bg.drawRect(0, 0, 9999, 9999);
        bg.endFill();
        this.container.addChild(bg);

        this.worldLayer = new Container();
        this.container.addChild(this.worldLayer);

        // Spirit marker — white square + subtle glow
        this.spiritGfx = new Graphics();
        this.spiritGfx.beginFill(0xffffff, 0.15);
        this.spiritGfx.drawCircle(0, 0, TILE_SIZE * 0.38);
        this.spiritGfx.endFill();
        this.spiritGfx.beginFill(0xffffff);
        this.spiritGfx.drawRect(-10, -10, 20, 20);
        this.spiritGfx.endFill();
        this.worldLayer.addChild(this.spiritGfx);

        // Pet marker — dark square
        this.petGfx = new Graphics();
        this.petGfx.beginFill(0x1a1a1a);
        this.petGfx.drawRect(-12, -12, 24, 24);
        this.petGfx.endFill();
        this.petGfx.lineStyle(2, 0x000000);
        this.petGfx.drawRect(-12, -12, 24, 24);
        this.worldLayer.addChild(this.petGfx);

        // Fixed UI layer
        this.ui = new Container();
        this.container.addChild(this.ui);

        this._mkPetPip();
        this._mkCreaturePip();
        this._mkDescBox();
        this._mkScenePip();

        this.hintText = new Text('Arrows: move · Space: call pet', {
            fontFamily: '"VT323", monospace', fontSize: 12, fill: 0x444444
        });
        this.hintText.anchor.set(0.5, 0);
        this.hintText.x = this.app.pixiApp.screen.width / 2; this.hintText.y = 8;
        this.ui.addChild(this.hintText);

        // Version in game
        const verStr = `v${this.app.config.version || '0.0.1'}+${this.app.config.build || 'unknown'}`;
        const ver = new Text(verStr, {
            fontFamily: '"VT323", monospace', fontSize: 12, fill: 0x444444
        });
        ver.anchor.set(1, 1);
        ver.x = this.app.pixiApp.screen.width - 8;
        ver.y = this.app.pixiApp.screen.height - 8;
        this.ui.addChild(ver);
    }

    // ── FOG ───────────────────────────────────────────────

    _buildFog() {
        this.fogLayer = new Container();
        // Insert between world tiles (index 0) and markers
        this.worldLayer.addChildAt(this.fogLayer, 1);

        this.fogCells = [];
        const pad = 6;
        const x0 = -pad, y0 = -pad;
        const x1 = this.world.width + pad;
        const y1 = this.world.height + pad;

        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                const fog = new Graphics();
                fog.beginFill(0x6b7b6b);
                fog.drawRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                fog.endFill();
                this.fogLayer.addChild(fog);
                this.fogCells.push({ x, y, gfx: fog });
            }
        }
    }

    _updateFog() {
        if (!this.fogCells) return;
        const sx = this.spiritPos.x, sy = this.spiritPos.y;
        for (const cell of this.fogCells) {
            const outside = cell.x < 0 || cell.y < 0 ||
                            cell.x >= this.world.width || cell.y >= this.world.height;
            const dist = this._dist(cell, this.spiritPos);

            if (outside) {
                cell.gfx.alpha = 1;
            } else if (dist <= 1) {
                cell.gfx.alpha = 0;
            } else if (dist <= 2) {
                cell.gfx.alpha = 0.2;
            } else if (dist <= VISION) {
                cell.gfx.alpha = 0.5;
            } else {
                cell.gfx.alpha = 0.85;
            }
            
            // Hide Apple if out of spirit's sight
            const tid = this.world.getTile(cell.x, cell.y);
            if (tid === 'A') {
                const ts = this.world.tileSprites && this.world.tileSprites[cell.y] && this.world.tileSprites[cell.y][cell.x];
                if (ts) {
                    const visible = dist <= VISION;
                    ts.bg.visible = visible;
                    ts.label.visible = visible;
                }
            }
        }
    }

    // ── PET PiP (bottom-left) ─────────────────────────────

    _mkPetPip() {
        const ph = this.app.pixiApp.screen.height * 0.4;
        const pw = ph * 1.5; // Maintain a good aspect ratio
        this.ppip = new Container();
        this.ppip.x = 20; this.ppip.y = this.app.pixiApp.screen.height - ph - 20;
        this.ui.addChild(this.ppip);

        const bg = new Graphics();
        bg.lineStyle(3, 0x7ec8e3, 0.8);
        bg.beginFill(0x0d1117, 0.92);
        bg.drawRoundedRect(0, 0, pw, ph, 12);
        bg.endFill();
        this.ppip.addChild(bg);

        this.ppipTitle = new Text('🐾 Buddy', {
            fontFamily: '"VT323", monospace', fontSize: 24, fill: 0x7ec8e3, fontWeight: 'bold'
        });
        this.ppipTitle.x = 20; this.ppipTitle.y = 12;
        this.ppip.addChild(this.ppipTitle);

        this.ppipBars = new Container();
        this.ppipBars.x = 20; this.ppipBars.y = 50;
        this.ppip.addChild(this.ppipBars);

        this.ppipStatus = new Text('Idle', {
            fontFamily: '"VT323", monospace', fontSize: 18, fill: 0xaaaaaa
        });
        this.ppipStatus.x = 20; this.ppipStatus.y = ph - 40;
        this.ppip.addChild(this.ppipStatus);

        this.ppipPreview = new Graphics();
        // Position preview on the right side of the large PiP
        this.ppipPreview.x = pw - (ph * 0.8) - 20; this.ppipPreview.y = 50;
        this.ppip.addChild(this.ppipPreview);

        // Thought bubble box emerging from the top right, above the preview
        this.thoughtBox = new Container();
        this.thoughtBox.y = -60; 
        this.thoughtBox.x = pw - 80;
        this.thoughtBox.visible = false;
        this.ppip.addChild(this.thoughtBox);

        const tbBg = new Graphics();
        tbBg.lineStyle(3, 0x7ec8e3, 0.8);
        tbBg.beginFill(0x0d1117, 0.95);
        tbBg.drawRoundedRect(0, 0, 70, 70, 12);
        
        // Larger triangle tail
        tbBg.beginFill(0x0d1117, 0.95);
        tbBg.lineStyle(3, 0x7ec8e3, 0.8);
        tbBg.moveTo(25, 70);
        tbBg.lineTo(35, 85);
        tbBg.lineTo(45, 70);
        tbBg.endFill();
        this.thoughtBox.addChild(tbBg);

        this.thoughtText = new Text('', { fontFamily: '"VT323", monospace', fontSize: 42 });
        this.thoughtText.x = 14;
        this.thoughtText.y = 10;
        this.thoughtBox.addChild(this.thoughtText);
    }

    // ── CREATURE PiP (bottom-right, icon only) ────────────

    _mkCreaturePip() {
        const ph = this.app.pixiApp.screen.height * 0.3;
        const pw = ph; // Square for now
        this.cpip = new Container();
        this.cpip.x = this.app.pixiApp.screen.width - pw - 20;
        this.cpip.y = this.app.pixiApp.screen.height - ph - 20;
        this.cpip.visible = false;
        this.ui.addChild(this.cpip);

        const bg = new Graphics();
        bg.lineStyle(3, 0x9370DB, 0.8);
        bg.beginFill(0x0d1117, 0.92);
        bg.drawRoundedRect(0, 0, pw, ph, 12);
        bg.endFill();
        this.cpip.addChild(bg);

        this.cpip.addChild(Object.assign(new Text('🐺 ???', {
            fontFamily: '"VT323", monospace', fontSize: 24, fill: 0x9370DB, fontWeight: 'bold'
        }), { x: 20, y: 12 }));

        // Creature icon
        const icon = new Graphics();
        icon.beginFill(0xc8c8ff, 0.3);
        icon.drawCircle(pw / 2, ph * 0.6, ph * 0.25);
        icon.endFill();
        icon.beginFill(0xe0e0ff, 0.6);
        icon.drawCircle(pw / 2, ph * 0.6, ph * 0.1);
        icon.endFill();
        this.cpip.addChild(icon);
    }

    // ── DESCRIPTION BOX (bottom-centre, between PiPs) ─────

    _mkDescBox() {
        const bw = 600, bh = 150;
        this.descBox = new Container();
        this.descBox.x = (this.app.pixiApp.screen.width - bw) / 2;
        this.descBox.y = this.app.pixiApp.screen.height - bh - 40;
        this.descBox.visible = false;
        this.ui.addChild(this.descBox);

        const bg = new Graphics();
        bg.lineStyle(2, 0x888888, 0.5);
        bg.beginFill(0x0d1117, 0.94);
        bg.drawRoundedRect(0, 0, bw, bh, 10);
        bg.endFill();
        this.descBox.addChild(bg);

        this.descText = new Text('', {
            fontFamily: '"VT323", monospace', fontSize: 24, fill: 0xcccccc,
            wordWrap: true, wordWrapWidth: bw - 60, lineHeight: 32
        });
        this.descText.x = 30; this.descText.y = 25;
        this.descBox.addChild(this.descText);
    }

    // ── SCENE PiP (centre overlay) ────────────────────────

    _mkScenePip() {
        const sw = 500, sh = 340;
        this.spip = new Container();
        this.spip.x = (this.app.pixiApp.screen.width - sw) / 2;
        this.spip.y = (this.app.pixiApp.screen.height - sh) / 2;
        this.spip.visible = false;
        this.ui.addChild(this.spip);

        const ov = new Graphics();
        ov.beginFill(0x000000, 0.6);
        ov.drawRect(-this.spip.x, -this.spip.y, 9999, 9999);
        ov.endFill();
        this.spip.addChild(ov);

        const bg = new Graphics();
        bg.lineStyle(2, 0xc4a46c, 0.8);
        bg.beginFill(0x1c1408, 0.96);
        bg.drawRoundedRect(0, 0, sw, sh, 10);
        bg.endFill();
        this.spip.addChild(bg);

        this.spip.addChild(Object.assign(new Text('🏛️ Ancient Mural', {
            fontFamily: '"VT323", monospace', fontSize: 22, fill: 0xc4a46c, fontWeight: 'bold'
        }), { x: 20, y: 15 }));

        this.spip.addChild(Object.assign(new Text(
            'A depiction of a tower, an eye wreathed in lightning at the top.\n' +
            'Ape-like creatures are seen at the base, on its balconies.\n\n' +
            'The next scene is eroded and can\'t be made out, but the one\n' +
            'after shows the same tower — a fog floods from it, and the\n' +
            'apes flee as it kills those it has touched.', {
            fontFamily: '"VT323", monospace', fontSize: 14, fill: 0xd4c4a0,
            wordWrap: true, wordWrapWidth: 460, lineHeight: 24
        }), { x: 20, y: 55 }));

        const hint = new Text('Press ESC to close', {
            fontFamily: '"VT323", monospace', fontSize: 12, fill: 0x777777
        });
        hint.anchor.set(0.5, 0);
        hint.x = sw / 2; hint.y = sh - 28;
        this.spip.addChild(hint);
    }

    // ── UPDATES ───────────────────────────────────────────

    _cam() {
        this.worldLayer.x = this.app.pixiApp.screen.width / 2 - (this.petPos.x + 0.5) * TILE_SIZE;
        this.worldLayer.y = this.app.pixiApp.screen.height / 2 - (this.petPos.y + 0.5) * TILE_SIZE;
    }

    _markers() {
        this.spiritGfx.x = (this.spiritPos.x + 0.5) * TILE_SIZE;
        this.spiritGfx.y = (this.spiritPos.y + 0.5) * TILE_SIZE;
        this.petGfx.x = (this.petPos.x + 0.5) * TILE_SIZE;
        this.petGfx.y = (this.petPos.y + 0.5) * TILE_SIZE;
    }

    _petPip() {
        const st = this.app.state;
        if (!st) return;
        const p = st.pet;
        this.ppipTitle.text = `🐾 ${p.name}`;

        let status = 'Idle';
        if (this.petCalling) status = 'Coming to you...';
        else if (p.nutrition < 20) status = 'Starving!';
        else if (p.nutrition < 50) status = 'Hungry...';
        else if (p.energy < 20) status = 'Exhausted';
        else if (p.energy < 40) status = 'Sleepy';
        this.ppipStatus.text = status;

        // Remove old stat bars
        this.ppipBars.removeChildren();
        
        // Diegetic Needs: if a need is high (meaning nutrition/energy/hydration is LOW), show an emoji
        let thought = '';
        if (p.nutrition < 30) thought = '🥩';
        else if (p.energy < 30) thought = '💤';
        else if (p.hydration < 30) thought = '💧';
        
        if (thought) {
            this.thoughtText.text = thought;
            this.thoughtBox.visible = true;
        } else {
            this.thoughtBox.visible = false;
        }

        this.ppipPreview.clear();
        const tid = this.world.getTile?.(Math.round(this.petPos.x), Math.round(this.petPos.y));
        const tc = (tid && TILE_DEFS[tid]) ? TILE_DEFS[tid].color : 0x555555;
        
        const ph = this.app.pixiApp.screen.height * 0.4;
        const preSize = ph * 0.6;
        
        this.ppipPreview.beginFill(tc);
        this.ppipPreview.drawRect(0, 0, preSize, preSize * 1.2);
        this.ppipPreview.endFill();
        
        this.ppipPreview.beginFill(0x1a1a1a);
        const petSize = preSize * 0.3;
        this.ppipPreview.drawRect((preSize - petSize)/2, (preSize * 1.2 - petSize)/2, petSize, petSize);
        this.ppipPreview.endFill();
    }

    _spiritTriggers() {
        if (!this._loaded) return;
        const t = this.world.getTile(this.spiritPos.x, this.spiritPos.y);
        if (t === 'R' && !this.showScene) {
            this.showScene = true;
            this.spip.visible = true;
        }

        // Creature proximity
        let near = false;
        for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
            if (this.world.getTile(this.spiritPos.x + dx, this.spiritPos.y + dy) === 'C') {
                near = true; break;
            }
        }
        this.cpip.visible = near;
        this.descBox.visible = near;
        if (near) {
            this.descText.text = 'A magical wolf, flowing fur made of moonlight.\nIt watches you warily...';
        }
    }

    _petTriggers() {
        if (!this._loaded) return;
        
        // Pet interactions with the environment
        const pt = this.world.getTile(Math.round(this.petPos.x), Math.round(this.petPos.y));
        const px = Math.round(this.petPos.x), py = Math.round(this.petPos.y);
        const state = this.app.state;
        
        if (pt === 'W' && state.pet.hydration < 100) {
            state.pet.hydration = 100; // Max out hydration
            addNotification(state, `${state.pet.name} drank from the crystal clear water.`);
        }
        if (pt === 'V' && state.pet.energy < 100) {
            state.pet.energy = 100; // Max out energy
            addNotification(state, `${state.pet.name} rested deeply in the cave.`);
        }
        if (pt === 'A' && state.pet.nutrition < 100) {
            state.pet.nutrition = Math.min(100, state.pet.nutrition + 50);
            addNotification(state, `${state.pet.name} ate a magical apple!`);
            this.world.mapData.tiles[py][px] = 'G'; // Consume the apple
            this.world._buildTiles();
            
            // Calculate respawn time: Target 4 minutes (80 ticks)
            // 50 nutrition / 0.25 decay = 200 ticks (10 mins). 200 * 0.4 = 80 ticks (4 mins).
            if (!state.cooldowns) state.cooldowns = {};
            const replenishAmount = 50;
            const respawnTicks = Math.floor((replenishAmount / DECAY_RATES.nutrition) * 0.4);
            state.cooldowns[`apple_${px}_${py}`] = respawnTicks;
        }
    }

    _dist(a, b) {
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
    }

    // ── INPUT ─────────────────────────────────────────────

    handleInput(e) {
        if (!this._loaded) return;

        if (this.showScene) {
            if (e.key === 'Escape') { this.showScene = false; this.spip.visible = false; }
            return;
        }

        // Call pet to spirit
        if (e.key === ' ') {
            e.preventDefault();
            if (this._dist(this.petPos, this.spiritPos) > 0) {
                this.petCalling = true;
                this._petPip();
            }
            return;
        }

        let dx = 0, dy = 0;
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':   dy = -1; break;
            case 'ArrowDown':
            case 's':
            case 'S': dy =  1; break;
            case 'ArrowLeft':
            case 'a':
            case 'A': dx = -1; break;
            case 'ArrowRight':
            case 'd':
            case 'D': dx =  1; break;
            default: return;
        }
        e.preventDefault();

        const nx = this.spiritPos.x + dx, ny = this.spiritPos.y + dy;
        if (!this.world.isPassable(nx, ny)) return;
        if (this._dist({ x: nx, y: ny }, this.petPos) > LEASH) return;

        this.spiritPos.x = nx;
        this.spiritPos.y = ny;
        if (this.app.state) {
            this.app.state.spiritPos = { ...this.spiritPos };
            this.app.state.petPos = { ...this.petPos }; 
            console.log('GameScreen: Spirit moved. Saving state:', this.app.state.spiritPos);
            saveState(this.app.state);
        }

        this._cam();
        this._markers();
        this._updateFog();
        this._spiritTriggers();
        this._petTriggers();
    }

    // ── LOOP ──────────────────────────────────────────────

    update(deltaMS) {
        if (!this._loaded || !this.app.state) return;

        // Pet travelling to spirit when called
        if (this.petCalling) {
            this.petAccum += deltaMS;
            if (this.petAccum >= CALL_STEP_MS) {
                this.petAccum -= CALL_STEP_MS;
                if (this._dist(this.petPos, this.spiritPos) > 0) {
                    const ddx = this.spiritPos.x - this.petPos.x;
                    const ddy = this.spiritPos.y - this.petPos.y;
                    if (Math.abs(ddx) >= Math.abs(ddy)) this.petPos.x += Math.sign(ddx);
                    else this.petPos.y += Math.sign(ddy);
                    
                    if (this.app.state) {
                        this.app.state.petPos = { ...this.petPos };
                        this.app.state.spiritPos = { ...this.spiritPos };
                        saveState(this.app.state);
                    }

                    this._markers();
                    this._petPip();
                    this._cam();
                    this._petTriggers();
                } else {
                    this.petCalling = false;
                    if (this.app.state) {
                        this.app.state.petPos = { ...this.petPos };
                        saveState(this.app.state);
                    }
                    this._petPip();
                    this._petTriggers();
                }
            }
        }

        // Game tick
        this.tickAccum += deltaMS;
        const rate = this.app.state.settings?.tickRate || 3000;
        if (this.tickAccum >= rate) {
            this.tickAccum -= rate;
            this.app.state = tick(this.app.state);
            
            // Synchronize positions into state for persistence
            if (this.app.state) {
                this.app.state.spiritPos = { ...this.spiritPos };
                this.app.state.petPos = { ...this.petPos };
            }

            // Handle respawns triggered by the tick
            if (this.app.state.respawns && this.app.state.respawns.length > 0) {
                for (const key of this.app.state.respawns) {
                    if (key.startsWith('apple_')) {
                        const [_, x, y] = key.split('_');
                        this.world.mapData.tiles[y][x] = 'A';
                        addNotification(this.app.state, `A magical apple regrew!`);
                    }
                }
                this.app.state.respawns = [];
                this.world._buildTiles();
                // Ensure fog is updated for the new element if it's within vision
                this._updateFog();
            }

            saveState(this.app.state);
            this._petPip();
            this._petTriggers();
        }
    }

    onStateSync(newState) {
        if (newState.spiritPos && newState.petPos) {
            this.spiritPos = { ...newState.spiritPos };
            this.petPos = { ...newState.petPos };
            this._cam();
            this._markers();
            this._updateFog();
            this._petPip();
        }
    }
}
