const STORAGE_KEY = 'pet-protector';
export const CURRENT_VERSION = 1;

const defaultState = {
    pet: {
        name: 'Buddy',
        type: 'Bear',
        developmentStage: 1,
        nutrition: 100,
        energy: 100,
        hydration: 100,
        scaredTimer: 0,
        scareSource: null
    },
    settings: {
        tickRate: 3000,
        notifications: true
    },
    events: [],
    notifications: [],
    alerts: {},
    lastTick: Date.now(),
    spiritPos: null,
    petPos: null,
    version: CURRENT_VERSION,
    seenTiles: {}
};

export function loadState() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return null;
        const loaded = JSON.parse(data);
        console.log('State: Loaded from storage', loaded);

        // Version check
        if (loaded.version > CURRENT_VERSION) {
            alert('Your save file is from a newer version of the game. Please refresh the page to update!');
            return null; 
        }

        const merged = { ...defaultState, ...loaded };
        merged.pet = { ...defaultState.pet, ...loaded.pet };
        merged.settings = { ...defaultState.settings, ...loaded.settings };
        
        // Auto-upgrade version if it's older
        if (!merged.version || merged.version < CURRENT_VERSION) {
            merged.version = CURRENT_VERSION;
        }

        return merged;
    } catch (err) {
        console.error('Error loading state:', err);
        return null;
    }
}

export function saveState(state) {
    if (document.hidden) return; // Never save from a background tab
    
    try {
        // Validation: don't save if position is clearly broken/reset unless it's a new state
        if (state.spiritPos === null && state.petPos === null && localStorage.getItem(STORAGE_KEY)) {
            console.warn('State: Attempted to save null positions over existing data. Aborting save.');
            return;
        }
        
        console.log('State: Saving to storage', state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
        console.error('Error saving state:', err);
    }
}

// Tab synchronization
window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
        console.log('State: Detected change in another tab. Consider refreshing or auto-syncing.');
        // We won't force a reload/sync here to avoid jarring the user, 
        // but we log it for debug. In a fuller engine, we'd update this.app.state.
    }
});

export function createNewState(name, type) {
    const newState = JSON.parse(JSON.stringify(defaultState));
    newState.pet.name = name || 'Buddy';
    newState.pet.type = type || 'Bear';
    newState.lastTick = Date.now();
    saveState(newState);
    return newState;
}
