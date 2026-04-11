/**
 * Item categories — determines which tile layer an item occupies.
 *   PICKUP:     consumable items the pet can interact with (placed on the 'pickup' layer)
 *   DECORATION: permanent scenery objects (placed on the 'decoration' layer)
 */
export const CATEGORIES = {
    PICKUP: 'pickup',
    DECORATION: 'decoration'
};

/**
 * Registry of all placeable items (pickups and decorations).
 *
 * Currently hardcoded. See implementation_plan.md for the planned migration
 * to a data-driven item_defs.json (analogous to tile_defs.json).
 *
 * Item `effects` apply when the pet interacts with the item in-game.
 * Keys map to the pet's stats: `nutrition`, `hydration`, `energy`.
 * Values are percentage points (0–100 scale) added to the corresponding stat.
 * Negative values are allowed (e.g. an apple reducing hydration slightly).
 */
export class ItemRegistry {
    constructor() {
        this.items = {
            'apple': {
                id: 'apple',
                name: 'Apple',
                emoji: '🍎',
                category: CATEGORIES.PICKUP,
                effects: { nutrition: 20, hydration: -5 }
            },
            'fish': {
                id: 'fish',
                name: 'Fish',
                emoji: '🐟',
                category: CATEGORIES.PICKUP,
                effects: { nutrition: 30, energy: 10 }
            },
            'tree_oak': {
                id: 'tree_oak',
                name: 'Oak Tree',
                emoji: '🌳',
                category: CATEGORIES.DECORATION,
                sprite: { file: 'Objects_separated/Tree1.png' }
            },
            'table_wood': {
                id: 'table_wood',
                name: 'Wooden Table',
                emoji: '🪑',
                category: CATEGORIES.DECORATION
            },
            'rock_large': {
                id: 'rock_large',
                name: 'Large Rock',
                emoji: '🪨',
                category: CATEGORIES.DECORATION,
                sprite: { file: 'Objects_separated/Rpck_grass1.png' }
            }
        };
    }

    /**
     * @param {string} id
     * @returns {Object|undefined}
     */
    getItem(id) {
        return this.items[id];
    }

    /**
     * @param {string} category - CATEGORIES.PICKUP or CATEGORIES.DECORATION
     */
    getItemsByCategory(category) {
        return Object.values(this.items).filter(i => i.category === category);
    }

    /** Returns all items regardless of category. */
    getAllItems() {
        return Object.values(this.items);
    }
}

/** Singleton — import this, not the class directly. */
export const ItemRegistryInstance = new ItemRegistry();
