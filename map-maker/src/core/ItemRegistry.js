export const CATEGORIES = {
    PICKUP: 'pickup',
    DECORATION: 'decoration'
};

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
                category: CATEGORIES.DECORATION
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
                category: CATEGORIES.DECORATION
            }
        };
    }

    getItem(id) {
        return this.items[id];
    }

    getItemsByCategory(category) {
        return Object.values(this.items).filter(i => i.category === category);
    }

    getAllItems() {
        return Object.values(this.items);
    }
}

export const ItemRegistryInstance = new ItemRegistry();
