import test from 'node:test';
import assert from 'node:assert/strict';
// These protect delivery/interaction contracts, not the chosen easing curves.
let demo = {};
try { demo = await import('../src/demo28/timing.mjs'); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
test('demo has a complete 28s delivery and a readable translated prompt before leaving UI', () => {
  assert.equal(demo.FRAMES, 1680);
  assert.equal(demo.FPS, 60);
  assert.ok(demo.EVENTS?.textLift - demo.EVENTS?.english >= 180, 'English needs at least 3s on screen');
});
test('the actual click tip lands inside the rendered EN control', () => {
  assert.equal(typeof demo.cursorAt, 'function');
  const p = demo.cursorAt(demo.EVENTS.click);
  const b = demo.EN_RECT;
  assert.ok(p.x >= b.x && p.x <= b.x + b.width);
  assert.ok(p.y >= b.y && p.y <= b.y + b.height);
});
test('random access gives the same state and every frame belongs to a shot', () => {
  assert.equal(typeof demo.stateAt, 'function');
  const baseline = demo.stateAt(447);
  for (let f = 1679; f >= 0; f -= 7) {
    const s = demo.stateAt(f);
    assert.ok(s.shot && Number.isFinite(s.frame));
  }
  assert.deepEqual(demo.stateAt(447), baseline);
  assert.equal(demo.stateAt(1679).shot, 'Brand');
});
