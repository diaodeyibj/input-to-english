import React from 'react';
import {AbsoluteFill,Audio,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {SceneV2} from './Scene';
import {range,mix} from '../math';
export const PromoV2:React.FC<{audio?:boolean}>=({audio=true})=>{
 const f=useCurrentFrame(),{width,height}=useVideoConfig();
 let title='',eyebrow='',opacity=1;
 if(f<200){title='Think in your language.';eyebrow='INPUT → ENGLISH';opacity=range(f,0,30)*(1-range(f,165,200));}
 else if(f<1000){eyebrow=['中文','日本語','한국어','DEUTSCH','ESPAÑOL','FRANÇAIS','ITALIANO','РУССКИЙ'][Math.min(7,Math.floor((f-200)/100))];opacity=1-range((f-200)%100,68,98);}
 else if(f<1300){title='Make every prompt lighter.';eyebrow='ENGLISH, WITH ONE CLICK';opacity=range(f,1000,1030)*(1-range(f,1260,1300));}
 else if(f<1800){title='One click. English prompts.';eyebrow='INPUT → ENGLISH';opacity=range(f,1300,1330)*(1-range(f,1750,1800));}
 const brand=range(f,2180,2230);
 return <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 34%,#ffffff 0%,#eef3f8 57%,#dce7f5 100%)'}}>
  <AbsoluteFill style={{backgroundImage:'repeating-linear-gradient(90deg,transparent 0,transparent 95px,rgba(49,88,212,.035) 95px,rgba(49,88,212,.035) 96px)'}}/>
  <ThreeCanvas width={width} height={height} shadows camera={{position:[0,0,19.5],fov:32,near:.1,far:80}} gl={{antialias:true,alpha:true,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping}}><SceneV2 frame={f}/></ThreeCanvas>
  {f<1800&&<div style={{position:'absolute',top:55,left:65,right:65,textAlign:'center',opacity,fontFamily:'"Segoe UI",sans-serif'}}><div style={{fontSize:21,fontWeight:600,letterSpacing:4,color:'#3158d4',marginBottom:18}}>{eyebrow}</div><div style={{fontSize:82,fontWeight:700,letterSpacing:-3.6,color:'#152033'}}>{title}</div></div>}
  {f>=2180&&<div style={{position:'absolute',top:710,left:60,right:60,textAlign:'center',opacity:brand,transform:`translateY(${mix(18,0,brand)}px)`,fontFamily:'"Segoe UI",sans-serif'}}><div style={{fontSize:100,fontWeight:700,letterSpacing:-4,color:'#152033'}}>Input to English</div><div style={{fontSize:43,color:'#62718a',marginTop:22}}>Think in your language. Prompt in English.</div></div>}
  {audio&&<Audio src={staticFile('audio/v2/master.wav')}/>}
 </AbsoluteFill>;
};
