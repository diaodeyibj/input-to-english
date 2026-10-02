import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LANGUAGES,EVENTS,languageState} from '../src/v2/timeline.mjs';
test('v2 media provenance and voice end frames agree with window choreography',()=>{
 const m=JSON.parse(readFileSync('public/audio/v2/voices-manifest.json','utf8'));assert.equal(m.voices.length,9);
 for(const v of m.voices){const b=readFileSync(v.output_file);assert.equal(createHash('sha256').update(b).digest('hex'),v.output_sha256);assert.equal(v.start_frame,v.language==='en'?EVENTS.english:LANGUAGES.find(l=>l.id===v.language).start);assert.equal(b.readUInt16LE(22),2);assert.equal(b.readUInt32LE(24),48000);if(v.language!=='en'){const i=LANGUAGES.findIndex(l=>l.id===v.language);assert.ok(languageState(i,0).shrinkStart>v.end_frame);}}
 const en=m.voices.find(v=>v.language==='en');assert.equal(en.duration_seconds,.98);assert.equal(en.inference_speed,1.08);
});
