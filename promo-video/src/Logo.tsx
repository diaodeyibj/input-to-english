import React,{useMemo,useEffect} from 'react';
import {useLoader} from '@react-three/fiber';
import {staticFile} from 'remotion';
import * as THREE from 'three';
import {roundedShape} from './Browser';
import {range,mix} from './math';
export const Logo:React.FC<{frame:number}>=({frame})=>{
 const texture=useLoader(THREE.TextureLoader,staticFile('assets/logo.png'));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 const geometry=useMemo(()=>new THREE.ExtrudeGeometry(roundedShape(3.38,3.38,.74),{depth:.16,bevelEnabled:true,bevelSegments:6,bevelSize:.08,bevelThickness:.1,curveSegments:32}),[]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 const appear=range(frame,1400,1490),settle=range(frame,1460,1570);
 const morph=range(frame,1400,1490),ink=range(frame,1475,1500);
 const routes=useMemo(()=>[-1,0,1].map((lane)=>new THREE.TubeGeometry(new THREE.CubicBezierCurve3(
  new THREE.Vector3(mix(-13,-1.32,morph),mix(lane*3,lane*.55,morph),.34),
  new THREE.Vector3(mix(-7,-.62,morph),mix(lane*2,lane*.55,morph),.34),
  new THREE.Vector3(mix(-3,-.42,morph),0,.34),new THREE.Vector3(.38,0,.34)),48,.042,8,false)),[morph]);
 useEffect(()=>()=>routes.forEach(g=>g.dispose()),[routes]);
 return <group position={[0,mix(-.2,1.08,appear),.6]} rotation={[mix(.22,0,settle),mix(-.4,0,settle),mix(-.09,0,settle)]} scale={mix(.4,1,appear)}>
 <mesh geometry={geometry}><meshPhysicalMaterial color="#285df3" metalness={.08} roughness={.22} clearcoat={1} envMapIntensity={.8}/></mesh>
 {routes.map((g,i)=><mesh key={i} geometry={g}><meshBasicMaterial color={morph>.42?'#ffffff':'#3158d4'} transparent opacity={1-ink}/></mesh>)}
 <mesh position={[mix(6,1.31,morph),0,.34]} scale={.12}><sphereGeometry args={[1,24,24]}/><meshBasicMaterial color="#52ddaf" transparent opacity={1-ink}/></mesh>
 <mesh position={[0,0,.29]}><planeGeometry args={[3.97,3.97]}/><meshBasicMaterial map={texture} transparent opacity={ink} toneMapped={false}/></mesh>
 </group>;
};
