import React from 'react';
import {AbsoluteFill, Audio, Img, staticFile, useCurrentFrame} from 'remotion';
import {NATIVE,ENGLISH,EVENTS,MAIN,EDITOR,EN_RECT,FRAMES,progress,tween,mix,ease,cursorAt,stateAt} from './timing.mjs';

const BLUE='#285df3', INK='#14243f', MINT='#52ddaf';
const family='"Segoe UI", "Microsoft YaHei", sans-serif';
type Pose={x:number;y:number;scale?:number;rotate?:number;opacity?:number};
const reveal=(f:number,a:number,b:number)=>ease(progress(f,a,b));

const BrowserCard:React.FC<{pose:Pose;host?:string;text:string;button?:boolean;busy?:boolean;selected?:boolean;done?:boolean;translator?:boolean;output?:boolean;frame:number}> = ({pose,host='ChatGPT',text,button=false,busy=false,selected=false,done=false,translator=false,output=false,frame:f}) => {
  const rotation=pose.rotate??0;
  return <div style={{position:'absolute',left:pose.x,top:pose.y,width:MAIN.width,height:MAIN.height,opacity:pose.opacity??1,transformOrigin:'0 0',transform:`perspective(2600px) scale(${pose.scale??1}) rotateY(${rotation}deg)`,background:translator?'#fbfcff':'#ffffff',border:'2px solid #cdd9ee',borderRadius:28,boxShadow:'0 25px 75px #163e8420',overflow:'hidden'}}>
    <div style={{height:56,background:'#f4f7fc',borderBottom:'2px solid #e1e8f3',display:'flex',alignItems:'center',padding:'0 28px',gap:11}}>
      {['#f0a69e','#f2d291','#a0d4be'].map(c=><div key={c} style={{width:13,height:13,borderRadius:'50%',background:c}}/>)}
      <span style={{marginLeft:28,fontSize:24,color:'#74839c'}}>{translator?'translate.example':host==='Claude'?'claude.ai':'chatgpt.com'}</span>
      <div style={{marginLeft:'auto',fontSize:23,color:'#74839c'}}>Logo design</div>
    </div>
    <div style={{position:'absolute',top:89,left:44,fontSize:42,fontWeight:650,color:INK}}>{translator?'Translate to English':host}</div>
    <div style={{position:'absolute',top:105,right:44,fontSize:26,color:'#7b8ca7'}}>{translator?'中文 → English':'Your workspace'}</div>
    <div style={{position:'absolute',left:EDITOR.x,top:EDITOR.y,width:EDITOR.width,height:EDITOR.height,borderRadius:24,border:`2px solid ${button?'#aabfeb':'#d8e1ef'}`,background:'#f8faff',padding:'30px 36px',boxSizing:'border-box'}}>
      <div style={{fontSize:52,lineHeight:1.35,color:INK,maxWidth:1250,opacity:busy?.65:1,transform:`translateY(${done?tween(f,EVENTS.english,EVENTS.english+16,8,0):0}px)`}}>
        <span style={{background:selected?'#cddfff':'transparent',boxShadow:selected?'0 0 0 5px #cddfff':'none',borderRadius:4}}>{text}</span>
        {!done&&!busy&&f%50<32&&<span style={{color:BLUE}}>│</span>}
      </div>
      {button&&<div style={{position:'absolute',right:24,bottom:18,width:busy?230:132,height:64,background:busy?'#e3eafd':BLUE,borderRadius:14,color:busy?BLUE:'#fff',fontSize:30,fontWeight:650,display:'flex',justifyContent:'center',alignItems:'center',transform:`scale(${f>=447&&f<455?tween(f,447,455,.95,1):1})`,transformOrigin:'right center'}}>{busy?'Translating…':'→ EN'}</div>}
      {done&&button&&<div style={{position:'absolute',right:180,bottom:37,fontSize:25,color:'#74839c'}}>Undo</div>}
      {!button&&!translator&&<div style={{position:'absolute',right:28,bottom:24,fontSize:32,color:'#a1adc0'}}>↑</div>}
      {translator&&output&&<div style={{position:'absolute',left:36,bottom:27,fontSize:30,color:BLUE}}>English ready</div>}
    </div>
    <div style={{position:'absolute',left:44,top:496,fontSize:28,color:'#6f809d'}}>{translator?'Translate · Copy · Return':button?'Translate here. Keep working.':'Write your idea in your own language.'}</div>
    {selected&&<div style={{position:'absolute',right:58,top:137,background:INK,color:'#fff',borderRadius:10,padding:'9px 18px',fontSize:24}}>Copied</div>}
  </div>;
};

const Title:React.FC<{children:React.ReactNode;top?:number;left?:number;size?:number;opacity?:number;align?:'left'|'center';color?:string;dy?:number}> = ({children,top=128,left=100,size=108,opacity=1,align='left',color=INK,dy=0})=> <div style={{position:'absolute',left,right:align==='center'?left:undefined,top,fontSize:size,fontWeight:700,lineHeight:1.05,letterSpacing:-4,color,opacity,textAlign:align,transform:`translateY(${dy}px)`}}>{children}</div>;

const Idea:React.FC<{f:number}>=({f})=>{
  const leave=progress(f,108,123),chars=Array.from(NATIVE),n=Math.round(tween(f,15,85,5,chars.length));
  return <AbsoluteFill style={{opacity:1-leave}}>
    <div style={{position:'absolute',left:110,top:220,fontSize:27,fontWeight:600,letterSpacing:3,color:BLUE}}>ENGLISH PROMPTS</div>
    <Title top={287} left={100} size={126} opacity={reveal(f,0,15)} dy={tween(f,0,24,32,0)}>Get more<br/>from AI.</Title>
    <div style={{position:'absolute',left:112,top:607,fontSize:35,color:'#72839e',opacity:reveal(f,30,55)}}>Start with your own words.</div>
    <BrowserCard frame={f} pose={{x:tween(f,0,85,1110,945),y:tween(f,0,85,337,300),scale:.59,rotate:tween(f,0,85,-16,-5)}} text={chars.slice(0,n).join('')}/>
    <div style={{position:'absolute',left:1030,top:700,fontSize:26,color:'#8395b1'}}>One idea. A new logo.</div>
  </AbsoluteFill>;
};

const actions=[{frame:123,label:'Copy.',native:true,selected:true},{frame:177,label:'Switch.',native:true,selected:false},{frame:204,label:'Paste.',native:true,selected:false},{frame:231,label:'Translate.',native:true,selected:false},{frame:258,label:'Copy.',native:false,selected:true},{frame:285,label:'Switch.',native:false,selected:false},{frame:312,label:'Paste.',native:false,selected:false}];
const Detour:React.FC<{f:number}>=({f})=>{
  let index=0;actions.forEach((a,i)=>{if(f>=a.frame)index=i;});const act=actions[index];
  const toTranslator=reveal(f,165,193),toChat=reveal(f,275,300),switching=toTranslator*(1-toChat);
  const chatX=240-switching*1770,translatorX=2010-switching*1770;
  return <AbsoluteFill>
    <Title top={123} left={118} size={112} dy={tween(f,act.frame,act.frame+12,15,0)}>{act.label}</Title>
    <div style={{position:'absolute',right:115,top:153,fontSize:31,color:'#8091ac'}}>The long way to English</div>
    <BrowserCard frame={f} pose={{x:chatX,y:305,scale:1}} text={index>=6?ENGLISH:NATIVE} selected={index===0}/>
    <BrowserCard frame={f} pose={{x:translatorX,y:305,scale:1}} translator text={index>=4?ENGLISH:index>=2?NATIVE:''} selected={index===4} output={index>=4}/>
    <div style={{position:'absolute',top:912,left:245,display:'flex',gap:26,alignItems:'center'}}>{actions.map((a,i)=><React.Fragment key={a.frame}>{i>0&&<div style={{height:2,width:24,background:i<=index?BLUE:'#c4d0e4'}}/>}<div style={{fontSize:26,color:i===index?BLUE:i<index?'#547198':'#a5b3c8',fontWeight:i===index?700:400}}>{a.label.replace('.','')}</div></React.Fragment>)}</div>
  </AbsoluteFill>;
};

const OneClick:React.FC<{f:number}>=({f})=>{
  const settle=reveal(f,330,392),busy=f>=447&&f<EVENTS.english,done=f>=EVENTS.english;
  const p=cursorAt(f),hit=progress(f,447,467);
  return <AbsoluteFill>
    {[0,1,2].map((i)=><div key={i} style={{position:'absolute',left:mix(360-i*120,MAIN.x,settle),top:mix(335+i*58,MAIN.y,settle),width:MAIN.width,height:MAIN.height,borderRadius:28,border:'2px solid #b6c7e6',background:'#e4edfc',opacity:(1-settle)*(.36-i*.08),transform:`rotate(${(i-1)*4*(1-settle)}deg)`}}/>)}
    <Title top={129} left={100} align="center" size={110} opacity={reveal(f,341,365)}>{f<447?'Now, one click.':'One click. English.'}</Title>
    <BrowserCard frame={f} pose={{x:tween(f,330,392,315,MAIN.x),y:tween(f,330,392,325,MAIN.y),scale:tween(f,330,392,.92,1)}} text={done?ENGLISH:NATIVE} button busy={busy} done={done}/>
    {f>=447&&f<467&&<div style={{position:'absolute',left:EN_RECT.x+EN_RECT.width/2-40,top:EN_RECT.y+EN_RECT.height/2-40,width:80,height:80,borderRadius:'50%',border:'4px solid #52ddaf',transform:`scale(${1+hit*1.2})`,opacity:1-hit}}/>}
    <div style={{position:'absolute',left:p.x,top:p.y,opacity:p.opacity,transform:`scale(${f>=447&&f<453?.9:1})`,transformOrigin:'0 0'}}><svg width="48" height="59" viewBox="0 0 48 59"><path d="M3 3 L4 47 L16 37 L27 56 L36 51 L25 32 L42 30 Z" fill={INK} stroke="white" strokeWidth="4" strokeLinejoin="round"/></svg></div>
    <div style={{position:'absolute',top:932,left:100,right:100,textAlign:'center',fontSize:32,color:'#6681a9',opacity:reveal(f,550,580)}}>Stay in the conversation.</div>
  </AbsoluteFill>;
};

const Platforms:React.FC<{f:number}>=({f})=>{
  const swap=reveal(f,732,755),first=1-swap;
  return <AbsoluteFill style={{opacity:1-progress(f,866,890)}}>
    <Title top={132} left={100} align="center" size={97}>Think in your language.</Title>
    <div style={{position:'absolute',left:0,top:0,transform:`translateX(${-first*12}px)`,opacity:first}}><BrowserCard frame={f} pose={{x:MAIN.x,y:MAIN.y}} text={ENGLISH} button done/></div>
    <div style={{position:'absolute',left:0,top:0,transform:`translateX(${(1-swap)*65}px)`,opacity:swap}}><BrowserCard frame={f} host="Claude" pose={{x:MAIN.x,y:MAIN.y}} text={ENGLISH} button done/></div>
    <div style={{position:'absolute',top:924,left:0,right:0,display:'flex',justifyContent:'center',gap:25,fontSize:30}}><span style={{color:f<744?BLUE:'#8797b1',fontWeight:650}}>ChatGPT</span><span style={{color:'#c0cce0'}}>＋</span><span style={{color:f>=744?BLUE:'#8797b1',fontWeight:650}}>Claude</span></div>
  </AbsoluteFill>;
};

const Momentum:React.FC<{f:number}>=({f})=>{
  const lift=reveal(f,880,906),fade=1-progress(f,1075,1102);
  return <AbsoluteFill style={{opacity:fade}}>
    <div style={{position:'absolute',left:220,top:tween(f,880,935,320,245),right:220,textAlign:'center',fontSize:58,color:INK,fontWeight:500,opacity:lift}}>{ENGLISH}</div>
    <svg width="1920" height="1080" style={{position:'absolute',left:0,top:0}}><path d={`M ${tween(f,880,970,450,350)} 385 H ${tween(f,880,970,1050,1570)}`} fill="none" stroke={BLUE} strokeWidth="8" strokeLinecap="round" opacity={lift}/><circle cx={tween(f,940,1044,350,1570)} cy="385" r="11" fill={MINT} opacity={reveal(f,930,940)}/></svg>
    <Title top={493} left={110} align="center" size={112} opacity={reveal(f,892,916)} dy={tween(f,892,916,35,0)}>Prompt in English.</Title>
    <Title top={660} left={110} align="center" size={144} color={BLUE} opacity={reveal(f,942,963)} dy={tween(f,942,972,50,0)}>Move faster.</Title>
    <div style={{position:'absolute',top:867,left:100,right:100,textAlign:'center',fontSize:30,color:'#7b91b2',opacity:reveal(f,974,994)}}>Your idea, straight to your workspace.</div>
  </AbsoluteFill>;
};

const LogoFormation:React.FC<{f:number}>=({f})=>{
  const spread=reveal(f,1098,1177),gather=reveal(f,1177,1314),tile=reveal(f,1200,1290),image=reveal(f,1294,1314),scale=510/1280;
  const map=(x:number,y:number)=>[705+x*scale,160+y*scale];
  const targets=[[230,432,420,432,495,430,505,600,635,600,690,600],[230,615,290,615,330,615,370,615,395,615,418,615],[230,793,420,793,495,793,505,630,635,630,690,630]];
  const wide=[[180,275,500,275,650,290,540,385,850,385,1120,385],[190,470,500,470,650,470,850,385,970,385,1120,385],[200,710,500,710,650,710,540,385,850,385,1120,385]];
  const baseline=[350,385,550,385,850,385,1040,385,1220,385,1570,385];
  const paths=targets.map((arr,i)=>{
    const p=[];for(let n=0;n<arr.length;n+=2){const target=map(arr[n],arr[n+1]);p.push(mix(mix(baseline[n],wide[i][n],spread),target[0],gather),mix(mix(baseline[n+1],wide[i][n+1],spread),target[1],gather));}
    return `M ${p[0]} ${p[1]} C ${p[2]} ${p[3]}, ${p[4]} ${p[5]}, ${p[6]} ${p[7]} C ${p[8]} ${p[9]}, ${p[8]} ${p[9]}, ${p[10]} ${p[11]}`;
  });
  const mint=map(1043,628);
  return <AbsoluteFill>
    <div style={{position:'absolute',left:705,top:160,width:510,height:510,opacity:tile,transform:`perspective(2000px) rotateY(${tween(f,1200,1314,-25,0)}deg) rotateX(${tween(f,1200,1314,12,0)}deg)`,transformOrigin:'center'}}><div style={{position:'absolute',left:35,top:44,width:430,height:426,borderRadius:68,background:BLUE}}/></div>
    <svg width="1920" height="1080" style={{position:'absolute',left:0,top:0,opacity:1-image}}>
      {paths.map((d,i)=><path key={i} d={d} stroke={tile>.15?'white':BLUE} strokeWidth={mix(8,33,gather)} fill="none" strokeLinecap="round"/>)}
      <path d={`M ${map(689,560).join(' ')} L ${map(742,615).join(' ')} L ${map(689,669).join(' ')}`} fill="none" stroke="white" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" opacity={reveal(f,1250,1292)}/>
      <path d={`M ${map(850,628).join(' ')} L ${map(953,628).join(' ')}`} fill="none" stroke="white" strokeWidth="33" strokeLinecap="round" opacity={reveal(f,1250,1292)}/>
      <circle cx={mix(1570,mint[0],gather)} cy={mix(385,mint[1],gather)} r={mix(11,13,gather)} fill={MINT}/>
    </svg>
    <Img src={staticFile('assets/logo.png')} style={{position:'absolute',left:705,top:160,width:510,height:510,opacity:image}}/>
    <div style={{position:'absolute',left:150,right:150,top:795,textAlign:'center',fontSize:44,color:'#6d83a6',opacity:1-reveal(f,1210,1250)}}>One idea. A clearer path.</div>
  </AbsoluteFill>;
};

const Brand:React.FC<{f:number}>=({f})=> <AbsoluteFill>
  <Img src={staticFile('assets/logo.png')} style={{position:'absolute',left:705,top:160,width:510,height:510}}/>
  <Title top={708} left={100} align="center" size={99} opacity={reveal(f,1323,1350)} dy={tween(f,1323,1350,24,0)}>Input to English</Title>
  <div style={{position:'absolute',top:842,left:100,right:100,textAlign:'center',fontSize:57,fontWeight:600,color:BLUE,opacity:reveal(f,1360,1390),transform:`translateY(${tween(f,1360,1390,18,0)}px)`}}>Get more done.</div>
</AbsoluteFill>;

const Debug:React.FC<{f:number}>=({f})=>{
  const markers=[15,123,447,880,1098,1314];
  const near=[15,447,880,1314].some(m=>f>=m&&f<m+8);
  return <>
    <div style={{position:'absolute',right:66,top:52,fontSize:24,letterSpacing:1,color:'#7b8fab'}}>RHYTHM DEMO · A / 28s</div>
    <div style={{position:'absolute',left:64,right:64,bottom:58,height:3,background:'#d8e3f3'}}><div style={{width:`${(f/(FRAMES-1))*100}%`,height:3,background:BLUE}}/>{markers.map(m=><div key={m} style={{position:'absolute',left:`${m/(FRAMES-1)*100}%`,top:-4,width:3,height:11,background:'#9aaccc'}}/>)}</div>
    <div style={{position:'absolute',left:64,bottom:17,fontSize:25,color:'#6f82a2',fontVariantNumeric:'tabular-nums'}}>{(f/60).toFixed(2)}s / 28.00s · {stateAt(f).shot}</div>
    <div style={{position:'absolute',right:64,bottom:17,fontSize:23,color:near?BLUE:'#91a1b9'}}>{near?'● MUSIC HIT':'UI / perspective / paths = rough blocking'}</div>
  </>;
};

export const Demo28:React.FC<{audio?:boolean;labels?:boolean}> = ({audio=true,labels=true})=>{
  const f=useCurrentFrame();
  return <AbsoluteFill style={{background:'#eef4ff',fontFamily:family,color:INK,overflow:'hidden'}}>
    <AbsoluteFill style={{backgroundImage:'linear-gradient(#b8c9e11a 1px, transparent 1px), linear-gradient(90deg,#b8c9e11a 1px, transparent 1px)',backgroundSize:'96px 96px'}}/>
    <div style={{position:'absolute',left:64,top:37,display:'flex',alignItems:'center',gap:16}}><Img src={staticFile('assets/logo.png')} style={{width:60,height:60}}/><span style={{fontSize:26,fontWeight:600,color:'#6680a6'}}>Input to English</span></div>
    {f<123&&<Idea f={f}/>}
    {f>=123&&f<330&&<Detour f={f}/>}
    {f>=330&&f<630&&<OneClick f={f}/>}
    {f>=630&&f<890&&<Platforms f={f}/>}
    {f>=880&&f<1102&&<Momentum f={f}/>}
    {f>=1098&&f<1314&&<LogoFormation f={f}/>}
    {f>=1314&&<Brand f={f}/>}
    {labels&&<Debug f={f}/>}
    {audio&&<Audio src={staticFile('audio/demo28/master.wav')}/>}
  </AbsoluteFill>;
};
