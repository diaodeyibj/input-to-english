import React,{useMemo,useEffect,useLayoutEffect} from 'react';
import * as THREE from 'three';
import {useThree,useLoader} from '@react-three/fiber';
import {staticFile} from 'remotion';
import {Environment} from './Environment';
import {roundedShape} from './primitives';
import {GlassPane,Vec} from './GlassPane';
import {drawLocalizedUI} from './localized-ui';
import {drawSettings} from './settings-ui';
import {LANGUAGES,ENGLISH,EVENTS,range,mix,point,typed,cameraAt,pointerAt,windowAt,languageState,buttonVisible,inputClicks,settingsPose,englishTextAt} from './timeline.mjs';
import voices from './voice-timing.json';
const vec=(v:number[])=>v as Vec;
export const Label:React.FC<{text:string;position:Vec;width:number;height?:number;color?:string;opacity?:number;weight?:number}>=({text,position,width,height=.6,color='#152033',opacity=1,weight=600})=>{
 const texture=useMemo(()=>new THREE.CanvasTexture(document.createElement('canvas')),[]),c=texture.image as HTMLCanvasElement;
 const w=2048,h=Math.max(80,Math.round(w*height/width));if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;
 const ctx=c.getContext('2d')!;ctx.clearRect(0,0,w,h);ctx.textAlign='center';ctx.textBaseline='middle';let font=h*.73;ctx.font=`${weight} ${font}px "Segoe UI", "Microsoft YaHei", "Yu Gothic", sans-serif`;while(ctx.measureText(text).width>w*.97){font-=2;ctx.font=`${weight} ${font}px "Segoe UI", "Microsoft YaHei", "Yu Gothic", sans-serif`;}
 ctx.fillStyle=color;ctx.fillText(text,w/2,h/2);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <mesh position={position}><planeGeometry args={[width,height]}/><meshBasicMaterial map={texture} transparent opacity={opacity} toneMapped={false} depthWrite={false}/></mesh>;
};
const Camera:React.FC<{frame:number}>=({frame:f})=>{
 const {camera}=useThree(),s=cameraAt(f);
 useLayoutEffect(()=>{camera.position.set(...vec(s.position));camera.lookAt(...vec(s.target));camera.updateProjectionMatrix();},[camera,f]);
 return <group position={vec(s.target)}><rectAreaLight position={[-6,5,6]} width={4} height={7} intensity={4}/><rectAreaLight position={[7,2,4]} width={2} height={6} intensity={4} color="#c2daff"/></group>;
};
const Windows:React.FC<{frame:number}>=({frame:f})=>{const logo=useLoader(THREE.TextureLoader,staticFile('assets/logo.png'));return <>{LANGUAGES.map((l,i)=>{
 const s=languageState(i,f),w=windowAt(i,f);if((!s.visible&&i!==0)||w.opacity<.002)return null;
 const active=f<100?i===0:f<900?Math.floor((f-100)/100)===i&&f<s.recede:i===0&&f>=1360;
 const state={host:i%2?'Claude' as const:'ChatGPT' as const,locale:l.id,value:f<100?'':s.value,focused:active,caret:active&&f%30<21,showEN:i===0&&buttonVisible(f),pressed:f>=1400&&f<1414};
 return <GlassPane key={l.id} position={vec(w.position)} rotation={vec(w.rotation)} scale={w.scale} opacity={w.opacity} drawRevision={JSON.stringify(state)} draw={c=>drawLocalizedUI(c,state,logo.image)}/>;
})}</>;};
const Settings:React.FC<{frame:number}>=({frame:f})=>{
 if(f<1104||f>=1380)return null;const enter=range(f,1104,1145),leave=range(f,1330,1380);
 return <GlassPane position={[mix(3.5,0,enter)-leave*3,mix(-.5,0,enter)+leave*1.8,1]} rotation={[mix(.12,.015,enter),mix(-.2,.025,enter),-leave*.04]} scale={mix(.3,1,enter)*(1-leave*.5)} opacity={enter*(1-leave)} drawRevision={f>=1230?1:0} draw={c=>drawSettings(c,f)}/>;
};
const Cursor:React.FC<{frame:number}>=({frame:f})=>{
 const geo=useMemo(()=>{const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(0,-.43);s.lineTo(.12,-.32);s.lineTo(.24,-.55);s.lineTo(.34,-.51);s.lineTo(.20,-.28);s.lineTo(.36,-.26);s.closePath();return new THREE.ShapeGeometry(s);},[]);
 useEffect(()=>()=>geo.dispose(),[geo]);if(f>1420||f>=900&&f<1000)return null;
 const click=Math.max(...inputClicks.map(c=>range(f,c-2,c+2)*(1-range(f,c+2,c+12))),range(f,1098,1102)*(1-range(f,1102,1112)),range(f,1228,1232)*(1-range(f,1232,1242)),range(f,1398,1402)*(1-range(f,1402,1414)));
 return <group position={vec(pointerAt(f))} scale={1-click*.18}><mesh geometry={geo} position={[.025,-.025,-.015]}><meshBasicMaterial color="#152033"/></mesh><mesh geometry={geo}><meshBasicMaterial color="#ffffff"/></mesh></group>;
};
const Benefits:React.FC<{frame:number;after:boolean}>=({frame:f,after})=>{
 const start=after?1600:900,end=after?1800:1100,opacity=range(f,start,start+22)*(1-range(f,end-25,end));if(!opacity)return null;
 const cycle=((f-start)%100)/100,compress=after?range(f,1608,1725):0;
 return <group position={[after?0:4.7,after?.45:.3,after?2.2:1.7]} scale={after?1:.7}>
  <Label text={after?'Less waiting.':'Waiting…'} position={[after?-4.1:0,1.5,.03]} width={after?7.8:7.7} height={.8} opacity={opacity}/>
  <Label text={after?'Fewer tokens.':'Token overhead'} position={[after?4.1:0,after?1.5:-1.6,.03]} width={7.8} height={.8} opacity={opacity}/>
  <group position={[after?-4.1:0,.2,0]}>
   {Array.from({length:14},(_,i)=><mesh key={i} position={[-3.1+i*.47,0,0]}><boxGeometry args={[.32,.11,.07]}/><meshBasicMaterial color={i/14<(after?cycle:cycle*.24)?'#3158d4':'#d2dff1'} transparent opacity={opacity}/></mesh>)}
   <mesh position={[-3.1+6.1*(after?range(cycle,0,.48):range(cycle,0,1)*.24),-.48,.04]}><sphereGeometry args={[.13,20,20]}/><meshBasicMaterial color="#3158d4" transparent opacity={opacity}/></mesh>
  </group>
  <group position={[after?1:0,after?-.65:-3.1,0]}>
   {Array.from({length:36},(_,i)=>{const x=after?i%12:(i%9)-4,y=after?Math.floor(i/12):Math.floor(i/9);return <mesh key={i} position={[mix(after?x*.48:x*.61,after?.5+(i%8)*.64:x*.61,compress),mix(-y*.36,-.05,compress),Math.sin(f*.02+i)*.018]} scale={[mix(.31,.43,compress),.24,.08]}><boxGeometry/><meshStandardMaterial color={compress>.6?'#3158d4':'#5a7dd4'} transparent opacity={opacity*mix(1,i<8?1:0,compress)} roughness={.28}/></mesh>;})}
  </group>
 </group>;
};
const enAt=(f:number)=>vec(point([4.05,-1.77,.8],[0,-1.5,1.65],range(f,1525,1595)));
const Flow:React.FC<{frame:number}>=({frame:f})=>{
 const morph=range(f,2000,2175),gather=range(f,1500,1600),fade=range(f,2160,2200);
 const geos=useMemo(()=>LANGUAGES.map((l,i)=>{
  const w=windowAt(i,1395),source=vec([w.position[0]+.75*w.scale,w.position[1]-.7*w.scale,w.position[2]+.9]);
  const lane=i%3,finalY=1.05+(1-lane)*.58;
  const start=point(point(source,[-6,-1.5+(i-3.5)*.055,1.65],gather),[-1.24,finalY,1.36],morph);
  const end=point(enAt(f),[.15,1.05,1.36],morph);
  const c1=point([start[0]+(end[0]-start[0])*.4,start[1]+Math.sin(i)*1.4*(1-gather),1.4],[-.65,finalY,1.36],morph);
  const c2=point([end[0]-2,end[1],2+(1-gather)*.6],[ -.48,1.05,1.36],morph);
  const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(...vec(start)),new THREE.Vector3(...vec(c1)),new THREE.Vector3(...vec(c2)),new THREE.Vector3(...vec(end)));
  const g=new THREE.TubeGeometry(curve,48,mix(.031,.115,morph),8,false);
  const count=g.index!.count,head=range(f,1400+i*7,1510+i*7),tail=range(f,1515,1598)*(1-range(f,1750,1800))*.8;
  const a=Math.floor(count*tail/6)*6,b=Math.floor(count*head/6)*6;g.setDrawRange(a,Math.max(0,b-a));return g;
 }),[f]);
 useEffect(()=>()=>geos.forEach(g=>g.dispose()),[geos]);if(f<1400||f>=2200)return null;
 return <>{geos.map((g,i)=><mesh key={i} geometry={g}><meshBasicMaterial color={morph>.18?'#ffffff':'#3158d4'} transparent opacity={(1-fade)*(morph>.5?i<3?1:0:.65)}/></mesh>)}
  {f<1545&&LANGUAGES.map((l,i)=>{const w=windowAt(i,1395),t=range(f,1400+i*7,1505+i*7),p=point([w.position[0]+.7*w.scale,w.position[1]-.7*w.scale,w.position[2]+.9],enAt(f),t);return <Label key={l.id} text={l.short} position={vec(p)} width={mix(3.5,.9,t)} height={mix(.47,.15,t)} color="#3158d4" opacity={range(f,1400+i*7,1412+i*7)*(1-range(t,.48,.95))}/>;})}
 </>;
};
const englishAt=englishTextAt;
const Identity:React.FC<{frame:number}>=({frame:f})=>{
 const tileGeo=useMemo(()=>new THREE.ExtrudeGeometry(roundedShape(3.38,3.38,.74),{depth:.16,bevelSegments:6,bevelSize:.08,bevelThickness:.1,curveSegments:32}),[]);
 const buttonGeo=useMemo(()=>new THREE.ShapeGeometry(roundedShape(1.05,.47,.09)),[]);
 const arrowGeo=useMemo(()=>{const s=new THREE.Shape();s.moveTo(-.13,.28);s.lineTo(.2,0);s.lineTo(-.13,-.28);s.lineTo(-.13,-.11);s.lineTo(-.4,-.11);s.lineTo(-.4,.11);s.lineTo(-.13,.11);return new THREE.ShapeGeometry(s);},[]);
 const logo=useLoader(THREE.TextureLoader,staticFile('assets/logo.png'));logo.colorSpace=THREE.SRGBColorSpace;
 useEffect(()=>()=>{tileGeo.dispose();buttonGeo.dispose();arrowGeo.dispose();},[tileGeo,buttonGeo,arrowGeo]);
 const morph=range(f,2000,2175),ink=range(f,2170,2200),bar=range(f,1600,1710),extension=range(f,1800,1975),tile=range(f,2030,2175);
 const p=enAt(f),buttonOpacity=range(f,1396,1415)*(1-range(f,1600,1650));
 const sentence=englishAt(f),wordFade=1-range(f,2000,2080);
 const dot=vec(point([6.1,-1.5,1.7],[1.315,1.05,1.51],morph));
 return <>
  {buttonOpacity>0&&<group position={p} scale={1+range(f,1400,1404)*.055}><mesh geometry={buttonGeo}><meshPhysicalMaterial color="#253249" roughness={.2} clearcoat={1} transparent opacity={buttonOpacity}/></mesh><Label text="→ EN" position={[0,0,.035]} width={.93} height={.34} color="#ffffff" opacity={buttonOpacity}/></group>}
  {f>=1600&&f<2200&&<mesh position={vec(point([0,-1.5,1.7],[.8,1.05,1.38],morph))} scale={[mix(mix(1.05,mix(2.4,12.1,extension),bar),.55,morph),.12,.06]}><boxGeometry/><meshBasicMaterial color={morph>.25?'#ffffff':'#3158d4'} transparent opacity={1-ink}/></mesh>}
  {f>=1800&&f<2100&&<Label text={sentence+(f<1975&&f%24<18?'│':'')} position={vec(point([0,-.63,1.85],[0,1.05,1.35],morph))} width={mix(14.7,3.2,morph)} height={mix(1.25,.3,morph)} opacity={wordFade}/>}
  {f>=1980&&<mesh position={dot} scale={mix(0,.105,range(f,1980,1995))}><sphereGeometry args={[1,32,32]}/><meshBasicMaterial color="#52ddaf"/></mesh>}
  {f>=2080&&f<2200&&<mesh geometry={arrowGeo} position={[.24,1.05,1.37]}><meshBasicMaterial color="#ffffff" transparent opacity={range(f,2080,2150)*(1-ink)}/></mesh>}
  {f>=2030&&<group position={[0,1.05,.97]} scale={mix(.45,1,tile)} rotation={[mix(.18,0,tile),mix(-.2,0,tile),0]}><mesh geometry={tileGeo}><meshPhysicalMaterial color="#285df3" roughness={.19} clearcoat={1} transparent opacity={tile}/></mesh><mesh position={[0,0,.39]}><planeGeometry args={[3.97,3.97]}/><meshBasicMaterial map={logo} transparent opacity={ink} toneMapped={false}/></mesh></group>}
 </>;
};
export const SceneV3:React.FC<{frame:number}>=({frame})=><><Camera frame={frame}/><Environment/>{frame<1580&&<Windows frame={frame}/>}<Settings frame={frame}/><Benefits frame={frame} after={false}/><Flow frame={frame}/><Benefits frame={frame} after={true}/><Identity frame={frame}/><Cursor frame={frame}/></>;
