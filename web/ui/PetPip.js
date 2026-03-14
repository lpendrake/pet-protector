const { Container, Graphics, Text, Sprite, AnimatedSprite } = PIXI;
import { TILE_DEFS } from '../world.js';

export class PetPip {
    constructor(parentContainer, screenWidth, screenHeight) {
        this.parent = parentContainer;
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;

        this.ph = screenHeight * 0.4;
        this.pw = this.ph * 1.5;

        this.container = new Container();
        this.container.x = 20;
        this.container.y = screenHeight - this.ph - 20;
        this.parent.addChild(this.container);

        this._build();
    }

    _build() {
        // -- Masked Content (Background + Buddy) --
        this.content = new Container();
        this.container.addChild(this.content);

        this.bg = new Graphics();
        this.content.addChild(this.bg);

        const mask = new Graphics();
        mask.beginFill(0xffffff);
        mask.drawRoundedRect(0, 0, this.pw, this.ph, 12);
        mask.endFill();
        this.content.addChild(mask);
        this.content.mask = mask;

        this.buddySprite = new Sprite();
        this.buddySprite.anchor.set(0.5);
        this.buddySprite.x = this.pw / 2;
        this.buddySprite.y = this.ph * 0.65;

        // -- Grass Layers --
        this.grassBg = new Container();
        this.grassFg = new Container();
        
        this.content.addChild(this.grassBg);
        this.content.addChild(this.buddySprite);
        this.content.addChild(this.grassFg);

        // -- Unmasked UI (Border + Bubble) --
        const border = new Graphics();
        border.lineStyle(3, 0x7ec8e3, 0.8);
        border.drawRoundedRect(0, 0, this.pw, this.ph, 12);
        this.container.addChild(border);

        this.thoughtBox = new Container();
        this.thoughtBox.visible = false;
        this.container.addChild(this.thoughtBox);

        this.tbBg = new Graphics();
        this.thoughtBox.addChild(this.tbBg);

        this.thoughtText = new Text('', {
            fontFamily: 'Arial, sans-serif',
            fontSize: 48,
            fill: 0xffffff,
            padding: 30
        });
        this.thoughtText.x = 15;
        this.thoughtText.y = 10;
        this.thoughtBox.addChild(this.thoughtText);
    }

    setupGrass(textures) {
        if (!textures || !textures.length) return;
        
        // Ping-pong frames: 1 -> 2 -> 3 -> 2
        const bounceTextures = [textures[0], textures[1], textures[2], textures[1]];

        this.grassBg.removeChildren();
        this.grassFg.removeChildren();

        const count = 12; // Bring back the density
        const scaleBase = (this.ph * 0.1) / 32; 

        for (let i = 0; i < count; i++) {
            // Random horizontal scattering
            const rx = Math.random() * this.pw;
            
            // BACKGROUND CLUMPS
            const bg = new AnimatedSprite(bounceTextures);
            // ~5s cycle (4 frames / 300 ticks = 0.0133)
            bg.animationSpeed = 0.01 + Math.random() * 0.005;
            
            // Height variance for background (0.7 to 0.8 range)
            const bgYFactor = 0.7 + Math.random() * 0.1;
            bg.y = this.ph * bgYFactor;
            bg.x = rx;
            
            // Smaller as they go "up"
            const bgScale = scaleBase * (0.8 + (bgYFactor - 0.7) * 2);
            bg.scale.set(bgScale);
            
            bg.anchor.set(0.5, 1);
            bg.alpha = 0.5;
            bg.gotoAndPlay(Math.floor(Math.random() * 4));
            this.grassBg.addChild(bg);

            // FOREGROUND CLUMPS
            const fg = new AnimatedSprite(bounceTextures);
            fg.animationSpeed = 0.01 + Math.random() * 0.005;
            
            // Height variance for foreground (0.85 to 0.98 range)
            const fgYFactor = 0.85 + Math.random() * 0.13;
            fg.y = this.ph * fgYFactor;
            fg.x = (rx + this.pw / 2) % this.pw; // Offset slightly from bg x
            
            // Larger scale for foreground
            const fgScale = scaleBase * (1.2 + (fgYFactor - 0.85) * 3);
            fg.scale.set(fgScale);
            
            fg.anchor.set(0.5, 1);
            fg.gotoAndPlay(Math.floor(Math.random() * 4));
            this.grassFg.addChild(fg);
        }
    }

    update(state, petPos, world, buddyTexture, lockEmoji, petCalling) {
        if (!state || !state.pet) return;
        const p = state.pet;

        // 1. Thought Logic
        let thought = '';
        if (p.nutrition < 30) thought = '🥩';
        else if (p.energy < 30) thought = '💤';
        else if (p.hydration < 30) thought = '💧';
        
        if (lockEmoji) {
            thought = lockEmoji;
        } else if (petCalling) {
            thought = '🐾';
        }

        if (thought) {
            this.thoughtText.text = thought;
            this.thoughtBox.visible = true;
            const tw = Math.max(this.thoughtText.width + 30, 80);
            const th = Math.max(this.thoughtText.height + 20, 80);

            this.tbBg.clear();
            this.tbBg.lineStyle(3, 0x7ec8e3, 0.8);
            this.tbBg.beginFill(0x0d1117, 0.95);
            this.tbBg.drawRoundedRect(0, 0, tw, th, 15);
            
            this.tbBg.beginFill(0x0d1117, 0.95);
            this.tbBg.lineStyle(3, 0x7ec8e3, 0.8);
            const mid = tw / 2;
            this.tbBg.moveTo(mid - 10, th);
            this.tbBg.lineTo(mid, th + 15);
            this.tbBg.lineTo(mid + 10, th);
            this.tbBg.endFill();

            this.thoughtText.x = (tw - this.thoughtText.width) / 2;
            this.thoughtText.y = (th - this.thoughtText.height) / 2;
            this.thoughtBox.x = this.pw / 2 - tw / 2 + 60; 
        } else {
            this.thoughtBox.visible = false;
        }

        // 2. Background Tint & Biome FX
        this.bg.clear();
        const tid = world.getTile?.(Math.round(petPos.x), Math.round(petPos.y));
        const tc = (tid && TILE_DEFS[tid]) ? TILE_DEFS[tid].color : 0x555555;
        
        this.bg.beginFill(tc);
        this.bg.drawRoundedRect(0, 0, this.pw, this.ph, 12);
        this.bg.endFill();

        const isGrass = tid === 'G';
        this.grassBg.visible = isGrass;
        this.grassFg.visible = isGrass;

        // 3. Buddy Sprite
        if (buddyTexture) {
            this.buddySprite.texture = buddyTexture;
            const scale = (this.ph * 0.75) / buddyTexture.height;
            this.buddySprite.scale.set(scale);
        }
    }
}
