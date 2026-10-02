import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync,renameSync} from 'node:fs';
import assert from 'node:assert/strict';
const root='out/v3',outputs=[];
for(const [name,width,height] of [['input-to-english-v3-1080p.mp4',1920,1080],['input-to-english-v3-4k.mp4',3840,2160]]){
 const file=`${root}/${name}`,p=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);
 const data=JSON.parse(p.stdout),v=data.streams.find(s=>s.codec_type==='video'),a=data.streams.find(s=>s.codec_type==='audio');assert.equal(v.width,width);assert.equal(v.height,height);assert.equal(v.avg_frame_rate,'60/1');assert.equal(Number(v.nb_read_frames),2400);assert.equal(a.channels,2);assert.equal(Number(a.sample_rate),48000);assert.ok(Math.abs(Number(data.format.duration)-40)<.05);
 const decode=spawnSync('ffmpeg',['-v','error','-i',file,'-f','null','-'],{encoding:'utf8'});assert.equal(decode.status,0,decode.stderr);outputs.push({file,width,height,frames:2400,fps:60,duration:data.format.duration,stereo48k:true,decode:'PASS'});
}
writeFileSync(`${root}/verification.json`,JSON.stringify({verifiedAt:new Date().toISOString(),outputs},null,2));mkdirSync(`${root}/qa`,{recursive:true});
const frames=[99,100,201,500,899,1020,1255,1370,1395,1400,1470,1710,1801,1890,1990,2130,2300];
const extraction=spawnSync('ffmpeg',['-y','-v','error','-i',`${root}/input-to-english-v3-1080p.mp4`,'-vf',`select=${frames.map(f=>`eq(n\\,${f})`).join('+')}`,'-fps_mode','passthrough','-frames:v',String(frames.length),`${root}/qa/selected-%03d.png`],{encoding:'utf8'});assert.equal(extraction.status,0,extraction.stderr);
frames.forEach((f,i)=>renameSync(`${root}/qa/selected-${String(i+1).padStart(3,'0')}.png`,`${root}/qa/frame-${f}.png`));
const sheet=spawnSync('ffmpeg',['-y','-v','error','-i',`${root}/input-to-english-v3-1080p.mp4`,'-vf','fps=1/2,scale=480:270,tile=5x4','-frames:v','1',`${root}/qa/contact-sheet.png`],{encoding:'utf8'});assert.equal(sheet.status,0,sheet.stderr);console.log('PASS 4K + 1080p / 40s / 2400frames / 60fps / stereo48k / full decode');
