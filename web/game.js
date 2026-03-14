export const DECAY_RATES = {
    nutrition: 2.5,
    energy: 2.5,
    hydration: 2.5
};

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

export function tick(state) {
    const pet = state.pet;

    // Decay rates are per tick
    pet.nutrition = clamp(pet.nutrition - DECAY_RATES.nutrition, 0, 100);
    pet.energy = clamp(pet.energy - DECAY_RATES.energy, 0, 100);
    pet.hydration = clamp(pet.hydration - DECAY_RATES.hydration, 0, 100);

    state.lastTick = Date.now();

    const a = state.alerts || {};

    // Nutrition alerts
    if (pet.nutrition < 40 && !a.nut40) {
        addNotification(state, `${pet.name} is feeling hungry.`);
        a.nut40 = true;
    } else if (pet.nutrition >= 40) { a.nut40 = false; }

    if (pet.nutrition < 10 && !a.nut10) {
        addNotification(state, `${pet.name} is STARVING!`);
        a.nut10 = true;
    } else if (pet.nutrition >= 10) { a.nut10 = false; }

    // Hydration alerts
    if (pet.hydration < 40 && !a.hyd40) {
        addNotification(state, `${pet.name} is thirsty.`);
        a.hyd40 = true;
    } else if (pet.hydration >= 40) { a.hyd40 = false; }

    // Energy alerts
    if (pet.energy < 20 && !a.en20) {
        addNotification(state, `${pet.name} is sleepy...`);
        a.en20 = true;
    } else if (pet.energy >= 20) { a.en20 = false; }

    state.alerts = a;
    
    // Process cooldowns
    if (state.cooldowns) {
        for (const key in state.cooldowns) {
            state.cooldowns[key]--;
            if (state.cooldowns[key] <= 0) {
                delete state.cooldowns[key];
                if (!state.respawns) state.respawns = [];
                state.respawns.push(key);
            }
        }
    }
    
    return state;
}



export function addEvent(state, message) {
    if (!state.events) state.events = [];
    const time = new Date().toLocaleTimeString();
    state.events.unshift(`[${time}] ${message}`);
    if (state.events.length > 50) {
        state.events = state.events.slice(0, 50);
    }
}

export function addNotification(state, message) {
    if (!state.notifications) state.notifications = [];
    const time = new Date().toLocaleTimeString();
    state.notifications.unshift(`[${time}] ${message}`);
    if (state.notifications.length > 20) {
        state.notifications = state.notifications.slice(0, 20);
    }
}

export function feed(state, option) {
    let msg = 'Fed the pet.';
    let val = 20;
    if (option === 'apple') { val = 15; msg = 'Fed an Apple.'; }
    else if (option === 'steak') { val = 30; msg = 'Fed a Steak!'; }
    state.pet.nutrition = clamp(state.pet.nutrition + val, 0, 100);
    addEvent(state, msg);
    return `Yum! (${option || 'Food'})`;
}

export function play(state, option) {
    let msg = 'Played with pet.';
    let energyCost = 10;
    if (option === 'ball') { msg = 'Threw the ball.'; energyCost = 15; }
    else if (option === 'wrestle') { msg = 'Wrestled!'; energyCost = 25; }
    state.pet.energy = clamp(state.pet.energy - energyCost, 0, 100);
    addEvent(state, msg);
    return `Fun! (${option || 'Play'})`;
}

export function sleep(state) {
    state.pet.energy = 100;
    addEvent(state, 'Pet slept.');
    return 'The pet had a power nap. Energy restored.';
}
