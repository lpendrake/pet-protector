import test from 'node:test';
import assert from 'node:assert';
import { EventBus } from './EventBus.js';

test('EventBus - delivers to subscriber', () => {
    const bus = new EventBus();
    let received = null;
    bus.on('test', (data) => received = data);
    bus.emit('test', { foo: 'bar' });
    assert.deepStrictEqual(received, { foo: 'bar' });
});

test('EventBus - off removes subscriber', () => {
    const bus = new EventBus();
    let count = 0;
    const cb = () => count++;
    bus.on('test', cb);
    bus.emit('test');
    bus.off('test', cb);
    bus.emit('test');
    assert.strictEqual(count, 1);
});

test('EventBus - emit with no subscribers does not throw', () => {
    const bus = new EventBus();
    assert.doesNotThrow(() => bus.emit('unknown', {}));
});

test('EventBus - multiple subscribers all receive', () => {
    const bus = new EventBus();
    let count = 0;
    bus.on('test', () => count++);
    bus.on('test', () => count++);
    bus.emit('test');
    assert.strictEqual(count, 2);
});
