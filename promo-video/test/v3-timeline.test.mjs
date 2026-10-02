import test from 'node:test';
import assert from 'node:assert/strict';
import {DURATION, EVENTS, LANGUAGES, languageState, cameraAt, windowAt, buttonVisible, typed, phaseAt, recessionProgress, inputClicks, overviewEnd} from '../src/v3/timeline.mjs';

test('v3 ordering preserves setup before EN and the before/after comparison',()=>{
 assert.equal(DURATION,2400);
 assert.deepEqual([EVENTS.languages,EVENTS.overhead,EVENTS.settings,EVENTS.click,EVENTS.benefits,EVENTS.english,EVENTS.morph,EVENTS.brand],[100,900,1100,1400,1600,1800,2000,2200]);
 assert.equal(buttonVisible(1099),false);assert.equal(buttonVisible(1390),true);
 assert.equal(phaseAt(1599),'converge');assert.equal(phaseAt(1600),'benefits');
 assert.equal(phaseAt(2399),'brand');
});
test('all eight naturally spoken inputs type from onset and finish before recession',()=>{
 assert.equal(LANGUAGES.length,8);
 LANGUAGES.forEach((l,i)=>{assert.equal(l.start,100+i*100);const s=languageState(i,l.start);assert.equal(languageState(i,l.start-1).value,'');assert.equal(languageState(i,Math.ceil(l.start+l.onset)).value,Array.from(l.inputText)[0]);assert.ok(s.recede>=s.voiceEnd);assert.equal(languageState(i,s.recede).value,l.inputText);});
 assert.equal(typed('도와줘…',0,0,40),'도');assert.equal(typed('도와줘…',40,0,40),'도와줘…');
});
test('camera travels through space and returns to the same input before clicking',()=>{
 assert.ok(cameraAt(760).position[0]-cameraAt(130).position[0]>20);
 assert.ok(Math.abs(cameraAt(1390).target[0]-windowAt(0,1390).position[0])<5);
 assert.notDeepEqual(cameraAt(125),cameraAt(155));
 assert.notDeepEqual(windowAt(0,950).position,windowAt(0,1000).position);
});
test('overlapping voice tails never reverse the window recession interval',()=>{
 assert.equal(recessionProgress(232,233),0);
 assert.equal(recessionProgress(233,233),0);
 assert.ok(recessionProgress(250,233)>0);
 assert.equal(recessionProgress(265,233),1);
});
test('pointer clicks precede typing and adjacent windows leave input space clear',()=>{
 assert.deepEqual(inputClicks,[98,198,298,398,498,598,698,798]);
 for(let i=1;i<8;i++) {
  const f=LANGUAGES[i].start+25,prev=windowAt(i-1,f),current=windowAt(i,f);
  assert.ok(current.position[0]-prev.position[0]>10,'old window cannot cover the new input');
 }
});
test('camera and spatial windows have no discontinuities at phase boundaries',()=>{
 const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
 for(const f of [100,200,300,400,500,600,700,800,overviewEnd,1100,1360,1460,1600,1800,2000]){
  const a=cameraAt(f-.001),b=cameraAt(f+.001);
  assert.ok(distance(a.position,b.position)<.01,`camera position jumps at ${f}`);
  assert.ok(distance(a.target,b.target)<.01,`camera target jumps at ${f}`);
 }
 for(const f of [1100,1360])for(let i=0;i<8;i++){
  const a=windowAt(i,f-.001),b=windowAt(i,f+.001);
  assert.ok(distance(a.position,b.position)<.01,`window ${i} jumps at ${f}`);
  assert.ok(Math.abs(a.scale-b.scale)<.005,`window scale jumps at ${f}`);
  assert.ok(Math.abs(a.opacity-b.opacity)<.005,`window opacity jumps at ${f}`);
 }
});
