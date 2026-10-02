import React from 'react';
import {AbsoluteFill,Audio,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {SceneV3} from './Scene';
import {LANGUAGES,range,mix} from './timeline.mjs';
export const PromoV3:React.FC<{audio?:boolean}>=({audio=true})=>{
 const f=useCurrentFrame(),{width,height}=useVideoConfig(),brand=range(f,2180,2230);
 const active=Math.min(7,Math.max(0,Math.floor((f-100)/100)));
 const languageOpacity=f>=100&&f<900?range((f-100)%100,0,10)*(1-range((f-100)%100,68,96)):0;
 return <AbsoluteFill style={{background:'radial-gradient(ellipse at 46% 30%,#fbfdff 0%,#edf4fb 57%,#d9e8f7 100%)'}}>
  <AbsoluteFill style={{backgroundImage:'linear-gradient(rgba(49,88,212,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(49,88,212,.025) 1px,transparent 1px)',backgroundSize:'22px 22px',backgroundPosition:`${f*.025}px ${f*.012}px`}}/>
  <ThreeCanvas width={width} height={height} shadows camera={{position:[0,0,20],fov:32,near:.1,far:140}} gl={{antialias:true,alpha:true,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping}}><SceneV3 frame={f}/></ThreeCanvas>
  {f<100&&<div style={{position:'absolute',top:95,left:80,right:80,textAlign:'center',opacity:range(f,0,16)*(1-range(f,64,100)),fontFamily:'"Segoe UI",sans-serif',fontSize:76,fontWeight:600,letterSpacing:-2.8,transform:`translateY(${mix(18,0,range(f,0,35))}px)`}}>Think in your language.</div>}
  {languageOpacity>0&&<div style={{position:'absolute',top:48,left:72,color:'#3158d4',font:'600 30px "Segoe UI",sans-serif',opacity:languageOpacity,transform:`translateX(${mix(20,0,range((f-100)%100,0,24))}px)`}}>{LANGUAGES[active].label}</div>}
  {f>=2180&&<div style={{position:'absolute',top:724,left:65,right:65,textAlign:'center',opacity:brand,transform:`translateY(${mix(18,0,brand)}px)`,fontFamily:'"Segoe UI",sans-serif'}}><div style={{fontSize:96,fontWeight:650,letterSpacing:-4,color:'#152033'}}>Input to English</div><div style={{fontSize:40,color:'#62718a',marginTop:20}}>Think in your language. Prompt in English.</div></div>}
  {audio&&<Audio src={staticFile('audio/v3r1/master.wav')}/>}
 </AbsoluteFill>;
};
