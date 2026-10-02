"""Create additive revision files; never delete or overwrite old revisions."""
from pathlib import Path
import shutil,json
ROOT=Path(__file__).resolve().parents[1]
def put(p,s):
 p=ROOT/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf-8')
def read(p):return (ROOT/p).read_text(encoding='utf-8')
assert not (ROOT/'src/v3r1').exists(), 'Revision already initialized'
shutil.copytree(ROOT/'src/v3',ROOT/'src/v3r1')
put('src/v3r1/Environment.tsx',read('src/Environment.tsx').replace("from '../", "from '../../").replace('<shadowMaterial transparent opacity={.13}/>','<shadowMaterial transparent opacity={.13} depthWrite={false}/>'))
s=read('src/v3r1/timeline.mjs').replace("export const ENGLISH='Help me design a new logo.';","export const ENGLISH='Help me design a more creative new logo';")
for name in ['windowAt','cameraAt','pointerAt']:
 s=s.replace('export const '+name+'=', 'const legacy'+name+'=')
s="import * as THREE from 'three';\n"+s
s+='''
// Closeup is additive to the existing choreography; hold through the click.
export const closeupProgress=f=>range(f,960,1045)*(1-range(f,1104,1155));
export const windowAt=(i,f)=>{
 const base=legacywindowAt(i,f),t=closeupProgress(f);
 if(i===0)return {position:point(base.position,[0,-.1,.4],t),scale:mix(base.scale,1.04,t),rotation:point(base.rotation,[.025,-.02,0],t),opacity:mix(base.opacity,1,t)};
 return {...base,opacity:base.opacity*mix(1,.08,t)};
};
export const cameraAt=f=>{
 const base=legacycameraAt(f),t=range(f,960,1045)*(1-range(f,1110,1168));
 return {target:point(base.target,[0,.25,.4],t),position:point(base.position,[.3,.35,15.9],t)};
};
export const TOOLBAR_ICON={x:2452,y:31,width:71,height:71};
export const pagePoint=(w,x,y,z=.33)=>new THREE.Vector3((x/2800-.5)*11.4,(.5-y/1600)*6.51,z).multiplyScalar(w.scale).applyEuler(new THREE.Euler(...w.rotation)).add(new THREE.Vector3(...w.position)).toArray();
export const toolbarAnchor=f=>pagePoint(windowAt(0,f),2487.5,66.5);
export const settingsPose=f=>{
 const enter=range(f,1104,1145),leave=range(f,1330,1380);
 return {position:[mix(3.5,0,enter)-leave*3,mix(-.5,0,enter)+leave*1.8,1],rotation:[mix(.12,.015,enter),mix(-.2,.025,enter),-leave*.04],scale:mix(.3,1,enter)*(1-leave*.5)};
};
export const pointerAt=f=>{
 if(f>=1000&&f<1112)return point(pagePoint(windowAt(0,f),1540,1000),toolbarAnchor(f),range(f,1000,1084));
 if(f>=1112&&f<1245)return point(toolbarAnchor(f),pagePoint(settingsPose(f),223,887),range(f,1112,1220));
 if(f>=1245&&f<1350)return point(pagePoint(settingsPose(f),223,887),legacypointerAt(f),range(f,1245,1350));
 return legacypointerAt(f);
};
// Subtitle timing is intentionally independent of the natural voice timing.
export const englishTextAt=f=>typed(ENGLISH,f,1800,1970);
'''
put('src/v3r1/timeline.mjs',s)
s=read('src/v3r1/localized-ui.ts').replace('options: LocalizedUIOptions): void','options: LocalizedUIOptions, logo: CanvasImageSource): void')
a=s.index("  panel(c, 2452, 31,");b=s.index("  c.strokeStyle = '#d8e1ee'",a)
s=s[:a]+"  c.drawImage(logo,2452,31,71,71);\n"+s[b:]
put('src/v3r1/localized-ui.ts',s)
s=read('src/v3r1/Scene.tsx').replace("from '../Environment'","from './Environment'")
s=s.replace('buttonVisible,inputClicks}', 'buttonVisible,inputClicks,settingsPose,englishTextAt}')
s=s.replace('=({frame:f})=><>{LANGUAGES.map((l,i)=>{','=({frame:f})=>{const logo=useLoader(THREE.TextureLoader,staticFile(\'assets/logo.png\'));return <>{LANGUAGES.map((l,i)=>{')
s=s.replace('drawLocalizedUI(c,state)','drawLocalizedUI(c,state,logo.image)').replace('})}</>;','})}</>;};')
s=s.replace('if(f<1100||f>=1380)', 'if(f<1104||f>=1380)').replace('enter=range(f,1100,1145)','enter=range(f,1104,1145)')
a=s.index('const englishAt=');b=s.index('const Identity:',a)
s=s[:a]+'const englishAt=englishTextAt;\n'+s[b:]
put('src/v3r1/Scene.tsx',s)
put('src/v3r1/Promo.tsx',read('src/v3r1/Promo.tsx').replace("audio/v3/master.wav","audio/v3r1/master.wav"))
s=read('src/Root.tsx').replace("import {PromoV3} from './v3/Promo';","import {PromoV3} from './v3/Promo';\nimport {PromoV3 as PromoV3R1} from './v3r1/Promo';")
s=s.replace('</>;','<Composition id="InputToEnglishV3R1" component={PromoV3R1} width={1920} height={1080} fps={60} durationInFrames={2400} defaultProps={{audio:false}}/></>;')
put('src/Root.tsx',s)
put('test/v3r1-regression.test.mjs',read('test/v3r1-regression.test.mjs').replace('../src/v3/timeline.mjs','../src/v3r1/timeline.mjs'))
s=read('scripts/render-v3.mjs').replace('out/v3','out/v3r1').replace('audio/v3/','audio/v3r1/').replace('src/v3/','src/v3r1/').replace('InputToEnglishV3','InputToEnglishV3R1').replace('input-to-english-v3-', 'input-to-english-v3r1-')
s=s.replace("contract.english_selection!=='B'","!contract.english_selection?.startsWith('en-r1-')")
s=s.replace("[75,125,255,455,855,1020,1190,1255,1372,1392,1470,1560,1710,1870,1990,2130,2300]","[125,198,201,225,255,455,855,1000,1045,1084,1100,1108,1130,1190,1255,1372,1392,1470,1560,1710,1870,1990,2130,2300]")
s=s.replace("[[100,399,'languages'],[1100,1459,'settings-en'],[1400,2259,'output-logo']]","[[100,399,'languages'],[950,1459,'settings-en'],[1750,2259,'output-logo']]")
put('scripts/render-v3r1.mjs',s)
put('scripts/verify-v3r1.mjs',read('scripts/verify-v3.mjs').replace('out/v3','out/v3r1').replace('input-to-english-v3-','input-to-english-v3r1-'))
print('Created v3r1 additive revision')
