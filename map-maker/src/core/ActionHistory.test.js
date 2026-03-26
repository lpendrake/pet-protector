import test from 'node:test';
import assert from 'node:assert';
import { MapState } from './MapState.js';
import { ActionHistory } from './ActionHistory.js';
import { PaintTileAction } from './Actions.js';

test('ActionHistory - push executes action and adds to stack', () => {
    const state = new MapState();
    const action = new PaintTileAction(0, 0, 'base', 'grass', 'empty');
    state.applyAction(action);
    
    assert.strictEqual(state.getTileData(0, 0).base, 'grass');
    assert.strictEqual(state.history.undoStack.length, 1);
});

test('ActionHistory - undo reverses last action', () => {
    const state = new MapState();
    state.applyAction(new PaintTileAction(0, 0, 'base', 'grass', 'empty'));
    state.undo();
    
    assert.strictEqual(state.getTileData(0, 0).base, 'empty');
    assert.strictEqual(state.history.undoStack.length, 0);
    assert.strictEqual(state.history.redoStack.length, 1);
});

test('ActionHistory - redo re-applies undone action', () => {
    const state = new MapState();
    state.applyAction(new PaintTileAction(0, 0, 'base', 'grass', 'empty'));
    state.undo();
    state.redo();
    
    assert.strictEqual(state.getTileData(0, 0).base, 'grass');
    assert.strictEqual(state.history.undoStack.length, 1);
    assert.strictEqual(state.history.redoStack.length, 0);
});

test('ActionHistory - new action clears redo stack', () => {
    const state = new MapState();
    state.applyAction(new PaintTileAction(0, 0, 'base', 'grass', 'empty'));
    state.undo();
    state.applyAction(new PaintTileAction(1, 1, 'base', 'dirt', 'empty'));
    
    assert.strictEqual(state.history.redoStack.length, 0);
});

test('ActionHistory - respects maxSize limit', () => {
    const history = new ActionHistory(2);
    const mockAction = { execute: () => {}, undo: () => {} };
    history.push(mockAction, {});
    history.push(mockAction, {});
    history.push(mockAction, {});
    
    assert.strictEqual(history.undoStack.length, 2);
});
