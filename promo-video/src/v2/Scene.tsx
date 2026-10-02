import React,{useMemo,useEffect,useLayoutEffect} from 'react';
import * as THREE from 'three';
import {useThree,useLoader} from '@react-three/fiber';
import {staticFile} from 'remotion';
import {Environment} from '../Environment';
import {roundedShape} from '../Browser';
import {mix,range,clamp} from '../math';
import {GlassWindow} from './GlassWindow';
import {LANGUAGES,languageState,gridPosition,typed,ENGLISH} from './timeline.mjs';
const point=(a:number[],b:number[],t:number)=>a.map((n,i)=>mix(n,b[i],t)) as [number,number,number];
export function pointerAt(f:number):[number,number,number]{
 if(f<200)return point([6,-3,2.1],[-2,-1.3,2.1],range(f,18,115));
 if(f<1000){const l=(f-200)%100;return point([-2.6,-1.3,2.1],[4.2,-2.25,2.1],range(l,28,60));}
 return point([6,-3,2.1],[0,-.1,2.1],range(f,1300,1380));
}
const Camera:React.FC<{frame:number}>=({frame:f})=>{
 const {camera}=useThree();const pointer=pointerAt(f);
 let focus=0;if(f<200)focus=range(f,95,155);else if(f<1000){const i=Math.min(7,Math.floor((f-200)/100));const s=languageState(i,f);focus=1-range(f,s.shrinkStart,s.land);}else if(f>=1300&&f<1530)focus=range(f,1300,1380)*(1-range(f,1460,1530));
 useLayoutEffect(()=>{camera.position.set(pointer[0]*.05*focus,pointer[1]*.04*focus,mix(19.5,16.8,focus));camera.lookAt(pointer[0]*.1*focus,pointer[1]*.1*focus,0);camera.updateProjectionMatrix();},[camera,f,focus]);
 return null;
};
const Label:React.FC<{text:string;position:[number,number,number];width:number;height?:number;size?:number;color?:string;opacity?:number}>=({text,position,width,height=.65,size=140,color='#152033',opacity=1})=>{
 const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=2800;c.height=350;return new THREE.CanvasTexture(c);},[]);
 const c=texture.image as HTMLCanvasElement,ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);ctx.save();ctx.translate(1400,175);ctx.scale(1,width/(8*height));ctx.font=`600 ${size}px "Segoe UI",sans-serif`;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,0,0);ctx.restore();texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <mesh position={position}><planeGeometry args={[width,height]}/><meshBasicMaterial map={texture} transparent opacity={opacity} toneMapped={false} depthWrite={false}/></mesh>;
};
const Cursor:React.FC<{frame:number}>=({frame:f})=>{
 const shape=useMemo(()=>{const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(0,-.52);s.lineTo(.14,-.38);s.lineTo(.28,-.65);s.lineTo(.39,-.6);s.lineTo(.24,-.34);s.lineTo(.43,-.31);s.closePath();return s;},[]);
 const geo=useMemo(()=>new THREE.ShapeGeometry(shape),[shape]);const p=pointerAt(f),click=range(f,1398,1403)*(1-range(f,1403,1412));
 useEffect(()=>()=>geo.dispose(),[geo]);if(f>1430||f>=1000&&f<1300||f>=200&&f<1000&&(f-200)%100>=68)return null;
 return <group position={p} scale={1-click*.2}><mesh geometry={geo} position={[.025,-.025,-.015]}><meshBasicMaterial color="#152033"/></mesh><mesh geometry={geo}><meshBasicMaterial color="#fff"/></mesh></group>;
};
const Windows:React.FC<{frame:number}>=({frame:f})=>{
 const active=Math.min(7,Math.floor((f-200)/100));
 return <>{LANGUAGES.map((l,i)=>{
  const s=languageState(i,f);if(f>=200&&!s.visible||f>=1510+i*4)return null;
  if(f<200&&i!==0)return null;
  const shrink=f<200?0:range(f,s.shrinkStart,s.land);const collapse=range(f,1400+i*4,1500+i*4);
  let pos=point([0,-.35,.6],gridPosition(i),shrink),scale=mix(1,.33,shrink);
  const benefit=range(f,1000,1040)*(1-range(f,1260,1300));pos=[pos[0],pos[1]-benefit*1.9,pos[2]-benefit];scale*=1-benefit*.12;
  pos=point(pos,[0,-.1,1],collapse);
  const x=scale*(1+Math.sin(collapse*Math.PI)*2.8)*(1-collapse*.7),y=scale*Math.max(.008,1-collapse);
  return <GlassWindow key={l.id} host={i%2?'Claude':'ChatGPT'} locale={l.id} value={f<200?'':s.value} focused={f<200?f>115:i===active&&f<s.shrinkStart} caret={f<200?f>115:i===active&&f<s.shrinkStart&&f%30<21} position={pos} scale={[x,y,scale]} rotation={[.03,mix(-.04,0,shrink),mix(-.012,0,shrink)]} opacity={1-range(collapse,.55,.95)}/>;
 })}</>;
};
const Benefits:React.FC<{frame:number}>=({frame:f})=>{
 const opacity=range(f,1000,1030)*(1-range(f,1260,1300));if(!opacity)return null;
 const cycle=((f-1000)%100)/100,compress=range(cycle,.25,.8);
 return <group position={[0,1.15,1.4]}>
  <Label text="Less waiting." position={[-4.25,1.2,0]} width={7.8} height={.8} size={225} opacity={opacity}/>
  <Label text="Fewer tokens." position={[4.25,1.2,0]} width={7.8} height={.8} size={225} opacity={opacity}/>
  {Array.from({length:14},(_,i)=><mesh key={'wait'+i} position={[-7.25+i*.44,-.05,0]} scale={[mix(.24,.37,compress),.1,.055]}><boxGeometry/><meshBasicMaterial color={i/14<cycle?'#3158d4':'#d7e3f5'} transparent opacity={opacity}/></mesh>)}
  <mesh position={[-7.25+6.1*range(cycle,0,.48),-.55,.03]}><sphereGeometry args={[.15,24,24]}/><meshPhysicalMaterial color="#52ddaf" roughness={.25} transparent opacity={opacity}/></mesh>
  {Array.from({length:36},(_,i)=>{const x=i%12,y=Math.floor(i/12);return <mesh key={'token'+i} position={[mix(1.5+x*.48,2.2+(i%8)*.64,compress),mix(.1-y*.38,-.15,compress),0]} scale={[mix(.31,.46,compress),.24,.08]}><boxGeometry/><meshStandardMaterial color={compress>.6?'#52ddaf':'#3158d4'} transparent opacity={opacity*mix(1,i<8?1:.08,compress)} roughness={.3}/></mesh>;})}
 </group>;
};
const Flow:React.FC<{frame:number}>=({frame:f})=>{
 const converge=range(f,1400,1510),morph=range(f,1800,2150),fade=range(f,2130,2200);
 const barY=mix(-.1,-1.07,range(f,1510,1585));
 const gather=range(f,1460,1590);
 const curves=useMemo(()=>Array.from({length:64},(_,i)=>{const w=Math.floor(i/8),lane=i%8;const p=gridPosition(w);const base=point([p[0]-1.3,p[1]+(lane-3.5)*.13,.8],[-5.85,-1.07+(lane-3.5)*.006,1.4],gather);const start=point(base,[-1.32,1.05+(w%3-1)*.55,1.3],morph);const end=point([0,barY,1.4],[.38,1.05,1.3],morph);const c1=point(point([p[0]*.8,p[1],1.5],[-4,-1.07,1.4],gather),[-.72,start[1],1.3],morph);const c2=point(point([p[0]*.2,barY,1.5],[-2,-1.07,1.4],gather),[-.42,1.05,1.3],morph);return new THREE.CubicBezierCurve3(new THREE.Vector3(...start),new THREE.Vector3(...c1),new THREE.Vector3(...c2),new THREE.Vector3(...end));}),[morph,barY,gather]);
 const geos=useMemo(()=>curves.map(c=>new THREE.TubeGeometry(c,40,mix(.014,.028,morph),6,false)),[curves,morph]);useEffect(()=>()=>geos.forEach(g=>g.dispose()),[geos]);
 if(f<1400||f>=2200)return null;
 return <>{geos.map((g,i)=><mesh key={i} geometry={g}><meshBasicMaterial color={morph>.38?'#ffffff':'#3158d4'} transparent opacity={range(f,1400+Math.floor(i/8)*4,1440+Math.floor(i/8)*4)*(1-fade)*mix(.3,.95,morph)}/></mesh>)}</>;
};
const Identity:React.FC<{frame:number}>=({frame:f})=>{
 const geometry=useMemo(()=>new THREE.ExtrudeGeometry(roundedShape(3.38,3.38,.74),{depth:.16,bevelSegments:6,bevelSize:.08,bevelThickness:.1,curveSegments:32}),[]);
 const logo=useLoader(THREE.TextureLoader,staticFile('assets/logo.png'));logo.colorSpace=THREE.SRGBColorSpace;
 const shape=useMemo(()=>new THREE.ShapeGeometry(roundedShape(2.4,.86,.2)),[]);
 const arrow=useMemo(()=>{const s=new THREE.Shape();s.moveTo(-.12,.28);s.lineTo(.26,0);s.lineTo(-.12,-.28);s.lineTo(-.12,-.1);s.lineTo(-.32,-.1);s.lineTo(-.32,.1);s.lineTo(-.12,.1);return new THREE.ShapeGeometry(s);},[]);
 useEffect(()=>()=>{geometry.dispose();shape.dispose();arrow.dispose();},[geometry,shape,arrow]);
 const bar=range(f,1510,1585),morph=range(f,1800,2150),tile=range(f,1910,2110),ink=range(f,2130,2200);
 const enOpacity=range(f,1240,1300)*(1-range(f,1510,1540));
 const dotPos=point([6.15,-1.07,1.5],[1.315,1.05,1.25],morph);
 const sentence=f<1658?typed('Help me design',f,1600,1658):'Help me design'+typed(ENGLISH.slice(14),f,1658,1730);
 return <>
  {enOpacity>0&&<group position={[0,-.1,1.4]} scale={[1+range(f,1398,1403)*.07,1,1]}><mesh geometry={shape}><meshPhysicalMaterial color="#202a3a" roughness={.26} clearcoat={1} transparent opacity={enOpacity}/></mesh><Label text="-> EN" position={[0,0,.03]} width={2.1} height={.65} color="#fff" size={650} opacity={enOpacity}/></group>}
  {f>=1510&&f<2200&&<mesh position={point([0,mix(-.1,-1.07,bar),1.45],[.78,1.05,1.22],morph)} scale={[mix(mix(2.4,12.1,bar),.56,morph),mix(.12,.105,morph),.06]}><boxGeometry/><meshBasicMaterial color={morph>.45?'#ffffff':'#3158d4'} transparent opacity={1-ink}/></mesh>}
  {f>=1600&&f<2000&&<Label text={sentence+(f<1730&&f%24<18?'│':'')} position={point([0,-.45,1.5],[0,1.05,1.15],range(f,1800,1960))} width={mix(14.5,3.1,range(f,1800,1960))} height={mix(1.15,.3,range(f,1800,1960))} size={190} opacity={1-range(f,1810,1940)}/>}
  {f>=1750&&<mesh position={dotPos} scale={mix(0,.118,range(f,1750,1770))}><sphereGeometry args={[1,32,32]}/><meshPhysicalMaterial color="#52ddaf" roughness={.22} clearcoat={1} transparent opacity={1-ink}/></mesh>}
  {f>=2030&&f<2200&&<mesh geometry={arrow} position={[.3,1.05,1.36]}><meshBasicMaterial color="#fff" transparent opacity={range(f,2030,2120)*(1-ink)}/></mesh>}
  {f>=1910&&<group position={[0,1.05,.8]} scale={mix(.4,1,tile)} rotation={[mix(.2,0,tile),mix(-.25,0,tile),0]}><mesh geometry={geometry}><meshPhysicalMaterial color="#285df3" roughness={.2} clearcoat={1} transparent opacity={tile}/></mesh><mesh position={[0,0,.4]}><planeGeometry args={[3.97,3.97]}/><meshBasicMaterial map={logo} transparent opacity={ink} toneMapped={false}/></mesh></group>}
 </>;
};
export const SceneV2:React.FC<{frame:number}>=({frame})=><><Camera frame={frame}/><Environment/>{frame<1538&&<Windows frame={frame}/>}<Benefits frame={frame}/><Flow frame={frame}/><Identity frame={frame}/><Cursor frame={frame}/></>;
