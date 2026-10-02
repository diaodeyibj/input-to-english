import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const timing=JSON.parse(read('src/v3/voice-timing.json'));
const official=JSON.parse(read('public/audio/v3/voices-manifest.json'));
test('selected English B keeps its exact approved recording and complete displayed sentence',()=>{
 const selected=official.voices.find(v=>v.language==='en'),candidate=official.english_candidates.find(v=>v.take_id==='en-b');
 assert.equal(selected.selected_candidate,'en-b');
 assert.equal(createHash('sha256').update(read(selected.output_file)).digest('hex'),candidate.output_sha256);
 assert.equal(timing.en.characters.map(c=>c.character).join(''),'Help me design a new logo.');
});
test('native candidate character onsets and window tails use the actual audio markers',()=>{
 for(const id of ['zh','ja','ko','de','es','fr','it','ru']){
  const v=timing[id];assert.ok(v.characters.length);
  const start=100+['zh','ja','ko','de','es','fr','it','ru'].indexOf(id)*100;
  assert.ok(Math.abs(v.characters[0].frame-(start+v.onset))<=2);
  assert.equal(v.frames,120);
  assert.equal(v.fade_end,start+120);
  assert.equal(createHash('sha256').update(read(v.voice_file)).digest('hex'),v.voice_sha256);
 }
 assert.ok(['candidate-pending-listening','selected'].includes(timing.native_status));
});
