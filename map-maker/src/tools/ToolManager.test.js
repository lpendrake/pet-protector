import test from 'node:test';
import assert from 'node:assert';
import { MapState } from '../core/MapState.js';
import { EventBus } from '../core/EventBus.js';
import { ToolManager } from './ToolManager.js';
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

test('ToolManager - EraseTool resets tile to default', () => {
    const state = new MapState();
    state.setTileData(0, 0, 'base', 'dirt');
    state.setTileData(0, 0, 'pickup', 'apple');
    
    const tm = new ToolManager(null, state);
    tm.setTool('erase');
    tm.onPointerDown(0, 0);
    
    const tile = state.getTileData(0, 0);
    assert.strictEqual(tile.base, 'empty');
    assert.strictEqual(tile.pickup, null);
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
    state.setTileData(5, 5, 'base', 'water_deep'); // walkable: false
    const tm = new ToolManager(null, state, TileDefs);
    tm.setTool('warp');
    tm.onPointerDown(5, 5);
    assert.strictEqual(state.manifest.warps.length, 0);
    assert.strictEqual(state.getTileData(5, 5).warp, null);
});

test('ToolManager - WarpTool allows placement on walkable tiles', () => {
    const state = new MapState();
    state.setTileData(5, 5, 'base', 'grass_v1'); // walkable: true
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

