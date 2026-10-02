import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const root='out/v2';const outputs=[];
for(const [name,width,height] of [['input-to-english-v2-1080p.mp4',1920,1080],['input-to-english-v2-4k.mp4',3840,2160]]){
 const file=`${root}/${name}`;const p=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);const data=JSON.parse(p.stdout),v=data.streams.find(s=>s.codec_type==='video'),a=data.streams.find(s=>s.codec_type==='audio');
 assert.equal(v.width,width);assert.equal(v.height,height);assert.equal(v.avg_frame_rate,'60/1');assert.equal(Number(v.nb_read_frames),2400);assert.equal(a.channels,2);assert.equal(Number(a.sample_rate),48000);assert.ok(Math.abs(Number(data.format.duration)-40)<.05);
 const d=spawnSync('ffmpeg',['-v','error','-i',file,'-f','null','-'],{encoding:'utf8'});assert.equal(d.status,0,d.stderr);outputs.push({file,width,height,fps:v.avg_frame_rate,frames:v.nb_read_frames,duration:data.format.duration,audioChannels:a.channels,sampleRate:a.sample_rate,decode:'PASS'});
}
writeFileSync(`${root}/verification.json`,JSON.stringify({verifiedAt:new Date().toISOString(),outputs},null,2));
mkdirSync(`${root}/qa`,{recursive:true});
for(const f of [200,298,998,1200,1399,1475,1600,1658,1740,1775,2050,2199,2399]){
 const r=spawnSync('ffmpeg',['-y','-v','error','-i',`${root}/input-to-english-v2-1080p.mp4`,'-vf',`select=eq(n\\,${f})`,'-frames:v','1',`${root}/qa/frame-${f}.png`],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
}
const r=spawnSync('ffmpeg',['-y','-v','error','-i',`${root}/input-to-english-v2-1080p.mp4`,'-vf','fps=1/2,scale=480:270,tile=5x4','-frames:v','1',`${root}/qa/contact-sheet.png`],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
console.log('PASS — both 40s / 60fps / 2400 frames / stereo48k / full decode; encoded QA frames extracted');
