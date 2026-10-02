import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
mkdirSync('out/qa',{recursive:true});
const video='out/input-to-english-1080p.mp4';
for(const frame of [100,380,600,640,760,1080,1280,1430,1470,1640,1799]){
 const r=spawnSync('ffmpeg',['-y','-v','error','-i',video,'-vf',`select=eq(n\\,${frame})`,'-frames:v','1',`out/qa/frame-${frame}.png`],{stdio:'inherit'});
 if(r.status!==0)process.exit(r.status??1);
}
const r=spawnSync('ffmpeg',['-y','-v','error','-i',video,'-vf','fps=1/1.666666667,scale=480:270,tile=6x3','-frames:v','1','out/qa/contact-sheet.png'],{stdio:'inherit'});
if(r.status!==0)process.exit(r.status??1);
console.log('Encoded frames extracted for visual QA');
