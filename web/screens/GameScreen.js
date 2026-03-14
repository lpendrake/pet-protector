import { Screen } from './Screen.js';
import { World, TILE_SIZE, TILE_DEFS } from '../world.js';
import { tick, addNotification, DECAY_RATES } from '../game.js';
import { saveState, CURRENT_VERSION } from '../state.js';

const { Container, Graphics, Text, Sprite, Assets } = PIXI;

const LEASH = 3;
const VISION = 3;
const CALL_STEP_MS = 1000;

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
        this.buddyTexture = null;
    }

    async enter() {
        if (!this._built) { this._build(); this._built = true; }
        if (!this._loaded) {
            // Load map and textures
            const [mapData, texture] = await Promise.all([
                this.world.load('./assets/test.json'),
                Assets.load('./assets/buddy.avif')
            ]);
            this.buddyTexture = texture;
            
            // Apply texture to markers
            if (this.petSprite) {
                this.petSprite.texture = texture;
            }
            if (this.ppipSprite) {
                this.ppipSprite.texture = texture;
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
                
                this.petPath = []; // A* path to follow
                this.petAccum = 0;
                this.tickAccum = 0;
                this.interactionLock = 0; // ms remaining in lock
                this.spiritAnchor = 'buddy'; // 'buddy' or {x, y}
                this.lockEmoji = null;
                
                this._loaded = true;
                this.ui.visible = true;
                this.app.pixiApp.stage.addChild(this.ui);
                
                this._cam();
                this._markers();
                this._updateFog();
                this._petPip();
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

        // Pet marker — Sprite
        this.petGfx = new Container();
        this.petSprite = new Sprite();
        this.petSprite.anchor.set(0.5);
        // Desired size on map is roughly 0.6 of a tile
        this.petSprite.width = TILE_SIZE * 0.6;
        this.petSprite.height = TILE_SIZE * 0.6;
        this.petGfx.addChild(this.petSprite);
        this.petGfx.addChild(this.petSprite);
        this.worldLayer.addChild(this.petGfx);

        // -- Spawns Layer (Fish, Apples, etc.) --
        this.spawnGfx = new Container();
        this.worldLayer.addChild(this.spawnGfx);

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
        const state = this.app.state;
        if (!state.seenTiles) state.seenTiles = {};

        const sx = this.spiritPos.x, sy = this.spiritPos.y;
        
        // Mark current live vision
        for (let dy = -VISION; dy <= VISION; dy++) {
            for (let dx = -VISION; dx <= VISION; dx++) {
                const tx = sx + dx, ty = sy + dy;
                if (this._dist({x: tx, y: ty}, this.spiritPos) <= VISION) {
                    if (tx >= 0 && tx < this.world.width && ty >= 0 && ty < this.world.height) {
                        state.seenTiles[`${tx},${ty}`] = true;
                    }
                }
            }
        }

        for (const cell of this.fogCells) {
            const outside = cell.x < 0 || cell.y < 0 ||
                            cell.x >= this.world.width || cell.y >= this.world.height;
            const dist = this._dist(cell, this.spiritPos);
            const isSeen = state.seenTiles[`${cell.x},${cell.y}`];

            if (outside) {
                cell.gfx.alpha = 1;
            } else if (dist <= 1) {
                cell.gfx.alpha = 0; // Live
            } else if (dist <= 2) {
                cell.gfx.alpha = 0.1; // Live
            } else if (dist <= VISION) {
                cell.gfx.alpha = 0.3; // Live
            } else if (isSeen) {
                cell.gfx.alpha = 0.75; // Stale (Memory)
            } else {
                cell.gfx.alpha = 1.0; // Hidden
            }
            
            // Interaction: Pet and Creatures only visible in live vision
            const isLive = dist <= VISION;
            const tid = this.world.getTile(cell.x, cell.y);
            const ts = this.world.tileSprites && this.world.tileSprites[cell.y] && this.world.tileSprites[cell.y][cell.x];
            
            if (ts) {
                // Background tiles always visible if seen
                ts.bg.visible = isSeen || isLive;
                ts.label.visible = isSeen || isLive;
                
                // Dim stale tiles
                ts.bg.alpha = isLive ? 1.0 : 0.4;
            }

            // Hide Buddy if out of live vision
            const petDist = this._dist(cell, { x: Math.round(this.petPos.x), y: Math.round(this.petPos.y) });
            if (petDist === 0) {
                this.petGfx.visible = isLive;
            }
        }
    }

    // ── PET PiP (bottom-left) ─────────────────────────────

    _mkPetPip() {
        const ph = this.app.pixiApp.screen.height * 0.4;
        const pw = ph * 1.5;
        this.ppip = new Container();
        this.ppip.x = 20; this.ppip.y = this.app.pixiApp.screen.height - ph - 20;
        this.ui.addChild(this.ppip);

        // -- Masked Content (Background + Buddy) --
        this.ppipContent = new Container();
        this.ppip.addChild(this.ppipContent);

        this.ppipBg = new Graphics();
        this.ppipContent.addChild(this.ppipBg);

        const mask = new Graphics();
        mask.beginFill(0xffffff);
        mask.drawRoundedRect(0, 0, pw, ph, 12);
        mask.endFill();
        this.ppipContent.addChild(mask);
        this.ppipContent.mask = mask;

        this.ppipSprite = new Sprite();
        this.ppipSprite.anchor.set(0.5);
        this.ppipSprite.x = pw / 2;
        this.ppipSprite.y = ph * 0.65;
        this.ppipContent.addChild(this.ppipSprite);

        // -- Unmasked UI (Border + Bubble) --
        const border = new Graphics();
        border.lineStyle(3, 0x7ec8e3, 0.8);
        border.drawRoundedRect(0, 0, pw, ph, 12);
        this.ppip.addChild(border);

        this.thoughtBox = new Container();
        this.thoughtBox.visible = false;
        this.ppip.addChild(this.thoughtBox);

        this.tbBg = new Graphics();
        this.thoughtBox.addChild(this.tbBg);

        this.thoughtText = new Text('', {
            fontFamily: 'Arial, sans-serif',
            fontSize: 48,
            fill: 0xffffff,
            padding: 30
        });
        // Remove anchor to use top-left positioning reliably
        this.thoughtText.x = 15;
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
        if (!this._loaded || !this.app.state) return;
        const st = this.app.state;
        const p = st.pet;

        const ph = this.app.pixiApp.screen.height * 0.4;
        const pw = ph * 1.5;

        // Diegetic Needs: if a need is high (meaning nutrition/energy/hydration is LOW), show an emoji
        let thought = '';
        if (p.nutrition < 30) thought = '🥩';
        else if (p.energy < 30) thought = '💤';
        else if (p.hydration < 30) thought = '💧';
        
        // Priority: 1. Interaction Lock, 2. Responding to Call, 3. Basic Needs
        if (this.lockEmoji) {
            thought = this.lockEmoji;
        } else if (this.petCalling) {
            thought = '🐾';
        }

        if (thought) {
            this.thoughtText.text = thought;
            this.thoughtBox.visible = true;

            // Enforce min-size (at least a square)
            const tw = Math.max(this.thoughtText.width + 30, 80);
            const th = Math.max(this.thoughtText.height + 20, 80);

            this.tbBg.clear();
            this.tbBg.lineStyle(3, 0x7ec8e3, 0.8);
            this.tbBg.beginFill(0x0d1117, 0.95);
            this.tbBg.drawRoundedRect(0, 0, tw, th, 15);
            
            // Triangle tail (centered under the bubble)
            this.tbBg.beginFill(0x0d1117, 0.95);
            this.tbBg.lineStyle(3, 0x7ec8e3, 0.8);
            const mid = tw / 2;
            this.tbBg.moveTo(mid - 10, th);
            this.tbBg.lineTo(mid, th + 15);
            this.tbBg.lineTo(mid + 10, th);
            this.tbBg.endFill();

            // Position text inside bubble
            this.thoughtText.x = (tw - this.thoughtText.width) / 2;
            this.thoughtText.y = (th - this.thoughtText.height) / 2;

            // Reposition the box to stay above buddy
            this.thoughtBox.x = pw / 2 - tw / 2 + 60; 
        } else {
            this.thoughtBox.visible = false;
        }

        this.ppipBg.clear();
        const tid = this.world.getTile?.(Math.round(this.petPos.x), Math.round(this.petPos.y));
        const tc = (tid && TILE_DEFS[tid]) ? TILE_DEFS[tid].color : 0x555555;
        
        this.ppipBg.beginFill(tc);
        this.ppipBg.drawRoundedRect(0, 0, pw, ph, 12);
        this.ppipBg.endFill();

        if (this.buddyTexture) {
            this.ppipSprite.texture = this.buddyTexture;
            // Scale buddy to fill about 75% of the PiP's height
            const scale = (ph * 0.75) / this.buddyTexture.height;
            this.ppipSprite.scale.set(scale);
        }
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
        this.cpip.visible = near;
        this.descBox.visible = near;
        if (near) {
            this.descText.text = 'A magical wolf, flowing fur made of moonlight.\nIt watches you warily...';
        }
    }

    _petTriggers() {
        if (!this._loaded || !this.app.state || this.interactionLock > 0) return;
        const state = this.app.state;
        const pet = state.pet;
        const px = Math.round(this.petPos.x);
        const py = Math.round(this.petPos.y);

        // -- DRINKING (On stream or adjacent to deep water/river) --
        const isWater = (x, y) => {
            const t = this.world.getTile(x, y);
            return t === 'W' || t === 'S' || t === 'D' || t === 'I';
        };

        const adjacentWater = isWater(px, py) || isWater(px+1, py) || isWater(px-1, py) || isWater(px, py+1) || isWater(px, py-1);

        if (adjacentWater && pet.hydration < 60) {
            pet.hydration = 100;
            this._lockBuddy(5000, '🥃');
            addNotification(state, `${pet.name} is rehydrating.`);
            return;
        }

        // -- EATING (On apple tile or fish) --
        const pt = this.world.getTile(px, py);
        
        // Check for active fish in state
        if (state.activeSpawns) {
            const fishIndex = state.activeSpawns.findIndex(s => s.x === px && s.y === py && s.type === 'fish');
            if (fishIndex !== -1 && pet.nutrition < 60) {
                const fish = state.activeSpawns[fishIndex];
                pet.nutrition = Math.min(100, pet.nutrition + 30);
                this._lockBuddy(5000, '🍴🐟');
                addNotification(state, `${pet.name} caught and ate a delicious fish!`);
                
                // Set zone on cooldown
                if (fish.zoneId) {
                    if (!state.zoneCooldowns) state.zoneCooldowns = {};
                    const zone = this.world.zones.find(z => z.id === fish.zoneId);
                    state.zoneCooldowns[fish.zoneId] = zone ? (zone.cooldown || 60) : 60;
                }
                
                state.activeSpawns.splice(fishIndex, 1);
                return;
            }
        }

        if (pt === 'A' && pet.nutrition < 60) {
            pet.nutrition = Math.min(100, pet.nutrition + 50);
            this._lockBuddy(5000, '🍴🍎');
            addNotification(state, `${pet.name} ate a magical apple!`);
            this.world.mapData.tiles[py][px] = 'G'; // Consume
            this.world._buildTiles();
            
            // Cooldown logic
            if (!state.cooldowns) state.cooldowns = {};
            const respawnTicks = Math.floor((50 / DECAY_RATES.nutrition) * 0.4);
            state.cooldowns[`apple_${px}_${py}`] = respawnTicks;
            return;
        }

        // -- SLEEPING (In cave) --
        if (pt === 'V' && pet.energy < 60) {
            pet.energy = 100;
            this._lockBuddy(5000, 'zzZ');
            addNotification(state, `${pet.name} is taking a deep nap.`);
            this._fadeEffect();
            return;
        }
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
        if (!this._loaded || !this.app.state) return;
        const state = this.app.state;
        if (!state.activeSpawns) state.activeSpawns = [];
        if (!state.zoneCooldowns) state.zoneCooldowns = {};

        // Update TTLs
        state.activeSpawns = state.activeSpawns.filter(s => {
            if (s.ttl !== undefined) {
                s.ttl -= deltaMS / 1000;
                return s.ttl > 0;
            }
            return true;
        });

        // Update Cooldowns
        for (const zid in state.zoneCooldowns) {
            if (state.zoneCooldowns[zid] > 0) {
                state.zoneCooldowns[zid] -= deltaMS / 1000;
                if (state.zoneCooldowns[zid] <= 0) delete state.zoneCooldowns[zid];
            }
        }

        // Try spawning
        for (const zone of this.world.zones) {
            if (state.zoneCooldowns[zone.id]) continue;

            const activeInZone = state.activeSpawns.filter(s => s.zoneId === zone.id).length;
            if (activeInZone >= (zone.maxActive || 1)) continue;

            // Random chance per tick (adjusted for tick rate)
            if (Math.random() < (zone.rate || 0.05)) {
                const tiles = zone.tiles || [];
                if (tiles.length === 0) continue;

                const pos = tiles[Math.floor(Math.random() * tiles.length)];
                
                // Don't spawn on top of an existing one
                if (state.activeSpawns.some(s => s.x === pos.x && s.y === pos.y)) continue;

                state.activeSpawns.push({
                    type: zone.spawns[0] || 'fish',
                    x: pos.x,
                    y: pos.y,
                    zoneId: zone.id,
                    ttl: zone.ttl || 5
                });
                
                console.log(`Spawned ${zone.spawns[0]} in ${zone.id} at ${pos.x},${pos.y}`);
            }
        }
    }

    _dist(a, b) {
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
    }

    _movePetTo(x, y) {
        const dx = x - this.petPos.x;
        const dy = y - this.petPos.y;
        this.petPos.x = x;
        this.petPos.y = y;

        if (this.spiritAnchor === 'buddy') {
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

    _runAway() {
        if (!this.app.state.pet.scareSource) return;
        const src = this.app.state.pet.scareSource;
        
        // Find adjacent tiles and pick the one farthest from source
        const neighbors = [
            { x: Math.round(this.petPos.x)+1, y: Math.round(this.petPos.y) },
            { x: Math.round(this.petPos.x)-1, y: Math.round(this.petPos.y) },
            { x: Math.round(this.petPos.x),   y: Math.round(this.petPos.y)+1 },
            { x: Math.round(this.petPos.x),   y: Math.round(this.petPos.y)-1 }
        ];

        let best = null;
        let bestDist = -1;

        for (const n of neighbors) {
            if (!this.world.isPassable(n.x, n.y, 'pet')) continue;
            const d = Math.pow(n.x - src.x, 2) + Math.pow(n.y - src.y, 2);
            if (d > bestDist) {
                bestDist = d;
                best = n;
            }
        }

        if (best) {
            this._movePetTo(best.x, best.y);
        }
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
            } else if (this._dist(this.petPos, this.spiritPos) > 0) {
                // Already at closest possible point but can't reach spirit
                this._lockBuddy(1500, '!');
                setTimeout(() => {
                    if (this.interactionLock <= 0 || this.lockEmoji === '!') {
                        this._lockBuddy(3500, '😢');
                    }
                }, 1500);
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

    update(deltaMS) {
        if (!this._loaded || !this.app.state) return;

        // Pet travelling to spirit when called
        if (this.interactionLock > 0) {
            this.interactionLock -= deltaMS;
            if (this.interactionLock <= 0) {
                this.interactionLock = 0;
                this.lockEmoji = null;
                this._petPip();
            }
            return; // No movement while locked
        }

        if (this.petCalling && this.petPath.length > 0) {
            this.petAccum += deltaMS;
            if (this.petAccum >= CALL_STEP_MS) {
                this.petAccum -= CALL_STEP_MS;
                
                const next = this.petPath.shift();
                this._movePetTo(next.x, next.y);

                if (this.petPath.length === 0) {
                    this.petCalling = false;
                    
                    if (this.partialPath) {
                        this.partialPath = false;
                        // Start failure sequence
                        this._lockBuddy(1500, '!');
                        setTimeout(() => {
                            if (this.interactionLock <= 0 || this.lockEmoji === '!') {
                                this._lockBuddy(3500, '😢');
                            }
                        }, 1500);
                    } else {
                        // Reached spirit! Heart check (every 2m)
                        const now = Date.now();
                        const lastHeart = this.app.state.lastHeartTime || 0;
                        if (now - lastHeart > 120000) {
                            this.app.state.lastHeartTime = now;
                            this._lockBuddy(3000, '❤️');
                        }
                    }

                    this._petPip();
                }
            }
        }

        // Fear Mechanic
        if (this.app.state.pet.scaredTimer > 0) {
            this.app.state.pet.scaredTimer -= deltaMS;
            if (this.app.state.pet.scaredTimer <= 0) {
                this.app.state.pet.scaredTimer = 0;
                addNotification(this.app.state, `${this.app.state.pet.name} has calmed down.`);
                this._petPip();
            } else {
                // Bolt away!
                this.petAccum += deltaMS;
                if (this.petAccum >= CALL_STEP_MS * 0.5) { // Run faster!
                    this.petAccum = 0;
                    this._runAway();
                }
            }
        }
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
