import React,{useEffect} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();
export const Environment:React.FC=()=>{
 const {scene,gl}=useThree();
 useEffect(()=>{
  const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d')!;
  const g=ctx.createLinearGradient(0,0,0,512);g.addColorStop(0,'#ffffff');g.addColorStop(.5,'#cad9f0');g.addColorStop(1,'#899fc6');ctx.fillStyle=g;ctx.fillRect(0,0,1024,512);
  ctx.fillStyle='#ffffff';ctx.fillRect(48,60,160,340);ctx.fillRect(660,95,92,310);ctx.fillRect(835,190,140,115);ctx.fillStyle='#e1eaff';ctx.fillRect(320,35,210,95);
  const t=new THREE.CanvasTexture(c);t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(gl);const target=pmrem.fromEquirectangular(t);scene.environment=target.texture;
  return()=>{scene.environment=null;t.dispose();target.dispose();pmrem.dispose();};
 },[scene,gl]);
 return <><ambientLight intensity={1.1}/><directionalLight position={[-3,7,9]} intensity={3.0} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-bias={-.001} shadow-radius={5}/>
 <rectAreaLight position={[-6,4,5]} rotation={[0,.3,0]} width={4} height={7} color="#ffffff" intensity={8}/><rectAreaLight position={[7,1,3]} rotation={[0,-.6,0]} width={2} height={6} color="#b9d4ff" intensity={6}/>
 <mesh position={[0,-.6,-1.7]} receiveShadow><planeGeometry args={[40,24]}/><shadowMaterial transparent opacity={.13} depthWrite={false}/></mesh></>;
};
