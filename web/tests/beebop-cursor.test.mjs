import test from 'node:test';
import assert from 'node:assert/strict';
import { bindGameCursor } from '../public/features/games/beebop/cursor.js';

function fixture() {
  const canvas = new EventTarget(), fullscreenTarget = new EventTarget();
  const classes = new Set();
  canvas.classList = { add: name => classes.add(name), remove: name => classes.delete(name) };
  const controller = new AbortController();
  const cursor = bindGameCursor(canvas, { signal: controller.signal, fullscreenTarget });
  const hidden = () => classes.has('is-cursor-hidden');
  const send = (type, values = {}) => canvas.dispatchEvent(Object.assign(new Event(type), values));
  const click = (values = {}) => send('pointerdown', { button: 0, pointerType: 'mouse', ...values });
  return { cursor, hidden, send, click, fullscreenTarget, controller };
}

test('cursor hides only after a primary mouse click during an active level', () => {
  const f = fixture();
  f.click();
  assert.equal(f.hidden(), false);
  f.cursor.setActive(true);
  assert.equal(f.hidden(), false);
  for (const input of [{ button: 2 }, { pointerType: 'touch' }, { pointerType: 'pen' }]) {
    f.click(input);
    assert.equal(f.hidden(), false);
  }
  f.click();
  assert.equal(f.hidden(), true);
  f.send('pointerup');
  f.send('pointermove');
  f.cursor.setActive(true);
  assert.equal(f.hidden(), true);
  f.send('keydown', { key: 'Escape' });
  assert.equal(f.hidden(), false);
  f.click();
  assert.equal(f.hidden(), true);
});

test('pause, menus, focus loss, cancellation, fullscreen exit and disposal restore the cursor', () => {
  const f = fixture();
  for (const restore of [
    () => f.cursor.setActive(false),
    () => f.cursor.show(),
    () => f.send('blur'),
    () => f.send('pointercancel'),
    () => f.fullscreenTarget.dispatchEvent(new Event('fullscreenchange')),
    () => f.controller.abort(),
  ]) {
    f.cursor.setActive(true);
    f.click();
    assert.equal(f.hidden(), true);
    restore();
    assert.equal(f.hidden(), false);
  }
  f.click();
  assert.equal(f.hidden(), false, 'disposed listeners cannot hide the cursor again');
});
