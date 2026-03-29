import test from 'node:test';
import assert from 'node:assert';
import { ShortcutManager } from './ShortcutManager.js';
import { MapState } from './MapState.js';
import { EventBus } from './EventBus.js';
import { ToolManager } from '../tools/ToolManager.js';

// --- Helpers ---

// Stub document for Node (not available outside the browser)
global.document = { activeElement: null };

function fakeEvent(key, { ctrlKey = false, shiftKey = false } = {}) {
    return { key, ctrlKey, shiftKey, preventDefault: () => {} };
}

function withActiveTag(tagName, fn) {
    global.document.activeElement = { tagName };
    try { fn(); }
    finally { global.document.activeElement = null; }
}

// --- register() ---

test('register - stores entry, retrievable via getAll()', () => {
    const sm = new ShortcutManager();
    let fired = false;
    sm.register({ key: 'b', description: 'Brush', action: () => { fired = true; } });
    assert.ok(sm.getAll().has('b'));
    assert.strictEqual(sm.getAll().get('b').description, 'Brush');
});

test('register - throws on duplicate canonical key', () => {
    const sm = new ShortcutManager();
    sm.register({ key: 'b', action: () => {} });
    assert.throws(
        () => sm.register({ key: 'b', action: () => {} }),
        /already registered/
    );
});

test('register - plain z and ctrl+z are distinct, both succeed', () => {
    const sm = new ShortcutManager();
    sm.register({ key: 'z', action: () => {} });
    sm.register({ key: 'z', ctrlKey: true, action: () => {} });
    assert.ok(sm.getAll().has('z'));
    assert.ok(sm.getAll().has('ctrl+z'));
});

// --- dispatch (via attach/detach on FakeTarget) ---

test('dispatch - calls action for matching plain key', () => {
    const sm = new ShortcutManager();
    let fired = false;
    sm.register({ key: 'b', action: () => { fired = true; } });
    sm.handleEvent(fakeEvent('b'));
    assert.ok(fired);
});

test('dispatch - calls action for ctrl+key combo', () => {
    const sm = new ShortcutManager();
    let fired = false;
    sm.register({ key: 's', ctrlKey: true, action: () => { fired = true; } });
    sm.handleEvent(fakeEvent('s', { ctrlKey: true }));
    assert.ok(fired);
});

test('dispatch - does not call action when activeElement is INPUT', () => {
    const sm = new ShortcutManager();
    let fired = false;
    sm.register({ key: 'b', action: () => { fired = true; } });
    withActiveTag('INPUT', () => sm.handleEvent(fakeEvent('b')));
    assert.strictEqual(fired, false);
});

test('dispatch - does not call action when activeElement is TEXTAREA', () => {
    const sm = new ShortcutManager();
    let fired = false;
    sm.register({ key: 'b', action: () => { fired = true; } });
    withActiveTag('TEXTAREA', () => sm.handleEvent(fakeEvent('b')));
    assert.strictEqual(fired, false);
});

test('dispatch - ignores key-repeat events (e.repeat = true)', () => {
    const sm = new ShortcutManager();
    let count = 0;
    sm.register({ key: 'z', ctrlKey: true, action: () => { count++; } });
    sm.handleEvent({ key: 'z', ctrlKey: true, shiftKey: false, repeat: false, preventDefault: () => {} });
    sm.handleEvent({ key: 'z', ctrlKey: true, shiftKey: false, repeat: true,  preventDefault: () => {} });
    sm.handleEvent({ key: 'z', ctrlKey: true, shiftKey: false, repeat: true,  preventDefault: () => {} });
    assert.strictEqual(count, 1, 'only the initial keydown should fire, not the repeats');
});

test('dispatch - does nothing for unregistered key', () => {
    const sm = new ShortcutManager();
    // Should not throw
    sm.handleEvent(fakeEvent('q'));
});

// --- getAll() ---

test('getAll - returns a copy; mutating it does not affect registry', () => {
    const sm = new ShortcutManager();
    sm.register({ key: 'b', action: () => {} });
    const copy = sm.getAll();
    copy.delete('b');
    assert.ok(sm.getAll().has('b'));
});

// --- registerCoreShortcuts() ---

test('registerCoreShortcuts - registers undo, redo, save entries', () => {
    const bus = new EventBus();
    const state = new MapState(bus);
    const sm = new ShortcutManager();
    sm.registerCoreShortcuts(state, bus);
    const all = sm.getAll();
    assert.ok(all.has('ctrl+z'), 'undo not registered');
    assert.ok(all.has('ctrl+shift+Z'), 'redo not registered');
    assert.ok(all.has('ctrl+s'), 'save not registered');
});

// --- registerToolShortcuts() ---

test('registerToolShortcuts - throws if a tool has shortcut = null', () => {
    const state = new MapState();
    const tm = new ToolManager(null, state);
    // Inject a tool with null shortcut
    class BadTool { static shortcut = null; onDown() {} onMove() {} onUp() {} }
    tm.tools.set('bad', new BadTool());

    const sm = new ShortcutManager();
    assert.throws(
        () => sm.registerToolShortcuts(tm),
        /shortcut = null/
    );
});

test('registerToolShortcuts - skips tools with shortcut = "" (no throw, no registration)', () => {
    const state = new MapState();
    const tm = new ToolManager(null, state);
    class SilentTool { static shortcut = ''; onDown() {} onMove() {} onUp() {} }
    tm.tools.set('silent', new SilentTool());

    const sm = new ShortcutManager();
    // Should not throw; 'silent' tool should not appear in registry
    assert.doesNotThrow(() => sm.registerToolShortcuts(tm));
    for (const [, entry] of sm.getAll()) {
        assert.ok(!entry.description.includes('silent'), 'silent tool should not be registered');
    }
});

test('registerToolShortcuts - throws if two tools share the same key', () => {
    const state = new MapState();
    const tm = new ToolManager(null, state);
    class ClashTool { static shortcut = 'b'; onDown() {} onMove() {} onUp() {} }
    tm.tools.set('clash', new ClashTool());

    const sm = new ShortcutManager();
    assert.throws(
        () => sm.registerToolShortcuts(tm),
        /already registered/
    );
});
