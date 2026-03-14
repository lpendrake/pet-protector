import { addNotification, DECAY_RATES } from '../game.js';

export class InteractionSystem {
    constructor(world) {
        this.world = world;
    }

    updatePet(state, petPos, interactionLock, callbacks) {
        if (!state || interactionLock > 0) return;
        const pet = state.pet;
        const px = Math.round(petPos.x);
        const py = Math.round(petPos.y);

        // 1. DRINKING
        const isWater = (x, y) => {
            const t = this.world.getTile(x, y);
            return t === 'W' || t === 'S' || t === 'D' || t === 'I';
        };
        const adjacentWater = isWater(px, py) || isWater(px+1, py) || isWater(px-1, py) || isWater(px, py+1) || isWater(px, py-1);

        if (adjacentWater && pet.hydration < 60) {
            pet.hydration = 100;
            callbacks.lockBuddy(5000, '🥃');
            addNotification(state, `${pet.name} is rehydrating.`);
            return;
        }

        // 2. EATING
        const pt = this.world.getTile(px, py);
        if (state.activeSpawns) {
            const fishIndex = state.activeSpawns.findIndex(s => s.x === px && s.y === py && s.type === 'fish');
            if (fishIndex !== -1 && pet.nutrition < 60) {
                const fish = state.activeSpawns[fishIndex];
                pet.nutrition = Math.min(100, pet.nutrition + 30);
                callbacks.lockBuddy(5000, '🍴🐟');
                addNotification(state, `${pet.name} caught and ate a delicious fish!`);
                
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
            callbacks.lockBuddy(5000, '🍴🍎');
            addNotification(state, `${pet.name} ate a magical apple!`);
            this.world.mapData.tiles[py][px] = 'G'; // Consume
            this.world._buildTiles();
            
            if (!state.cooldowns) state.cooldowns = {};
            const respawnTicks = Math.floor((50 / DECAY_RATES.nutrition) * 0.4);
            state.cooldowns[`apple_${px}_${py}`] = respawnTicks;
            return;
        }

        // 3. SLEEPING
        if (pt === 'V' && pet.energy < 60) {
            pet.energy = 100;
            callbacks.lockBuddy(5000, 'zzZ');
            addNotification(state, `${pet.name} is taking a deep nap.`);
            callbacks.fadeEffect();
            return;
        }
    }

    updateSpirit(spiritPos, callbacks) {
        const t = this.world.getTile(spiritPos.x, spiritPos.y);
        if (t === 'R') {
            callbacks.showMural();
        }
        // Wolf proximity logic could go here too
    }
}
