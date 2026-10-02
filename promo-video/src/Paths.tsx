import React,{useMemo,useEffect} from 'react';
import * as THREE from 'three';
import {mix,range,seed,clamp} from './math';
export const Paths:React.FC<{frame:number}>=({frame})=>{
 const enter=range(frame,230,560);const merge=range(frame,606,810);const exit=range(frame,932,996);
 const curves=useMemo(()=>Array.from({length:64},(_,i)=>{
  const side=i%2===0?-1:1;const y=(seed(i+1)-.5)*7;const z=(seed(i+88)-.5)*1.2+.7;
  const lane=(i%3-1)*.65;
  return new THREE.CubicBezierCurve3(new THREE.Vector3(mix(side*10,-5.4,merge),mix(y,lane,merge),z),new THREE.Vector3(mix(side*7,-2.4,merge),mix(y*1.05,lane,merge),z+.5),new THREE.Vector3(mix(side*5,-.7,merge),mix(y*.25,0,merge),z),new THREE.Vector3(mix(side*4.8,.5,merge),mix(y*.12,0,merge),mix(z,.8,merge)));
 }),[merge]);
 const geos=useMemo(()=>curves.map(c=>new THREE.TubeGeometry(c,36,.011,5,false)),[curves]);
 useEffect(()=>()=>geos.forEach(g=>g.dispose()),[geos]);
 if(frame<230||frame>=1000)return null;
 const count=Math.floor(64*enter);
 return <group position={[0,mix(-.95,-3.1,merge),0]}>
 {geos.slice(0,count).map((g,i)=><mesh key={i} geometry={g}><meshStandardMaterial color={merge>.8?'#65a6ec':'#3158d4'} roughness={.24} metalness={.35} transparent opacity={(.14+seed(i+52)*.17)*(1-exit)*(1-merge*.64)}/></mesh>)}
 {curves.slice(0,count).map((curve,i)=>{const p=curve.getPoint((frame/110+seed(i+152))%1);return <mesh key={'dot'+i} position={p} scale={.015}><sphereGeometry args={[1,8,8]}/><meshBasicMaterial color="#4773df" transparent opacity={(1-exit)*.52*(1-merge)}/></mesh>;})}
 {merge>0&&<mesh position={[mix(-1,2.65,merge),0,.85]} scale={[merge*5.8,.03,.03]}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#52ddaf" roughness={.28} metalness={.16} transparent opacity={merge*(1-exit)}/></mesh>}
 {merge>0&&<mesh position={[mix(1,5.6,merge),0,.85]} scale={.15*merge}><sphereGeometry args={[1,28,28]}/><meshPhysicalMaterial color="#52ddaf" roughness={.2} clearcoat={1} transparent opacity={1-exit}/></mesh>}
 </group>;
};
