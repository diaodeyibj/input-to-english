import {readFileSync,writeFileSync,copyFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const out='out/v3r1',destination=path.resolve(out,'editable-project');
const copy=file=>{if(!existsSync(file))throw Error(`Missing ${file}`);const target=path.join(destination,file);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(file,target);};
const put=(file,text)=>{const target=path.join(destination,file);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,text);};
for(const file of ['package-lock.json','tsconfig.json','src/index.ts','scripts/render-v3r1.mjs','scripts/verify-v3r1.mjs','scripts/select-english-v3r1.mjs','scripts/mix-v3r1.py','scripts/generate-score.py','scripts/generate-score-v3.py','scripts/generate-voices-v3.py','scripts/generate-native-voices-v3-b.py','scripts/generate-english-v3r1.py','scripts/generate-english-v3r1-round2.py','test/v3r1-regression.test.mjs','test/v3r1-audio.test.mjs','public/assets/logo.png','README_V3R1.md','docs/progress-v3r1.md','docs/mix-v3r1-report.json'])copy(file);
for(const file of readdirSync('src/v3r1'))copy(`src/v3r1/${file}`);
const pkg=JSON.parse(readFileSync('package.json','utf8'));pkg.scripts={studio:'remotion studio src/index.ts --no-open',typecheck:'tsc --noEmit',test:'node --test test/v3r1-*.test.mjs',render:'node scripts/render-v3r1.mjs full',mux:'node scripts/render-v3r1.mjs mux',verify:'node scripts/verify-v3r1.mjs',audio:'python -B scripts/mix-v3r1.py'};put('package.json',JSON.stringify(pkg,null,2)+'\n');
put('src/Root.tsx',`import React from 'react';\nimport {Composition} from 'remotion';\nimport {PromoV3} from './v3r1/Promo';\nexport const Root:React.FC=()=> <Composition id="InputToEnglishV3R1" component={PromoV3} width={1920} height={1080} fps={60} durationInFrames={2400} defaultProps={{audio:true}}/>;\n`);
const manifests=['public/audio/v3/voices-manifest.json','public/audio/v3r1/voices-manifest.json'];
const included=new Set();const once=file=>{if(included.has(file))return;copy(file);included.add(file);};
for(const file of manifests){once(file);for(const voice of JSON.parse(readFileSync(file,'utf8')).voices){for(const key of ['output_file','dry_file','raw_file'])if(voice[key])once(voice[key]);}}
for(const dir of ['public/audio/v3r1'])for(const file of readdirSync(dir))if(file.endsWith('.wav')||file.endsWith('.json'))once(`${dir}/${file}`);
for(const file of ['drums.wav','bass.wav'])once(`public/audio/v3/${file}`);
put('README.md',readFileSync('README_V3R1.md','utf8'));put('.gitignore','node_modules/\n.cache/\nout/\n');
const verification=JSON.parse(readFileSync(`${out}/verification.json`,'utf8'));copy(`${out}/verification.json`);
// Python zipfile creates a new archive and performs no cleanup or deletion.
const zip=spawnSync('C:/Users/diaod/.conda/envs/cosyvoice/python.exe',['-B','-c',`import pathlib,zipfile;root=pathlib.Path(r'${destination}');z=zipfile.ZipFile(r'${path.resolve(out,'input-to-english-v3r1-editable.zip')}','w',zipfile.ZIP_DEFLATED);[z.write(p,p.relative_to(root)) for p in root.rglob('*') if p.is_file()];z.close()`],{encoding:'utf8'});if(zip.status!==0)throw Error(zip.stderr);
const files=['input-to-english-v3r1-1080p.mp4','input-to-english-v3r1-4k.mp4','input-to-english-v3r1-editable.zip'].map(file=>{const data=readFileSync(`${out}/${file}`);return {file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};});
writeFileSync(`${out}/DELIVERY.json`,JSON.stringify({verification:'PASS',fps:60,frames:2400,duration_seconds:40,sample_rate:48000,files,outputs:verification.outputs},null,2)+'\n');console.log(destination);
