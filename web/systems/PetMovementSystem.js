import { saveState } from '../state.js';
import { addNotification } from '../game.js';

export class PetMovementSystem {
    constructor(world) {
        this.world = world;
        this.petAccum = 0;
        this.CALL_STEP_MS = 1000; 
    }

    update(deltaMS, context) {
        const { state, petPos, petPath, petCalling, interactionLock, partialPath, callbacks } = context;

        if (!state) return;
        if (interactionLock > 0) return;

        // 1. Fear Mechanic
        if (state.pet.scaredTimer > 0) {
            state.pet.scaredTimer -= deltaMS;
            if (state.pet.scaredTimer <= 0) {
                state.pet.scaredTimer = 0;
                addNotification(state, `${state.pet.name} has calmed down.`);
                callbacks.onRepaintPip();
            } else {
                this.petAccum += deltaMS;
                if (this.petAccum >= this.CALL_STEP_MS * 0.5) {
                    this.petAccum -= this.CALL_STEP_MS * 0.5;
                    this._runAway(petPos, state.pet.scareSource, callbacks.movePetTo);
                }
            }
            return;
        }

        // 2. Traveling (manual call or auto-follow)
        if (petPath && petPath.length > 0) {
            this.petAccum += deltaMS;
            if (this.petAccum >= this.CALL_STEP_MS) {
                this.petAccum -= this.CALL_STEP_MS;
                
                const next = petPath.shift();
                callbacks.movePetTo(next.x, next.y, true);

                if (petPath.length === 0) {
                    callbacks.onPathComplete();
                }
            }
        }
    }

    _runAway(petPos, src, movePetTo) {
        if (!src) return;
        const neighbors = [
            { x: Math.round(petPos.x)+1, y: Math.round(petPos.y) },
            { x: Math.round(petPos.x)-1, y: Math.round(petPos.y) },
            { x: Math.round(petPos.x),   y: Math.round(petPos.y)+1 },
            { x: Math.round(petPos.x),   y: Math.round(petPos.y)-1 }
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
            movePetTo(best.x, best.y);
        }
    }
}
