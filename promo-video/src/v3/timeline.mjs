import voices from './voice-timing.json' with {type:'json'};
export const FPS=60,DURATION=2400,BPM=144;
export const EVENTS={languages:100,overhead:900,settings:1100,select:1230,reveal:1380,click:1400,benefits:1600,english:1800,mint:1980,morph:2000,brand:2200};
export const LANGUAGES=[['zh','帮我…','中文'],['ja','手伝って…','日本語'],['ko','도와줘…','한국어'],['de','Hilf mir…','Deutsch'],['es','Ayúdame…','Español'],['fr','Aide-moi…','Français'],['it','Aiutami…','Italiano'],['ru','Помоги мне…','Русский']].map(([id,short,label],i)=>({id,short,label,start:100+i*100,voiceFrames:voices[id]?.frames??68,onset:voices[id]?.onset??0,characters:voices[id]?.characters??[],inputText:voices[id]?.characters?.length?voices[id].text+(voices[id].clipped?'…':''):short,clipped:voices[id]?.clipped??false}));
export const ENGLISH='Help me design a new logo.';
export const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const range=(f,a,b)=>smooth((f-a)/(b-a));
export const mix=(a,b,t)=>a+(b-a)*t;
export const point=(a,b,t)=>a.map((x,i)=>mix(x,b[i],t));
export const graphemes=s=>Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(s),x=>x.segment);
export const typed=(text,f,a,b)=>{const chars=graphemes(text);return f<a?'':chars.slice(0,Math.min(chars.length,1+Math.floor(clamp((f-a)/Math.max(1,b-a))*(chars.length-1)))).join('');};
export const inputClicks=LANGUAGES.map(l=>l.start-2);
export const overviewStart=Math.max(900,LANGUAGES[7].start+LANGUAGES[7].voiceFrames+3);
export const overviewEnd=overviewStart+55;
export const languageState=(i,f)=>{const l=LANGUAGES[i],begin=l.start+l.onset,end=l.start+l.voiceFrames,recede=Math.max(end+3,l.start+74);let value=l.characters.length?l.characters.filter(c=>f>=c.frame).map(c=>c.character).join(''):typed(l.short,f,begin,end-5);if(l.clipped&&f>=end)value+='…';return{visible:f>=l.start-24,voiceEnd:end,recede,value};};
export const recessionProgress=(f,recede)=>range(f,recede,recede+32);
const origins=[[0,0,0],[12,1,-2],[24,-1,-3],[36,1.1,-1],[48,-.5,-3],[60,1,-2],[72,-1,-3],[84,.5,-1]];
const orbit=[[-6,1,-2],[-2,4,-3],[4,3,-2],[8,-1,-4],[2,-4,-1],[-6,-3,-2],[-10,-.7,-5],[7,5,-4]];
export const buttonVisible=f=>f>=EVENTS.reveal&&f<1420;
const rawWindowAt=(i,f)=>{
 const l=LANGUAGES[i],s=languageState(i,f),r=recessionProgress(f,s.recede),overview=range(f,overviewStart,overviewEnd);
 let position=point(origins[i],orbit[i],overview),scale=mix(1,.48,r);
 position[1]+=Math.sin(f*.013+i)*.055*r;position[2]-=r*.7;
 if(f>=overviewEnd&&f<1100){const focus=range(f,overviewEnd,overviewEnd+30);position=point(position,i===0?[-3.8,-.4,.2]:orbit[i],focus);scale=mix(scale,i===0?.78:.36,focus);}
 if(f>=1100&&f<1360){position=point(position,orbit[i],range(f,1100,1140));scale=mix(.45,.3,range(f,1100,1140));}
 if(f>=1360){position=point(orbit[i],i===0?[0,0,0]:orbit[i],range(f,1360,1390));scale=mix(.3,i===0?1:.33,range(f,1360,1390));}
 const fade=range(f,1430+i*8,1540+i*5);
 const opacity=(f<950?1:f<1360?i===0&&f<1100?1:.3:1)*(1-fade);
 return {position,scale,opacity,rotation:[.025+Math.sin(f*.004+i)*.01,mix(-.055,0,overview),mix(i%2?-.012:.012,0,overview)]};
};
export const windowAt=(i,f)=>{
 const boundary=[1100,1360].find(c=>Math.abs(f-c)<12);
 if(boundary===undefined)return rawWindowAt(i,f);
 const a=rawWindowAt(i,boundary-12),b=rawWindowAt(i,boundary+12),t=range(f,boundary-12,boundary+12);
 return {position:point(a.position,b.position,t),rotation:point(a.rotation,b.rotation,t),scale:mix(a.scale,b.scale,t),opacity:mix(a.opacity,b.opacity,t)};
};
const rawCameraAt=f=>{
 let target=[0,-.2,0],position=[1,1.1,20];
 if(f<100){target=point([.5,.2,0],[1,-.55,0],range(f,25,95));position=point([3,1.5,20],[.9,-.35,14.7],range(f,15,95));}
 else if(f<overviewEnd){const i=Math.min(7,Math.floor((f-100)/100)),local=Math.min(100,f-LANGUAGES[i].start),next=Math.min(7,i+1);const t=range(local,76,100);target=point(origins[i],origins[next],t);target[1]-=.35;const distance=mix(18,14.9,range(local,0,22)*(1-range(local,69,95)));position=[target[0]+mix(.65,-.4,range(local,10,76)),target[1]+.6,target[2]+distance];if(f>=overviewStart){const p=range(f,overviewStart,overviewEnd);target=point(target,[.2,-.1,0],p);position=point(position,[-.5,.5,22.4],p);}}
 else if(f<1100){target=[.2,-.1,0];position=[Math.sin(f*.01)*.55,.5,22.4-Math.sin((f-900)*.006)*.6];}
 else if(f<1360){const p=range(f,1100,1140),zoom=range(f,1200,1260)*(1-range(f,1310,1360));target=[mix(0,-.25,p),mix(0,-.2,zoom),1];position=[mix(-.5,.55,p),mix(.5,.1,zoom),mix(22,16.7,p)-zoom*1.2];}
 else if(f<1460){const p=range(f,1360,1394);target=point([-.25,0,1],[3.6,-1.55,.8],p);position=point([.55,.2,17],[3.65,-.7,10.2],p);if(f>=1403){const q=range(f,1403,1460);target=point(target,[0,0,0],q);position=point(position,[.6,.7,24],q);}}
 else if(f<1600){target=[mix(0,.4,range(f,1460,1600)),0,0];position=[mix(.6,-.5,range(f,1460,1600)),.65,24];}
 else if(f<1800){target=[0,0,0];position=[mix(-.5,.6,range(f,1600,1800)),.4,22];}
 else if(f<2000){target=[0,-.65,1];position=[mix(.6,-.1,range(f,1800,1990)),.25,mix(21,19,range(f,1800,1990))];}
 else {target=[0,mix(-.65,.65,range(f,2000,2180)),1];position=[Math.sin(f*.003)*.08,.35,mix(19,17.5,range(f,2000,2200))];}
 return {target,position};
};
export const cameraAt=f=>{
 const boundary=[100,200,300,400,500,600,700,800,overviewEnd,1100,1360,1460,1600,1800,2000].find(c=>Math.abs(f-c)<12);
 if(boundary===undefined)return rawCameraAt(f);
 const a=rawCameraAt(boundary-12),b=rawCameraAt(boundary+12),t=range(f,boundary-12,boundary+12);
 return {position:point(a.position,b.position,t),target:point(a.target,b.target,t)};
};
export const pointerAt=f=>{
 if(f<100)return point([4,-2.5,.9],[-.9,-.7,.9],range(f,10,92));
 if(f<900){const i=Math.min(7,Math.floor((f-100)/100)),p=windowAt(i,f).position,local=(f-100)%100,next=windowAt(Math.min(7,i+1),f).position;return point([p[0]-.9+Math.min(local,50)*.006,p[1]-.7,p[2]+.9],[next[0]-.9,next[1]-.7,next[2]+.9],range(local,76,100));}
 if(f<1100)return point([-4,-1,1],[5.02,3.0,1.1],range(f,1000,1095));
 if(f<1360)return f<1230?point([5.02,3.0,1.1],[-4.78,-.35,1.5],range(f,1130,1225)):point([-4.78,-.35,1.5],[4.8,-2,1.5],range(f,1275,1350));
 return point([4.8,-2,1.5],[4.05,-1.77,.7],range(f,1360,1396));
};
export const phaseAt=f=>f<100?'intro':f<900?'languages':f<1100?'overhead':f<1400?'settings':f<1600?'converge':f<1800?'benefits':f<2000?'english':f<2200?'morph':'brand';
