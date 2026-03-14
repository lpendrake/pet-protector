export class SpriteUtils {
    /**
     * Slices a horizontal sprite sheet into an array of textures.
     * @param {PIXI.Texture} baseTexture - The source texture.
     * @param {number} frameWidth - Width of each frame.
     * @param {number} frameHeight - Height of each frame (defaults to frameWidth).
     * @returns {PIXI.Texture[]} Array of sliced textures.
     */
    static sliceHorizontal(baseTexture, frameWidth, frameHeight = null) {
        if (!baseTexture) return [];
        const h = frameHeight || frameWidth;
        const w = frameWidth;
        const cols = Math.floor(baseTexture.width / w);
        const textures = [];

        for (let i = 0; i < cols; i++) {
            const rect = new PIXI.Rectangle(i * w, 0, w, h);
            textures.push(new PIXI.Texture(baseTexture.baseTexture, rect));
        }
        return textures;
    }
}
