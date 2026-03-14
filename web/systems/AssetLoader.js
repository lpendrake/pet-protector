export class AssetLoader {
    constructor() {
        this.textures = {};
    }

    async loadAll() {
        // We use cache-busting for assets that change frequently during dev
        const cb = `?v=${Date.now()}`;
        
        const [mapData, buddy, grassSheet] = await Promise.all([
            fetch(`./maps/world.json${cb}`).then(r => r.json()),
            PIXI.Assets.load(`./assets/buddy.avif${cb}`),
            PIXI.Assets.load(`./assets/sprite_grass_32x32.avif${cb}`)
        ]);

        this.textures.buddy = buddy;
        this.textures.grassSheet = grassSheet;
        
        return {
            mapData,
            textures: this.textures
        };
    }
}
