import React,{useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {createUITexture,drawUI} from './ui-texture';
export function roundedShape(w:number,h:number,r:number){const s=new THREE.Shape();const x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
export const Browser:React.FC<{frame:number;host?:string;position?:[number,number,number];rotation?:[number,number,number];scale?:number;ghost?:boolean;fixedLanguage?:number}>=({frame,host='ChatGPT',position=[0,-.45,0],rotation=[.07,-.09,-.008],scale=1,ghost=false,fixedLanguage})=>{
 const ui=useMemo(createUITexture,[]);
 const body=useMemo(()=>{const shape=roundedShape(11.8,6.9,.43);const hole=new THREE.Path(roundedShape(11.35,6.46,.27).getPoints(28).reverse());shape.holes.push(hole);return new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.06,bevelThickness:.085,curveSegments:28});},[]);
 const back=useMemo(()=>{const g=new THREE.ShapeGeometry(roundedShape(11.40,6.51,.27),28);const p=g.attributes.position;const uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+5.7)/11.4,(p.getY(i)+3.255)/6.51);uv.needsUpdate=true;return g;},[]);
 drawUI(ui.canvas,frame,host,fixedLanguage);ui.texture.needsUpdate=true;
 useEffect(()=>()=>{ui.texture.dispose();body.dispose();back.dispose();},[ui,body,back]);
 return <group position={position} rotation={rotation} scale={scale}>
  <mesh geometry={body} castShadow><meshPhysicalMaterial color={ghost?'#d6e5fa':'#cdddec'} transmission={.96} roughness={.22} thickness={.42} ior={1.40} metalness={.015} clearcoat={1} clearcoatRoughness={.12} envMapIntensity={.82}/></mesh>
  <mesh position={[0,0,.245]} geometry={back}><meshBasicMaterial map={ui.texture} transparent={ghost} opacity={ghost?.55:1} toneMapped={false}/></mesh>
  <mesh position={[0,-3.27,.19]}><boxGeometry args={[10.75,.024,.06]}/><meshStandardMaterial color="#dde8fa" metalness={.7} roughness={.2}/></mesh>
 </group>;
};
