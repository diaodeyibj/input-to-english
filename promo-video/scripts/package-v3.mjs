import {readFileSync,writeFileSync,copyFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import path from 'node:path';
const destination=path.resolve('out/v3/editable-project');
const copy=(file)=>{if(!existsSync(file))throw Error(`Missing project asset: ${file}`);const target=path.join(destination,file);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(file,target);};
const put=(file,text)=>{const target=path.join(destination,file);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,text);};
for(const file of ['package-lock.json','tsconfig.json','src/index.ts','src/Environment.tsx','scripts/render-v3.mjs','scripts/verify-v3.mjs','scripts/bind-v3-timing.mjs','scripts/generate-score.py','scripts/generate-score-v3.py','test/v3-timeline.test.mjs','test/v3-assets.test.mjs','public/assets/logo.png'])copy(file);
for(const file of readdirSync('src/v3'))copy(`src/v3/${file}`);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
pkg.scripts={studio:'remotion studio src/index.ts --no-open',typecheck:'tsc --noEmit',test:'node --test test/v3-*.test.mjs',checks:'node scripts/render-v3.mjs checks',render:'node scripts/render-v3.mjs full',mux:'node scripts/render-v3.mjs mux',verify:'node scripts/verify-v3.mjs',audio:'python -B scripts/generate-score-v3.py --final-c'};
put('package.json',JSON.stringify(pkg,null,2)+'\n');
put('src/Root.tsx',`import React from 'react';\nimport {Composition} from 'remotion';\nimport {PromoV3} from './v3/Promo';\nexport const Root:React.FC=()=> <Composition id="InputToEnglishV3" component={PromoV3} width={1920} height={1080} fps={60} durationInFrames={2400} defaultProps={{audio:true}}/>;\n`);
const manifest=JSON.parse(readFileSync('public/audio/v3/voices-manifest.json','utf8'));
for(const file of ['voices-manifest.json','final-audio-contract.json','drums.wav','bass.wav','melody.wav','music.wav','keyboard.wav','mouse.wav','motion.wav','effects.wav','voices.wav','master.wav','ui-events-final.json'])copy(`public/audio/v3/${file}`);
for(const voice of manifest.voices){copy(voice.output_file);if(voice.dry_file)copy(voice.dry_file);if(voice.raw_file)copy(voice.raw_file);}
for(const file of ['docs/progress-v3.md','docs/score-v3-final-report.json','docs/score-v3-final-report.md','out/v3/verification.json'])if(existsSync(file))copy(file);
put('README.md',readFileSync('README_V3.md','utf8'));
put('.gitignore','node_modules/\n.cache/\nout/\n');
console.log(destination);
