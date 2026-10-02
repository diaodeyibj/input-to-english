import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {LANGUAGES} from '../src/timing.mjs';
test('all nine locally generated clips match the scene timing and contain valid stereo PCM',()=>{
 const manifest=JSON.parse(readFileSync('public/audio/voices-manifest.json','utf8').replace(/^\uFEFF/,''));
 assert.equal(manifest.voices.length,9);assert.match(manifest.inference,/local/);
 for(const id of [...LANGUAGES.map(l=>l.id),'en']){
  const item=manifest.voices.find(v=>v.language===id);assert.ok(item);assert.equal(item.start_frame,id==='en'?720:LANGUAGES.find(l=>l.id===id).start);
  const b=readFileSync(`public/audio/voice-${id}.wav`);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(22),2);assert.equal(b.readUInt32LE(24),48000);assert.ok(item.duration_seconds>.4&&item.duration_seconds<=1.2);
 }
 assert.ok(existsSync('public/assets/logo.png'));
});
