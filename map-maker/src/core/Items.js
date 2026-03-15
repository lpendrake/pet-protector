export const ITEM_TYPES = {
    NUTRITION: 'nutrition',
    HYDRATION: 'hydration',
    ENERGY: 'energy'
};

export class ItemRegistry {
    constructor() {
        this.items = {
            'apple': {
                id: 'apple',
                name: 'Apple',
                emoji: '🍎',
                effects: {
                    [ITEM_TYPES.NUTRITION]: 20,
                    [ITEM_TYPES.HYDRATION]: -5
                }
            },
            'fish': {
                id: 'fish',
                name: 'Fish',
                emoji: '🐟',
                effects: {
                    [ITEM_TYPES.NUTRITION]: 30,
                    [ITEM_TYPES.ENERGY]: 10
                }
            }
        };
    }

    getItem(id) {
        return this.items[id];
    }

    addItem(item) {
        this.items[item.id] = item;
    }

    getAllItems() {
        return Object.values(this.items);
    }
}

export const Registry = new ItemRegistry();
