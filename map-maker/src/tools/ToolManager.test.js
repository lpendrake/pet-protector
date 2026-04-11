import test from 'node:test';
import assert from 'node:assert';
import { MapState } from '../core/MapState.js';
import { EventBus } from '../core/EventBus.js';
import { ToolManager } from './ToolManager.js';
import { SelectTool } from './SelectTool.js';
import { Registry as TileDefs } from '../core/TileDefs.js';

test('ToolManager - setTool changes active tool', () => {
    const bus = new EventBus();
    const state = new MapState(bus);
    const tm = new ToolManager(bus, state);
    
    tm.setTool('erase');
    assert.ok(tm.activeTool.erase); // Check if it's the EraseTool
});

test('ToolManager - BrushTool paints ground tile on down', () => {
    const state = new MapState();
    const tm = new ToolManager(null, state);
    
    tm.onPointerDown(5, 5);
    assert.strictEqual(state.getTileData(5, 5).base, 'grass_v1');
});

test('ToolManager - BrushTool paints on move (drag)', () => {
    const state = new MapState();
    const tm = new ToolManager(null, state);
    
    tm.onPointerDown(0, 0);
    tm.onPointerMove(1, 1);
    assert.strictEqual(state.getTileData(1, 1).base, 'grass_v1');
});

test('ToolManager - EraseTool does nothing when no layer configured', () => {
    const state = new MapState();
    state.setTileData(0, 0, 'base', 'dirt');
    state.setTileData(0, 0, 'pickup', 'apple');

    const tm = new ToolManager(null, state);
    tm.setTool('erase');
    // config.layer is null by default — should be a no-op
    tm.onPointerDown(0, 0);

    assert.strictEqual(state.getTileData(0, 0).base, 'dirt');
    assert.strictEqual(state.getTileData(0, 0).pickup, 'apple');
});

test('ToolManager - EraseTool erases only the configured layer', () => {
    const state = new MapState();
    state.setTileData(0, 0, 'base', 'grass_v1');
    state.setTileData(0, 0, 'pickup', 'apple');

    const tm = new ToolManager(null, state);
    tm.setTool('erase');
    tm.tools.get('erase').setConfig({ layer: 'pickup' });
    tm.onPointerDown(0, 0);

    assert.strictEqual(state.getTileData(0, 0).pickup, null, 'pickup should be erased');
    assert.strictEqual(state.getTileData(0, 0).base, 'grass_v1', 'base should be untouched');
});

test('ToolManager - EraseTool does not erase on move without pointer down', () => {
    const state = new MapState();
    state.setTileData(3, 3, 'base', 'dirt');

    const tm = new ToolManager(null, state);
    tm.setTool('erase');
    tm.tools.get('erase').setConfig({ layer: 'base' });
    tm.onPointerMove(3, 3); // no prior onPointerDown

    assert.strictEqual(state.getTileData(3, 3).base, 'dirt', 'Tile should be unchanged without pointer down');
});

test('ToolManager - EraseTool erases on drag (move after down)', () => {
    const state = new MapState();
    state.setTileData(0, 0, 'base', 'dirt');
    state.setTileData(1, 0, 'base', 'dirt');

    const tm = new ToolManager(null, state);
    tm.setTool('erase');
    tm.tools.get('erase').setConfig({ layer: 'base' });
    tm.onPointerDown(0, 0);
    tm.onPointerMove(1, 0);

    assert.strictEqual(state.getTileData(1, 0).base, 'empty');
});

test('ToolManager - erase:layer-changed updates erase tool config', () => {
    const bus = new EventBus();
    const state = new MapState(bus);
    const tm = new ToolManager(bus, state);

    bus.emit('erase:layer-changed', 'pickup');

    assert.strictEqual(tm.tools.get('erase').config.layer, 'pickup');
});

test('ToolManager - SelectTool emits tile:inspected with tileData and entities', () => {
    const bus = new EventBus();
    const state = new MapState(bus);
    state.setTileData(5, 5, 'base', 'grass_v1');
    state.setTileData(5, 5, 'pickup', 'apple');

    const tm = new ToolManager(bus, state);
    tm.setTool('select');

    let inspected = null;
    bus.on('tile:inspected', (data) => { inspected = data; });
    tm.onPointerDown(5, 5);

    assert.ok(inspected, 'tile:inspected should have fired');
    assert.strictEqual(inspected.tx, 5);
    assert.strictEqual(inspected.ty, 5);
    assert.strictEqual(inspected.tileData.base, 'grass_v1');
    assert.strictEqual(inspected.tileData.pickup, 'apple');
});

test('ToolManager - SelectTool includes manifest entities at tile coordinates', () => {
    const bus = new EventBus();
    const state = new MapState(bus);
    // Manually place a spawn point at (3, 3)
    state.addEntity('spawnPoints', { id: 'spawn_1', name: 'Start', x: 3, y: 3 });

    const tm = new ToolManager(bus, state);
    tm.setTool('select');

    let inspected = null;
    bus.on('tile:inspected', (data) => { inspected = data; });
    tm.onPointerDown(3, 3);

    assert.strictEqual(inspected.entities.length, 1);
    assert.strictEqual(inspected.entities[0].id, 'spawn_1');
    assert.strictEqual(inspected.entities[0]._type, 'spawnPoints');
});

test('ToolManager - SelectTool does not include entities at other coordinates', () => {
    const bus = new EventBus();
    const state = new MapState(bus);
    state.addEntity('spawnPoints', { id: 'spawn_1', name: 'Start', x: 10, y: 10 });

    const tm = new ToolManager(bus, state);
    tm.setTool('select');

    let inspected = null;
    bus.on('tile:inspected', (data) => { inspected = data; });
    tm.onPointerDown(3, 3); // different coords

    assert.strictEqual(inspected.entities.length, 0);
});

test('ToolManager - FillTool paints inside a border', () => {
    const state = new MapState();
    // Paint a 5x5 border of rocks
    for (let i = 0; i < 5; i++) {
        state.setTileData(i, 0, 'base', 'rock_v1');
        state.setTileData(i, 4, 'base', 'rock_v1');
        state.setTileData(0, i, 'base', 'rock_v1');
        state.setTileData(4, i, 'base', 'rock_v1');
    }

    const tm = new ToolManager(null, state);
    tm.setTool('fill');
    tm.activeTool.setConfig({ value: 'dirt' });
    
    // Fill at (2, 2)
    tm.onPointerDown(2, 2);
    
    // Inside should be dirt
    assert.strictEqual(state.getTileData(2, 2).base, 'dirt');
    assert.strictEqual(state.getTileData(1, 1).base, 'dirt');
    
    // Border should still be rock
    assert.strictEqual(state.getTileData(0, 0).base, 'rock_v1');
    
    // Outside should still be empty
    assert.strictEqual(state.getTileData(5, 5).base, 'empty');
});

test('ToolManager - FillTool fill undoes as a single step', () => {
    const state = new MapState();
    // Paint a 3x3 block of grass surrounded by empty
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            state.setTileData(x, y, 'base', 'grass_v1');
        }
    }

    const tm = new ToolManager(null, state);
    tm.setTool('fill');
    tm.activeTool.setConfig({ value: 'dirt_path' });
    tm.onPointerDown(1, 1); // fill the 3x3 block

    assert.strictEqual(state.getTileData(0, 0).base, 'dirt_path');
    assert.strictEqual(state.history.undoStack.length, 1);

    state.undo();

    assert.strictEqual(state.getTileData(0, 0).base, 'grass_v1');
    assert.strictEqual(state.getTileData(2, 2).base, 'grass_v1');
    assert.strictEqual(state.history.undoStack.length, 0);
});

test('ToolManager - SpawnerTool adds entity', () => {
    const state = new MapState();
    const tm = new ToolManager(null, state);
    tm.setTool('spawner');
    tm.onPointerDown(10, 10);
    assert.strictEqual(state.manifest.spawnPoints.length, 1);
});

test('ToolManager - WarpTool adds entity and tile data', () => {
    const state = new MapState();
    const tm = new ToolManager(null, state);
    tm.setTool('warp');
    tm.onPointerDown(20, 20);
    assert.strictEqual(state.manifest.warps.length, 1);
    assert.ok(state.getTileData(20, 20).warp);
});

test('ToolManager - WarpTool blocks placement on non-walkable tiles', () => {
    const state = new MapState();
    state.setTileData(5, 5, 'base', 'water_coasts_2_1'); // walkable: false
    const tm = new ToolManager(null, state, TileDefs);
    tm.setTool('warp');
    tm.onPointerDown(5, 5);
    assert.strictEqual(state.manifest.warps.length, 0);
    assert.strictEqual(state.getTileData(5, 5).warp, null);
});

test('ToolManager - WarpTool allows placement on walkable tiles', () => {
    const state = new MapState();
    state.setTileData(5, 5, 'base', 'ground_grass_1_0'); // walkable: true
    const tm = new ToolManager(null, state, TileDefs);
    tm.setTool('warp');
    tm.onPointerDown(5, 5);
    assert.strictEqual(state.manifest.warps.length, 1);
    assert.ok(state.getTileData(5, 5).warp);
});

test('ToolManager - ZoneTool paints zone', () => {
    const state = new MapState();
    const tm = new ToolManager(null, state);
    tm.setTool('zone');
    tm.onPointerDown(5, 5);
    assert.strictEqual(state.getTileData(5, 5).zone, 'active_zone');
});

test('ToolManager - every tool has a declared static shortcut (not null)', () => {
    const state = new MapState();
    const tm = new ToolManager(null, state);
    for (const [name, instance] of tm.tools) {
        assert.notStrictEqual(
            instance.constructor.shortcut,
            null,
            `Tool "${name}" (${instance.constructor.name}) has shortcut=null. Set '' for no shortcut, or a key string.`
        );
    }
});

test('ToolManager - tile:selected does not switch the active tool', () => {
    const bus = new EventBus();
    const state = new MapState(bus);
    const tm = new ToolManager(bus, state);

    tm.setTool('fill');
    bus.emit('tile:selected', 'dirt_path');

    assert.strictEqual(tm.activeTool, tm.tools.get('fill'),
        'Active tool should remain fill after tile:selected');
});

test('ToolManager - tile:selected configures both brush and fill', () => {
    const bus = new EventBus();
    const state = new MapState(bus);
    const tm = new ToolManager(bus, state);

    bus.emit('tile:selected', 'forest_v1');

    assert.strictEqual(tm.tools.get('brush').config.value, 'forest_v1');
    assert.strictEqual(tm.tools.get('fill').config.value, 'forest_v1');
});

test('ToolManager - item:selected does not switch the active tool', () => {
    const bus = new EventBus();
    const state = new MapState(bus);
    const tm = new ToolManager(bus, state);

    tm.setTool('erase');
    bus.emit('item:selected', 'apple');

    assert.strictEqual(tm.activeTool, tm.tools.get('erase'),
        'Active tool should remain erase after item:selected');
});

test('ToolManager - no two tools share the same shortcut key', () => {
    const state = new MapState();
    const tm = new ToolManager(null, state);
    const seen = new Map();
    for (const [name, instance] of tm.tools) {
        const key = instance.constructor.shortcut;
        if (key === '' || key == null) continue;
        assert.ok(
            !seen.has(key),
            `Shortcut key "${key}" is claimed by both "${seen.get(key)}" and "${name}"`
        );
        seen.set(key, name);
    }
});

