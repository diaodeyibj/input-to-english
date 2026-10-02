import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const mode=process.argv[2]??'checks',out=path.resolve('out/v3r1');mkdirSync(out,{recursive:true});
const chromiumOptions={gl:'angle'};
function ffmpeg(args){const r=spawnSync('ffmpeg',['-y','-v','warning',...args],{stdio:'inherit'});if(r.status!==0)throw Error(`FFmpeg exit ${r.status}`);}
if(mode==='mux'){
 if(!existsSync('public/audio/v3r1/master.wav'))throw Error('Approved master is missing');
 const contract=JSON.parse(readFileSync('public/audio/v3r1/final-audio-contract.json','utf8'));
 const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
 if(contract.approval_status!=='user-approved'||contract.music_revision!=='C'||!contract.english_selection?.startsWith('en-r1-'))throw Error('Final audio selections are not approved');
 for(const [file,expected] of [['public/audio/v3r1/master.wav',contract.master_sha256],['public/audio/v3r1/voices-manifest.json',contract.official_manifest_sha256],['src/v3r1/voice-timing.json',contract.voice_timing_sha256],['src/v3r1/timeline.mjs',contract.timeline_sha256]])if(hash(file)!==expected)throw Error(`Final audio contract mismatch: ${file}`);
 ffmpeg(['-i',path.join(out,'picture-4k.mp4'),'-i','public/audio/v3r1/master.wav','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','320k','-ar','48000','-ac','2','-t','40','-movflags','+faststart',path.join(out,'input-to-english-v3r1-4k.mp4')]);
 ffmpeg(['-i',path.join(out,'input-to-english-v3r1-4k.mp4'),'-vf','scale=1920:1080:flags=lanczos','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',path.join(out,'input-to-english-v3r1-1080p.mp4')]);
 process.exit(0);
}
const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),outDir:path.resolve(`.cache/v3-${mode}-${Date.now()}`),publicDir:path.resolve('public')});
const composition=await selectComposition({serveUrl,id:'InputToEnglishV3R1',inputProps:{audio:false},chromiumOptions});
if(mode==='checks'||mode==='still'){
 const frames=mode==='still'?[Number(process.argv[3]??1250)]:[125,198,201,225,255,455,855,1000,1045,1084,1100,1108,1130,1190,1255,1372,1392,1470,1560,1710,1870,1990,2130,2300];
 for(const frame of frames){const output=path.join(out,`frame-${frame}.png`);await renderStill({serveUrl,composition,inputProps:{audio:false},output,frame,scale:mode==='still'?2:1,chromiumOptions,timeoutInMilliseconds:120000});console.log(output);}
}else{
 const clips=mode==='segments'?[[100,399,'languages'],[950,1459,'settings-en'],[1750,2259,'output-logo']]:[[0,2399,mode==='preview'?'preview':'picture']];
 for(const [start,end,name] of clips){let last=-1;const full=name==='picture';
  await renderMedia({serveUrl,composition,inputProps:{audio:false},outputLocation:path.join(out,`${name}-${full?'4k':'1080p'}.mp4`),codec:'h264',crf:16,scale:full?2:1,concurrency:3,imageFormat:'jpeg',jpegQuality:95,chromiumOptions,timeoutInMilliseconds:120000,frameRange:[start,end],onProgress:({renderedFrames,encodedFrames,progress})=>{const p=Math.floor(progress*100);if(p>=last+5){last=p;console.log(`${name} ${p}% frames=${renderedFrames} encoded=${encodedFrames}`);writeFileSync(path.join(out,`${name}-progress.json`),JSON.stringify({percent:p,renderedFrames,encodedFrames,at:new Date().toISOString()}));}}});
  console.log(`${name} finished`);
 }
}
