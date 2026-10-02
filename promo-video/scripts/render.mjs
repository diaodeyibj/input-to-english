import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
const mode=process.argv[2]??'still';
const frame=Number(process.argv[3]??100);
const out=path.resolve('out');mkdirSync(out,{recursive:true});
const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),outDir:path.resolve('.cache/bundle'),publicDir:path.resolve('public')});
const inputProps={audio:mode==='full'||mode==='sample'};
const chromiumOptions={gl:'angle',enableMultiProcessOnLinux:true};
const composition=await selectComposition({serveUrl,id:'InputToEnglish',inputProps,chromiumOptions});
if(mode==='checks'){
 for(const f of [100,380,640,760,1080,1280,1640]){
  const output=path.join(out,`frame-${String(f).padStart(4,'0')}.png`);
  await renderStill({serveUrl,composition,inputProps:{audio:false},output,frame:f,scale:2,chromiumOptions,timeoutInMilliseconds:120000});console.log(output);
 }
}else if(mode==='still'){
 const output=path.join(out,`frame-${String(frame).padStart(4,'0')}.png`);
 await renderStill({serveUrl,composition,inputProps,output,frame,scale:2,chromiumOptions,timeoutInMilliseconds:120000});console.log(output);
}else{
 const outputLocation=path.join(out,mode==='full'?'input-to-english-4k.mp4':'glass-sample-4k.mp4');
 let last=-1;
 await renderMedia({serveUrl,composition,inputProps,outputLocation,codec:'h264',crf:16,scale:2,concurrency:2,imageFormat:'jpeg',jpegQuality:95,chromiumOptions,timeoutInMilliseconds:120000,frameRange:mode==='sample'?[0,179]:undefined,
  onProgress:({renderedFrames,encodedFrames,progress})=>{const p=Math.floor(progress*100);if(p>=last+2){last=p;console.log(`${mode} ${p}% rendered=${renderedFrames} encoded=${encodedFrames}`);}}});
 const target=path.join(out,mode==='full'?'input-to-english-1080p.mp4':'glass-sample-1080p.mp4');
 const r=spawnSync('ffmpeg',['-y','-i',outputLocation,'-vf','scale=1920:1080:flags=lanczos','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','320k','-ar','48000','-ac','2','-movflags','+faststart',target],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);console.log(target);
}
