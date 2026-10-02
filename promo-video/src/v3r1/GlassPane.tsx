import React,{useMemo,useEffect,useRef} from 'react';
import * as THREE from 'three';
import {roundedShape,createUITexture} from './primitives';
export type Vec=[number,number,number];
export const GlassPane:React.FC<{position:Vec;scale?:number;rotation?:Vec;opacity?:number;drawRevision?:string|number;draw:(c:HTMLCanvasElement)=>void}>=({position,scale=1,rotation=[.025,-.035,0],opacity=1,drawRevision,draw})=>{
 const ui=useMemo(createUITexture,[]);
 const rim=useMemo(()=>{const shape=roundedShape(11.8,6.9,.43);shape.holes.push(new THREE.Path(roundedShape(11.35,6.46,.27).getPoints(28).reverse()));return new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:true,bevelSegments:6,bevelSize:.06,bevelThickness:.09,curveSegments:28});},[]);
 const face=useMemo(()=>{const g=new THREE.ShapeGeometry(roundedShape(11.4,6.51,.27),28),p=g.attributes.position,u=g.attributes.uv;for(let i=0;i<p.count;i++)u.setXY(i,(p.getX(i)+5.7)/11.4,(p.getY(i)+3.255)/6.51);return g;},[]);
 const lastDraw=useRef<string|number|undefined>(undefined);
 if(drawRevision===undefined||lastDraw.current!==drawRevision){draw(ui.canvas);ui.texture.needsUpdate=true;lastDraw.current=drawRevision;}
 useEffect(()=>()=>{ui.texture.dispose();rim.dispose();face.dispose();},[ui,rim,face]);
 return <group position={position} rotation={rotation} scale={scale}>
  <mesh geometry={rim} castShadow><meshPhysicalMaterial color="#eef6ff" transmission={.98} roughness={.16} thickness={.3} ior={1.46} clearcoat={1} clearcoatRoughness={.08} envMapIntensity={1.65} transparent opacity={opacity}/></mesh>
  <mesh geometry={face} position={[0,0,.3]}><meshBasicMaterial map={ui.texture} transparent opacity={opacity} toneMapped={false}/></mesh>
  <mesh position={[0,-3.27,.18]}><boxGeometry args={[10.75,.025,.07]}/><meshStandardMaterial color="#d6e4f7" roughness={.19} metalness={.65} transparent opacity={opacity}/></mesh>
 </group>;
};
