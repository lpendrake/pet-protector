export class ZoneManager {
    constructor(world) {
        this.world = world;
    }

    update(state, deltaMS) {
        if (!state) return;
        if (!state.activeSpawns) state.activeSpawns = [];
        if (!state.zoneCooldowns) state.zoneCooldowns = {};

        // 1. Update TTLs
        state.activeSpawns = state.activeSpawns.filter(s => {
            if (s.ttl !== undefined) {
                s.ttl -= deltaMS / 1000;
                return s.ttl > 0;
            }
            return true;
        });

        // 2. Update Cooldowns
        for (const zid in state.zoneCooldowns) {
            if (state.zoneCooldowns[zid] > 0) {
                state.zoneCooldowns[zid] -= deltaMS / 1000;
                if (state.zoneCooldowns[zid] <= 0) delete state.zoneCooldowns[zid];
            }
        }

        // 3. Try Spawning
        for (const zone of this.world.zones) {
            if (state.zoneCooldowns[zone.id]) continue;

            const activeInZone = state.activeSpawns.filter(s => s.zoneId === zone.id).length;
            if (activeInZone >= (zone.maxActive || 1)) continue;

            // Random chance per update call
            if (Math.random() < (zone.rate || 0.05)) {
                const tiles = zone.tiles || [];
                if (tiles.length === 0) continue;

                const pos = tiles[Math.floor(Math.random() * tiles.length)];
                
                // Don't spawn on top of an existing one
                if (state.activeSpawns.some(s => s.x === pos.x && s.y === pos.y)) continue;

                state.activeSpawns.push({
                    type: zone.spawns[0] || 'fish',
                    x: pos.x,
                    y: pos.y,
                    zoneId: zone.id,
                    ttl: zone.ttl || 5
                });
                
                console.log(`ZoneManager: Spawned ${zone.spawns[0]} in ${zone.id} at ${pos.x},${pos.y}`);
            }
        }
    }
}
