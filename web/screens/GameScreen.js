import { Screen } from './Screen.js';
import { World, TILE_SIZE, TILE_DEFS } from '../world.js';
import { tick, addNotification, DECAY_RATES } from '../game.js';
import { saveState, CURRENT_VERSION } from '../state.js';
import { PetPip } from '../ui/PetPip.js';
import { ZoneManager } from '../systems/ZoneManager.js';
import { VisionSystem } from '../systems/VisionSystem.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { PetMovementSystem } from '../systems/PetMovementSystem.js';
import { AssetLoader } from '../systems/AssetLoader.js';

const { Container, Graphics, Text, Sprite, Assets, AnimatedSprite, Texture, Rectangle } = PIXI;

const LEASH = 3;
const VISION = 3;

export class GameScreen extends Screen {
    constructor(app) {
        super(app);
        this.world = new World();
        this.spiritPos = { x: 0, y: 0 };
        this.petPos = { x: 0, y: 0 };
        this.tickAccum = 0;
        this.petCalling = false;
        this.showScene = false;
        this._built = false;
        this._loaded = false;
        this.buddyTexture = null;
        this.zoneManager = new ZoneManager(this.world);
        this.interactionSystem = new InteractionSystem(this.world);
        this.petMovementSystem = new PetMovementSystem(this.world);
        this.assetLoader = new AssetLoader();
        
        this.petPath = [];
        this.petAccum = 0;
        this.interactionLock = 0;
        this.spiritAnchor = 'buddy';
        this.lockEmoji = null;
        this.partialPath = false;
    }

    async enter() {
        if (!this._built) { this._build(); this._built = true; }
        if (!this._loaded) {
            const { mapData, textures } = await this.assetLoader.loadAll();
            
            this.world.init(mapData);
            this.buddyTexture = textures.buddy;
            this.petPip.setupGrassFromSheet(textures.grassSheet, 32);
            
            // Apply texture to markers
            if (this.petSprite) {
                this.petSprite.texture = this.buddyTexture;
            }

            const st = this.app.state;
            console.log('GameScreen: Enter. App state:', st);
            
            if (st && st.spiritPos && st.petPos) {
                console.log('GameScreen: Resuming from saved positions:', st.spiritPos, st.petPos);
                this.spiritPos = { ...st.spiritPos };
                this.petPos = { ...st.petPos };
            } else {
                this.spiritPos = this.world.startPosition;
                this.petPos = this.app.state.petPos || { ...this.spiritPos };
            }

            this.ui.visible = true;
            this.app.pixiApp.stage.addChild(this.ui);

            this.visionSystem = new VisionSystem(this.world, this.worldLayer, VISION);
            this.worldLayer.addChildAt(this.world.container, 0);
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

        // Pet marker — Sprite
        this.petGfx = new Container();
        this.petSprite = new Sprite();
        this.petSprite.anchor.set(0.5);
        // Desired size on map is roughly 0.6 of a tile
        this.petSprite.width = TILE_SIZE * 0.6;
        this.petSprite.height = TILE_SIZE * 0.6;
        this.petGfx.addChild(this.petSprite);
        this.worldLayer.addChild(this.petGfx);

        // -- Spawns Layer (Fish, Apples, etc.) --
        this.spawnGfx = new Container();
        this.worldLayer.addChild(this.spawnGfx);

        // Fixed UI layer
        this.ui = new Container();
        this.container.addChild(this.ui);

        this.petPip = new PetPip(this.ui, this.app.pixiApp.screen.width, this.app.pixiApp.screen.height);
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

    _updateFog() {
        if (this.visionSystem) {
            this.visionSystem.update(this.app.state, this.spiritPos, this.petPos, this.petGfx);
        }
    }

    _cam() {
        this.worldLayer.x = this.app.pixiApp.screen.width / 2 - (this.petPos.x + 0.5) * TILE_SIZE;
        this.worldLayer.y = this.app.pixiApp.screen.height / 2 - (this.petPos.y + 0.5) * TILE_SIZE;
    }

    _markers() {
        this.spiritGfx.x = (this.spiritPos.x + 0.5) * TILE_SIZE;
        this.spiritGfx.y = (this.spiritPos.y + 0.5) * TILE_SIZE;
        this.petGfx.x = (this.petPos.x + 0.5) * TILE_SIZE;
        this.petGfx.y = (this.petPos.y + 0.5) * TILE_SIZE;

        // Draw Spawns
        this.spawnGfx.removeChildren();
        if (this.app.state && this.app.state.activeSpawns) {
            for (const s of this.app.state.activeSpawns) {
                const marker = new Container();
                marker.x = (s.x + 0.5) * TILE_SIZE;
                marker.y = (s.y + 0.5) * TILE_SIZE;

                const emoji = s.type === 'fish' ? '🐟' : '🍎';
                const txt = new Text(emoji, { fontSize: 32 });
                txt.anchor.set(0.5);
                marker.addChild(txt);

                // Hide if out of vision
                const dist = this._dist({x: s.x, y: s.y}, this.spiritPos);
                marker.visible = dist <= VISION;
                
                this.spawnGfx.addChild(marker);
            }
        }
    }

    _petPip() {
        if (this.petPip) {
            this.petPip.update(
                this.app.state,
                this.petPos,
                this.world,
                this.buddyTexture,
                this.lockEmoji,
                this.petCalling
            );
        }
    }

    _spiritTriggers() {
        this.interactionSystem.updateSpirit(this.spiritPos, {
            showMural: () => {
                if (!this.showScene) {
                    this.showScene = true;
                    this.spip.visible = true;
                }
            }
        });
    }

    _petTriggers() {
        this.interactionSystem.updatePet(this.app.state, this.petPos, this.interactionLock, {
            lockBuddy: (d, e) => this._lockBuddy(d, e),
            fadeEffect: () => this._fadeEffect()
        });
    }

    _lockBuddy(duration, emoji) {
        this.interactionLock = duration;
        this.lockEmoji = emoji;
        this.petCalling = false;
        this.petPath = [];
        this._petPip();
    }

    async _fadeEffect() {
        const overlay = new Graphics();
        overlay.beginFill(0x000000);
        overlay.drawRect(0, 0, this.app.pixiApp.screen.width, this.app.pixiApp.screen.height);
        overlay.endFill();
        overlay.alpha = 0;
        this.ui.addChild(overlay);

        // Fade out
        for (let i = 0; i <= 10; i++) {
            overlay.alpha = i / 10;
            await new Promise(r => setTimeout(r, 100));
        }
        await new Promise(r => setTimeout(r, 1000));
        // Fade in
        for (let i = 10; i >= 0; i--) {
            overlay.alpha = i / 10;
            await new Promise(r => setTimeout(r, 100));
        }
        this.ui.removeChild(overlay);
    }

    _updateZones(deltaMS) {
        this.zoneManager.update(this.app.state, deltaMS);
    }

    _dist(a, b) {
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
    }

    _getNearestAdjacent(target, from) {
        const neighbors = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                neighbors.push({ x: target.x + dx, y: target.y + dy });
            }
        }
        
        let best = null;
        let minDist = Infinity;
        
        for (const n of neighbors) {
            if (!this.world.isPassable(n.x, n.y, 'pet')) continue;
            const d = this._dist(n, from);
            if (d < minDist) {
                minDist = d;
                best = n;
            }
        }
        return best;
    }

    _movePetTo(x, y, skipMirror = false) {
        const dx = x - this.petPos.x;
        const dy = y - this.petPos.y;
        this.petPos.x = x;
        this.petPos.y = y;

        if (!skipMirror && this.spiritAnchor === 'buddy') {
            this.spiritPos.x += dx;
            this.spiritPos.y += dy;
        }

        if (this.app.state) {
            this.app.state.petPos = { ...this.petPos };
            this.app.state.spiritPos = { ...this.spiritPos };
            saveState(this.app.state);
        }

        this._markers();
        this._petPip();
        this._cam();
        this._petTriggers();
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
            if (this.interactionLock > 0) return;
            
            const path = this.world.getPath(this.petPos, this.spiritPos, 'pet');
            if (path && path.length > 0) {
                this.petPath = path;
                this.petCalling = true;
                
                // Check if path actually reaches the spirit
                const last = path[path.length - 1];
                this.partialPath = (last.x !== this.spiritPos.x || last.y !== this.spiritPos.y);
                
                this._petPip();
            } else {
                const dist = this._dist(this.petPos, this.spiritPos);
                if (dist > 0) {
                    // Already at closest possible point but can't reach spirit
                    this._lockBuddy(1500, '!');
                    setTimeout(() => {
                        if (this.interactionLock <= 0 || this.lockEmoji === '!') {
                            this._lockBuddy(3500, '😢');
                        }
                    }, 1500);
                } else {
                    // Already at spirit - Heart or Paw reaction
                    const now = Date.now();
                    const lastHeart = this.app.state.lastHeartTime || 0;
                    if (now - lastHeart > 120000) {
                        this.app.state.lastHeartTime = now;
                        this._lockBuddy(3000, '❤️');
                    } else {
                        this._lockBuddy(1000, '🐾');
                    }
                }
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
        if (!this.world.isPassable(nx, ny, 'spirit')) return;

        // Automatic Follow Mechanic
        const nextDist = this._dist({ x: nx, y: ny }, this.petPos);
        if (nextDist >= 3) {
            if (this.app.state && this.app.state.pet && this.app.state.pet.scaredTimer <= 0) {
                const adj = this._getNearestAdjacent({ x: nx, y: ny }, this.petPos);
                if (adj) {
                    const path = this.world.getPath(this.petPos, adj, 'pet');
                    if (path && path.length > 0) {
                        this.petPath = path;
                        this.petCalling = false; // Auto-follow doesn't trigger "calling" state
                        this._petPip();
                    }
                }
            }
        }

        if (this._dist({ x: nx, y: ny }, this.petPos) > LEASH) return;

        this.spiritPos.x = nx;
        this.spiritPos.y = ny;
        if (this.app.state) {
            this.app.state.spiritPos = { ...this.spiritPos };
            this.app.state.petPos = { ...this.petPos }; 
            saveState(this.app.state);
        }

        this._syncSpiritWithAnchor(); // Move anchor if needed
        this._cam();
        this._markers();
        this._updateFog();
        this._spiritTriggers();
        this._petTriggers();
    }

    _syncSpiritWithAnchor() {
        if (this.spiritAnchor === 'buddy') {
            // This is handled in the pet movement loop
        }
    }

    // ── LOOP ──────────────────────────────────────────────

    _updateMovement(deltaMS) {
        this.petMovementSystem.update(deltaMS, {
            state: this.app.state,
            petPos: this.petPos,
            petPath: this.petPath,
            petCalling: this.petCalling,
            interactionLock: this.interactionLock,
            callbacks: {
                movePetTo: (x, y, skipMirror) => this._movePetTo(x, y, skipMirror),
                onRepaintPip: () => this._petPip(),
                onPathComplete: () => {
                    const wasCalling = this.petCalling;
                    this.petCalling = false;
                    if (wasCalling) {
                        if (this.partialPath) {
                            this.partialPath = false;
                            this._lockBuddy(1500, '!');
                            setTimeout(() => {
                                if (this.interactionLock <= 0 || this.lockEmoji === '!') {
                                    this._lockBuddy(3500, '😢');
                                }
                            }, 1500);
                        } else {
                            const now = Date.now();
                            const lastHeart = this.app.state.lastHeartTime || 0;
                            if (now - lastHeart > 120000) {
                                this.app.state.lastHeartTime = now;
                                this._lockBuddy(3000, '❤️');
                            } else {
                                this._lockBuddy(1000, '🐾');
                            }
                        }
                    }
                    this._petPip();
                }
            }
        });
    }

    update(deltaMS) {
        if (!this._loaded || !this.app.state) return;

        // Interaction Lock decay
        if (this.interactionLock > 0) {
            this.interactionLock -= deltaMS;
            if (this.interactionLock <= 0) {
                this.interactionLock = 0;
                this.lockEmoji = null;
                this._petPip();
            }
        }

        this._updateMovement(deltaMS);
        // Game tick
        this.tickAccum += deltaMS;
        const rate = this.app.state.settings?.tickRate || 3000;
        if (this.tickAccum >= rate) {
            this.tickAccum -= rate;
            this.app.state = tick(this.app.state);
            
            this._updateZones(rate); // Update spawning logic every tick

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
