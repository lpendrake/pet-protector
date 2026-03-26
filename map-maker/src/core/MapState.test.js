import test from 'node:test';
import assert from 'node:assert';
import { MapState, CHUNK_SIZE } from './MapState.js';
import { EventBus } from './EventBus.js';

test('MapState - getChunk creates chunk lazily', () => {
    const state = new MapState();
    const chunk = state.getChunk(0, 0);
    assert.ok(chunk);
    assert.strictEqual(chunk.tiles.length, CHUNK_SIZE);
    assert.strictEqual(state.chunks.size, 1);
});

test('MapState - setTileData updates correct local coords', () => {
    const state = new MapState();
    state.setTileData(33, 2, 'base', 'dirt');
    const tile = state.getTileData(33, 2);
    assert.strictEqual(tile.base, 'dirt');
    
    // Check neighbor is untouched
    assert.strictEqual(state.getTileData(32, 2).base, 'empty');
});

test('MapState - layers are independent', () => {
    const state = new MapState();
    state.setTileData(10, 10, 'base', 'dirt');
    state.setTileData(10, 10, 'decoration', 'tree');
    
    const tile = state.getTileData(10, 10);
    assert.strictEqual(tile.base, 'dirt');
    assert.strictEqual(tile.decoration, 'tree');
    
    // Overwriting base shouldn't kill decoration
    state.setTileData(10, 10, 'base', 'grass');
    assert.strictEqual(state.getTileData(10, 10).base, 'grass');
    assert.strictEqual(state.getTileData(10, 10).decoration, 'tree');
});

test('MapState - marks dirty and emits state:changed', () => {
    const bus = new EventBus();
    const state = new MapState(bus);
    let emitted = false;
    bus.on('state:changed', () => emitted = true);
    
    assert.strictEqual(state.dirty, false);
    state.setTileData(0, 0, 'base', 'grass');
    assert.strictEqual(state.dirty, true);
    assert.strictEqual(emitted, true);
});

test('MapState - negative coordinates map correctly', () => {
    const state = new MapState();
    state.setTileData(-1, -1, 'base', 'water');
    assert.strictEqual(state.getTileData(-1, -1).base, 'water');
    assert.strictEqual(state.getChunkId(-1, -1), 'chunk_-1_-1');
});

test('MapState - serialize/deserialize roundtrip', () => {
    const state = new MapState();
    state.mapName = 'test_map';
    state.setTileData(5, 5, 'base', 'rock');
    state.addEntity('spawnPoints', { id: 's1', x: 5, y: 5 });
    
    const data = state.serialize();
    const newState = new MapState();
    newState.deserialize(data);
    
    assert.strictEqual(newState.mapName, 'test_map');
    assert.strictEqual(newState.getTileData(5, 5).base, 'rock');
    assert.strictEqual(newState.manifest.spawnPoints.length, 1);
});
