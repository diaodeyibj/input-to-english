import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {FRAMES,FPS,EVENTS} from '../src/demo28/timing.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'out/demo28');mkdirSync(out,{recursive:true});
const mode=process.argv[2]??'checks';
const output=path.join(out,'input-to-english-demo28.mp4');
const picture=path.join(out,'picture-540p.mp4');
const master=path.join(root,'public/audio/demo28/master.wav');
const contractFile=path.join(root,'public/audio/demo28/audio-contract.json');
const frames=[60,145,190,219,244,270,315,368,446,453,545,690,790,898,994,1110,1200,1298,1400,1679];
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
function ffmpeg(args){const r=spawnSync('ffmpeg',['-y','-v','warning',...args],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stderr;}
function probe(p){const r=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',p],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
function mux(){
  const c=JSON.parse(readFileSync(contractFile,'utf8'));
  assert.equal(c.source_selection,'A_ui_90-118');assert.equal(sha(c.source),c.source_sha256);assert.equal(sha(master),c.master_sha256);
  ffmpeg(['-i',picture,'-i',master,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t','28','-movflags','+faststart',output]);
}
function verify(){
  const info=probe(output),v=info.streams.find(s=>s.codec_type==='video'),a=info.streams.find(s=>s.codec_type==='audio');
  assert.equal(v.width,960);assert.equal(v.height,540);assert.equal(v.avg_frame_rate,'60/1');assert.equal(Number(v.nb_read_frames),FRAMES);assert.equal(a.sample_rate,'48000');assert.equal(a.channels,2);assert.ok(Math.abs(Number(info.format.duration)-28)<.03);
  const decode=spawnSync('ffmpeg',['-v','error','-i',output,'-f','null','-'],{encoding:'utf8'});assert.equal(decode.status,0,decode.stderr);
  const level=spawnSync('ffmpeg',['-hide_banner','-i',output,'-vn','-af','loudnorm=I=-16:TP=-1:LRA=11:print_format=json','-f','null','-'],{encoding:'utf8'});assert.equal(level.status,0,level.stderr);
  const match=level.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);assert.ok(match,'Missing loudness measurement');const loudness=JSON.parse(match[0]);assert.ok(Number(loudness.input_tp)<-1,'AAC true peak must have headroom');
  const audioContract=JSON.parse(readFileSync(contractFile,'utf8'));assert.equal(sha(master),audioContract.master_sha256);assert.equal(sha(audioContract.source),audioContract.source_sha256);
  writeFileSync(path.join(out,'verification.json'),JSON.stringify({file:output,width:v.width,height:v.height,fps:FPS,frames:FRAMES,duration:info.format.duration,channels:a.channels,sampleRate:a.sample_rate,decode:'PASS',music:'A',audioContract,loudness,events:EVENTS,reviewFrames:frames,verifiedAt:new Date().toISOString()},null,2));
  console.log(`PASS: 960x540 / ${FPS}fps / ${FRAMES} frames / 28s / stereo48k; full decode; A source hash matched; loudness ${loudness.input_i} LUFS, ${loudness.input_tp} dBTP`);
}
function decodedSheet(){
  const select=frames.map(f=>`eq(n\\,${f})`).join('+');
  ffmpeg(['-i',output,'-vf',`select=${select},scale=480:270,tile=4x5`,'-frames:v','1','-q:v','2',path.join(out,'decoded-contact-sheet.jpg')]);
}
if(mode==='verify'){verify();process.exit(0);}
if(mode==='sheet'){decodedSheet();process.exit(0);}
if(mode==='mux'){mux();verify();decodedSheet();process.exit(0);}
const serveUrl=await bundle({entryPoint:path.join(root,'src/demo28/entry.tsx'),outDir:path.join(root,'.cache/demo28-bundle'),publicDir:path.join(root,'public')});
const chromiumOptions={gl:'angle'};
// Use the existing local browser; no browser download is needed for this demo.
const browserExecutable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(browserExecutable,'An installed Chrome or Edge is required');
const inputProps={audio:false,labels:true};
const composition=await selectComposition({serveUrl,id:'InputToEnglishDemo28',inputProps,chromiumOptions,browserExecutable});
if(mode==='checks'||mode==='still'){
  const list=mode==='still'?[Number(process.argv[3]??447)]:frames;
  for(let i=0;i<list.length;i++){
    const frame=list[i],file=path.join(out,mode==='still'?`frame-${frame}.png`:`check-${String(i).padStart(3,'0')}.png`);
    await renderStill({serveUrl,composition,inputProps,output:file,frame,scale:.5,chromiumOptions,browserExecutable});console.log(`frame ${frame}: ${file}`);
  }
  if(mode==='checks')ffmpeg(['-framerate','1','-i',path.join(out,'check-%03d.png'),'-vf','scale=480:270,tile=4x5','-frames:v','1',path.join(out,'blocking-contact-sheet.png')]);
}else{
  assert.equal(mode,'full','Use checks, still <frame>, full, mux, sheet or verify');
  let last=-1;
  await renderMedia({serveUrl,composition,inputProps,outputLocation:picture,codec:'h264',crf:20,scale:.5,concurrency:4,imageFormat:'jpeg',jpegQuality:85,chromiumOptions,browserExecutable,frameRange:[0,FRAMES-1],onProgress:({progress,renderedFrames})=>{const p=Math.floor(progress*100);if(p>=last+10){last=p;console.log(`demo ${p}% (${renderedFrames}/${FRAMES})`);}}});
  mux();verify();decodedSheet();console.log(output);
}
