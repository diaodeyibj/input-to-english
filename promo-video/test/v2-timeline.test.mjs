import test from 'node:test';
import assert from 'node:assert/strict';
import {DURATION,LANGUAGES,EVENTS,languageState,typed,phaseAt} from '../src/v2/timeline.mjs';
test('v2 has eight four-beat slots and shrinks only after speech and typing finish',()=>{
 assert.equal(DURATION,2400);LANGUAGES.forEach((l,i)=>{assert.equal(l.start,200+i*100);const s=languageState(i,l.start);assert.ok(s.shrinkStart>s.voiceEnd);assert.equal(languageState(i,s.shrinkStart).value,l.short);assert.equal(languageState(i,l.start-1).value,'');assert.equal(languageState(i,l.start).value,Array.from(l.short)[0]);});
});
test('v2 click/English/morph land on the approved beats with grapheme-safe typing',()=>{
 assert.equal(EVENTS.click,1400);assert.equal(EVENTS.english,1600);assert.equal(phaseAt(2399),'brand');assert.equal(typed('도와줘…',0,0,30),'도');assert.equal(typed('도와줘…',30,0,30),'도와줘…');assert.equal(typed('Help me…',-1,0,30),'');
});
