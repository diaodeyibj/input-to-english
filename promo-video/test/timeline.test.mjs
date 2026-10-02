import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS, DURATION, LANGUAGES, EVENTS, phaseAt} from '../src/timing.mjs';
test('30 seconds at 60fps with eight distinct two-beat slots',()=>{
 assert.equal(FPS,60); assert.equal(DURATION,1800); assert.equal(LANGUAGES.length,8);
 assert.equal(new Set(LANGUAGES.map(x=>x.id)).size,8);
 LANGUAGES.forEach((x,i)=>assert.equal(x.start,200+i*50));
 assert.equal(EVENTS.click,600); assert.equal(EVENTS.english,720);
});
test('all frame boundaries select the intended scene and never extend delivery',()=>{
 assert.equal(phaseAt(0),'intro'); assert.equal(phaseAt(200),'languages');
 assert.equal(phaseAt(600),'transform'); assert.equal(phaseAt(1000),'showcase');
 assert.equal(phaseAt(1400),'brand'); assert.equal(phaseAt(1799),'brand');
});
