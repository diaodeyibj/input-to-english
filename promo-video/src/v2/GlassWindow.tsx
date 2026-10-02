import React,{useMemo,useEffect} from 'react';
import * as THREE from 'three';
import {roundedShape} from '../Browser';
import {createUITexture} from '../ui-texture';
import {drawLocalizedUI} from './localized-ui';
export const GlassWindow:React.FC<{host:'ChatGPT'|'Claude';locale:string;value:string;focused:boolean;caret:boolean;position:[number,number,number];scale:[number,number,number];rotation?:[number,number,number];opacity?:number}>=p=>{
 const ui=useMemo(createUITexture,[]);
 const rim=useMemo(()=>{const s=roundedShape(11.8,6.9,.43);s.holes.push(new THREE.Path(roundedShape(11.35,6.46,.27).getPoints(28).reverse()));return new THREE.ExtrudeGeometry(s,{depth:.18,bevelEnabled:true,bevelSegments:6,bevelSize:.06,bevelThickness:.09,curveSegments:28});},[]);
 const face=useMemo(()=>{const g=new THREE.ShapeGeometry(roundedShape(11.4,6.51,.27),28);const a=g.attributes.position,u=g.attributes.uv;for(let i=0;i<a.count;i++)u.setXY(i,(a.getX(i)+5.7)/11.4,(a.getY(i)+3.255)/6.51);return g;},[]);
 useMemo(()=>{drawLocalizedUI(ui.canvas,{host:p.host,locale:p.locale,value:p.value,focused:p.focused,caret:p.caret});ui.texture.needsUpdate=true;},[ui,p.host,p.locale,p.value,p.focused,p.caret]);
 useEffect(()=>()=>{ui.texture.dispose();rim.dispose();face.dispose();},[ui,rim,face]);
 const opacity=p.opacity??1;
 return <group position={p.position} scale={p.scale} rotation={p.rotation??[.035,-.04,0]}>
  <mesh geometry={rim} castShadow><meshPhysicalMaterial color="#c6d9f3" transmission={.96} roughness={.18} thickness={.46} ior={1.4} clearcoat={1} envMapIntensity={1.1} transparent opacity={opacity}/></mesh>
  <mesh geometry={face} position={[0,0,.3]}><meshBasicMaterial map={ui.texture} transparent opacity={opacity} toneMapped={false}/></mesh>
 </group>;
};
