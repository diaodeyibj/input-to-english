import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as t from '../src/v3r1/timeline.mjs';
import {placeEnglish} from '../src/v3r1/voice-placement.mjs';

const project=(v,f)=>{const c=t.cameraAt(f),camera=new THREE.PerspectiveCamera(32,16/9,.1,140);camera.position.fromArray(c.position);camera.lookAt(...c.target);camera.updateMatrixWorld();const p=new THREE.Vector3(...v).project(camera);return [(p.x+1)*960,(1-p.y)*540];};
const iconWorld=f=>{const w=t.windowAt(0,f),p=new THREE.Vector3((2487.5/2800-.5)*11.4,(.5-66.5/1600)*6.51,.3);p.multiplyScalar(w.scale).applyEuler(new THREE.Euler(...w.rotation)).add(new THREE.Vector3(...w.position));return p.toArray();};
test('settings click actually lands inside the toolbar icon on screen',()=>{const f=t.EVENTS.settings,a=project(iconWorld(f),f),b=project(t.pointerAt(f),f);assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<12,'cursor misses the toolbar logo');});
test('settings click follows a stable single-browser closeup',()=>{const f=t.EVENTS.settings;assert.ok(t.windowAt(0,f-8).scale>=.95);assert.ok(t.cameraAt(f-8).position[2]-t.windowAt(0,f-8).position[2]<=16.5);});
test('English output retains the complete creative request',()=>assert.equal(t.ENGLISH,'Help me design a more creative new logo'));
test('cursor stays continuous entering and leaving the settings gesture',()=>{for(const f of [1000,1112,1245,1350]){const a=t.pointerAt(f-.001),b=t.pointerAt(f+.001);assert.ok(Math.hypot(...a.map((n,i)=>n-b[i]))<.01,`pointer jumps at ${f}`);}});
test('DeepSeek selection lands on its radio control',()=>{const f=1230,a=project(t.pagePoint(t.settingsPose(f),223,887),f),b=project(t.pointerAt(f),f);assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<12);});
test('subtitle renders the full authored request before logo formation',()=>{assert.equal(t.englishTextAt(1799),'');assert.equal(t.englishTextAt(1970),t.ENGLISH);});
test('a complete 4.105s English take fits without speed change or truncation',()=>{const c={start_frame:1770,end_frame:2016.3,duration_seconds:4.105,output_file:'original.wav',output_sha256:'unchanged',character_markers:[{character:'H',frame:1770}],speech_end_frame:2010.3};const e=placeEnglish(c);assert.ok(e.end_frame<=1995);assert.equal(e.duration_seconds,c.duration_seconds);assert.equal(e.output_sha256,c.output_sha256);assert.equal(e.character_markers[0].frame,e.start_frame);assert.ok(Math.abs(e.speech_end_frame-(2010.3+e.start_frame-1770))<1e-6);assert.equal(c.start_frame,1770);});
