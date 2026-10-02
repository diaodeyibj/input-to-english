import React from 'react';
import {AbsoluteFill,Audio,Sequence,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {Browser} from './Browser';
import {Environment} from './Environment';
import {Paths} from './Paths';
import {Logo} from './Logo';
import {LANGUAGES} from './timing.mjs';
import {mix,range,beat,clamp} from './math';
export type PromoProps={audio?:boolean};
const HEAD='"Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", sans-serif';
const BODY='"Segoe UI", sans-serif';
const Caption:React.FC<{frame:number}>=({frame})=>{
 let headline='',eyebrow='',opacity=1,y=0;
 if(frame<200){headline='Think in your language.';eyebrow='INPUT → ENGLISH';opacity=range(frame,4,44)*(1-range(frame,170,200));y=mix(20,0,range(frame,4,44));}
 else if(frame<600){const i=Math.min(7,Math.floor((frame-200)/50));eyebrow=LANGUAGES[i].name;opacity=range(frame,200+i*50,207+i*50);}
 else if(frame<1000){headline=frame<720?'Your words, in motion.':'Into English.';eyebrow='INPUT → ENGLISH';opacity=range(frame,614,643)*(1-range(frame,955,996));}
 else if(frame<1200){headline='One click. English prompts.';eyebrow='CHATGPT + CLAUDE';opacity=range(frame,1000,1028)*(1-range(frame,1170,1200));}
 else if(frame<1400){headline='Choose your route.';eyebrow='LOCAL OR YOUR OWN API';opacity=range(frame,1200,1228)*(1-range(frame,1370,1400));}
 if(frame>=1400)return <div style={{position:'absolute',top:708,left:100,right:100,textAlign:'center',opacity:range(frame,1490,1550),transform:`translateY(${mix(20,0,range(frame,1490,1550))}px)`}}>
  <div style={{fontFamily:HEAD,fontSize:106,fontWeight:700,letterSpacing:-5,color:'#152033'}}>Input to English</div>
  <div style={{fontFamily:BODY,fontSize:46,fontWeight:400,letterSpacing:-.5,marginTop:25,color:'#62718a',opacity:range(frame,1540,1600)}}>Think in your language. Prompt in English.</div>
 </div>;
 return <div style={{position:'absolute',top:frame>=200&&frame<600?78:64,left:100,right:100,textAlign:'center',opacity,transform:`translateY(${y}px)`}}>
  <div style={{fontFamily:'"Cascadia Code", Consolas, monospace',fontSize:20,fontWeight:600,letterSpacing:5,color:'#3158d4',marginBottom:19}}>{eyebrow}</div>
  <div style={{fontFamily:HEAD,fontSize:frame>=1000?79:92,fontWeight:700,letterSpacing:-4.3,color:frame>=720&&frame<1000?'#168567':'#152033'}}>{headline}</div>
 </div>;
};
const Scene:React.FC<{frame:number}>=({frame})=>{
 const intro=range(frame,0,180);
 const language=frame>=200&&frame<600;
 const index=clamp(Math.floor((frame-200)/50),0,7);
 const local=language?(frame-200)%50:0;
 const show=range(frame,1000,1040),pair=frame>=1000&&frame<1200;
 const brand=frame>=1400;
 const slide=range(frame,790,962);
 return <>
 <Environment/>
 {!brand&&<>
 {language&&<><Browser frame={frame} host={index%2?'ChatGPT':'Claude'} position={[-3.4,.16,-2.2]} rotation={[.05,.19,-.08]} scale={.8} ghost fixedLanguage={(index+6)%8}/><Browser frame={frame} host={index%2?'Claude':'ChatGPT'} position={[3.4,.1,-2.3]} rotation={[.05,-.17,.08]} scale={.8} ghost fixedLanguage={(index+1)%8}/></>}
 {pair?<>
 <Browser frame={760} host="ChatGPT" position={[mix(0,-4.0,show),-.45,.1]} rotation={[.03,.09,-.018]} scale={mix(.95,.63,show)}/>
 <Browser frame={760} host="Claude" position={[mix(0,4.0,show),-.45,.1]} rotation={[.03,-.09,.018]} scale={mix(.95,.63,show)}/>
 </>:<Browser frame={frame} host={frame>=1200?'Settings':index%2===1?'Claude':'ChatGPT'} position={[language?Math.sin(index*2.1)*.22:0,-.58+(frame<200?mix(-.32,0,intro):0)+(frame>=720&&frame<1000?slide*1.0:0),language?.25:0]} rotation={[mix(.13,.035,intro),language?mix(index%2===0?-.12:.12,-.055,range(local,0,43)):-.045,language?(index%2===0?-.012:.012):-.006]} scale={frame>=1200?.92:language?1.025+beat(local)*.006:frame>=720&&frame<1000?mix(1,.83,slide):mix(.87,1,intro)}/>
 }
 <Paths frame={frame}/>
 </>}
 {brand&&<Logo frame={frame}/>}
 </>;
};
export const Promo:React.FC<PromoProps>=({audio=true})=>{
 const frame=useCurrentFrame();const {width,height}=useVideoConfig();
 return <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 34%, #ffffff 0%, #eef3f8 57%, #dce7f5 100%)'}}>
 <AbsoluteFill style={{backgroundImage:'repeating-linear-gradient(90deg, transparent 0, transparent 95px, rgba(49,88,212,.035) 95px, rgba(49,88,212,.035) 96px)',opacity:.8}}/>
 <ThreeCanvas width={width} height={height} shadows camera={{position:[0,0,17.7],fov:32,near:.1,far:80}} gl={{antialias:true,alpha:true,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.0}} style={{position:'absolute',inset:0}}><Scene frame={frame}/></ThreeCanvas>
 <Caption frame={frame}/>
 {audio&&<Audio src={staticFile('audio/master.wav')} volume={1}/>}
 </AbsoluteFill>;
};
