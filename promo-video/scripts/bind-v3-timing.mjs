import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const main=JSON.parse(readFileSync('public/audio/v3/voices-manifest.json','utf8'));
const arg=process.argv[2];
const native=arg?JSON.parse(readFileSync(arg,'utf8')):main;
const result={native_status:arg?'candidate-pending-listening':'selected',english_status:'user-approved-B',source_manifest:arg??'public/audio/v3/voices-manifest.json'};
for(const v of native.voices.filter(v=>v.language!=='en')){
 const markers=v.audible_character_markers??v.character_markers??[];
 const fadeEnd=v.fade_end_frame??v.speech_end_frame??(v.start_frame+v.speech_end_frames);
 result[v.language]={frames:fadeEnd-v.start_frame,onset:v.speech_onset_frames??0,head_end:v.head_speech_end_frame??null,fade_start:v.fade_start_frame??null,fade_end:fadeEnd,text:markers.map(c=>c.character).join('')||v.display_text,characters:markers,clipped:!!v.audible_character_markers&&markers.length<v.full_character_markers.length,voice_file:v.output_file,voice_sha256:v.output_sha256};
}
const en=main.voices.find(v=>v.language==='en');
if(en.selected_candidate!=='en-b')throw Error('English B selection must be preserved');
result.en={frames:en.speech_end_frames,onset:en.speech_onset_frames,text:en.text,characters:en.character_markers,voice_file:en.output_file,voice_sha256:en.output_sha256};
writeFileSync(path.resolve('src/v3/voice-timing.json'),JSON.stringify(result,null,2)+'\n');
console.log(`Bound ${native.voices.filter(v=>v.language!=='en').length} native tracks; English B retained; ${result.native_status}`);
