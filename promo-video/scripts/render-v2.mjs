import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
const mode=process.argv[2]??'checks',out=path.resolve('out/v2');mkdirSync(out,{recursive:true});
const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),outDir:path.resolve('.cache/v2-bundle'),publicDir:path.resolve('public')});
const chromiumOptions={gl:'angle'};
const inputProps={audio:mode!=='checks'&&mode!=='still'};
const composition=await selectComposition({serveUrl,id:'InputToEnglishV2',inputProps,chromiumOptions});
if(mode==='checks'||mode==='still'){
 for(const frame of mode==='still'?[Number(process.argv[3]??220)]:[120,220,275,350,620,985,1125,1399,1460,1650,1770,2030,2240]){
  const output=path.join(out,`frame-${frame}.png`);await renderStill({serveUrl,composition,inputProps:{audio:false},output,frame,scale:2,chromiumOptions,timeoutInMilliseconds:120000});console.log(output);
 }
}else{
 const clips=mode==='segments'?[[200,399,'languages'],[1300,1559,'converge'],[1560,2259,'identity']]:mode==='identity'?[[1560,2259,'identity']]:[[0,2399,'input-to-english-v2']];
 for(const [start,end,name] of clips){
  const outputLocation=path.join(out,`${name}-4k.mp4`);let last=-1;
  await renderMedia({serveUrl,composition,inputProps,outputLocation,codec:'h264',crf:16,scale:2,concurrency:2,imageFormat:'jpeg',jpegQuality:95,chromiumOptions,timeoutInMilliseconds:120000,frameRange:[start,end],onProgress:({renderedFrames,encodedFrames,progress})=>{const p=Math.floor(progress*100);if(p>=last+5){last=p;console.log(`${name} ${p}% frames=${renderedFrames} encoded=${encodedFrames}`);}}});
  const target=path.join(out,`${name}-1080p.mp4`);const r=spawnSync('ffmpeg',['-y','-v','warning','-i',outputLocation,'-vf','scale=1920:1080:flags=lanczos','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','320k','-ar','48000','-ac','2','-movflags','+faststart',target],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);console.log(target);
 }
}
