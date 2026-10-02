export const FPS=60, DURATION=2400, BPM=144;
export const EVENTS={languages:200,benefits:1000,approach:1300,click:1400,bar:1510,english:1600,mint:1750,morph:1800,brand:2200};
export const LANGUAGES=[
 {id:'zh',short:'帮我设计…',start:200,voiceFrames:62},
 {id:'ja',short:'手伝って…',start:300,voiceFrames:60},
 {id:'ko',short:'도와줘…',start:400,voiceFrames:62},
 {id:'de',short:'Hilf mir…',start:500,voiceFrames:62},
 {id:'es',short:'Ayúdame…',start:600,voiceFrames:63},
 {id:'fr',short:'Aide-moi…',start:700,voiceFrames:63},
 {id:'it',short:'Aiutami…',start:800,voiceFrames:63},
 {id:'ru',short:'Помоги мне…',start:900,voiceFrames:50},
];
export const ENGLISH='Help me design a new logo.';
export const graphemes=s=>Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(s),x=>x.segment);
export const typed=(text,frame,start,end)=>{const chars=graphemes(text);if(frame<start)return '';return chars.slice(0,Math.min(chars.length,1+Math.floor(Math.max(0,frame-start)/Math.max(1,end-start)*(chars.length-1)))).join('');};
export const gridPosition=i=>[(i%4-1.5)*4.5,i<4?1.6:-1.55,-.55];
export const languageState=(i,frame)=>{const l=LANGUAGES[i];return {visible:frame>=l.start,voiceEnd:l.start+l.voiceFrames,shrinkStart:l.start+Math.max(68,l.voiceFrames+3),land:l.start+98,value:typed(l.short,frame,l.start,l.start+l.voiceFrames-8)};};
export const phaseAt=f=>f<200?'intro':f<1000?'languages':f<1300?'benefits':f<1400?'approach':f<1800?'converge':f<2200?'morph':'brand';
