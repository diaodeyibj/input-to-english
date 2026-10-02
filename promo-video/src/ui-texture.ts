import * as THREE from 'three';
import {LANGUAGES} from './timing.mjs';
import {clamp} from './math';
const W=2800,H=1600;
const FONT='"Segoe UI", "Microsoft YaHei", "Yu Gothic", "Malgun Gothic", sans-serif';
const INK='#152033', BLUE='#3158d4';
const rect=(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,color:string)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
const text=(c:CanvasRenderingContext2D,s:string,x:number,y:number,size:number,color=INK,weight='500',align:CanvasTextAlign='left')=>{c.font=`${weight} ${size}px ${FONT}`;c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(s,x,y);};
const wrap=(c:CanvasRenderingContext2D,s:string,x:number,y:number,max:number,size:number)=>{
 c.font=`500 ${size}px ${FONT}`;let line='',row=0;
 const units=/\s/.test(s)?s.split(/(?<=\s)/):Array.from(s);
 for(const unit of units){if(line&&c.measureText(line+unit).width>max){text(c,line.trimEnd(),x,y+row*size*1.42,size);line='';row++;}line+=unit;}
 if(line)text(c,line,x,y+row*size*1.42,size);
};
function chrome(c:CanvasRenderingContext2D,host:string){
 c.clearRect(0,0,W,H);c.save();c.beginPath();c.roundRect(0,0,W,H,70);c.clip();
 rect(c,0,0,W,H,0,host==='Claude'?'#faf9f5':'#ffffff');
 const g=c.createLinearGradient(0,0,0,130);g.addColorStop(0,'#f8fbff');g.addColorStop(1,'#e9eff7');c.fillStyle=g;c.fillRect(0,0,W,130);
 ['#ff938c','#f5c66e','#80c8a0'].forEach((color,i)=>{c.fillStyle=color;c.beginPath();c.arc(82+i*58,65,15,0,Math.PI*2);c.fill();});
 rect(c,670,26,1460,78,30,'#f8fbfe');text(c,host==='Settings'?'Input to English · Settings':host==='Claude'?'claude.ai':'chatgpt.com',1400,81,35,'#62718c','400','center');
 c.strokeStyle='#d8e1ee';c.lineWidth=2;c.beginPath();c.moveTo(0,131);c.lineTo(W,131);c.stroke();
}
function settings(c:CanvasRenderingContext2D){
 rect(c,0,132,W,H-132,0,'#eef3f8');c.strokeStyle='rgba(49,88,212,.08)';c.lineWidth=2;
 for(let x=0;x<W;x+=160){c.beginPath();c.moveTo(x,132);c.lineTo(x,H);c.stroke();}
 rect(c,304,238,10,350,5,BLUE);c.fillStyle=BLUE;c.beginPath();c.moveTo(286,576);c.lineTo(332,576);c.lineTo(309,608);c.fill();
 text(c,'INPUT → ENGLISH',370,270,40,BLUE,'600');
 text(c,'Choose the route',370,430,136,INK,'700');text(c,'your words take.',370,579,136,INK,'700');
 text(c,'Translate in place. Choose your provider.',374,659,47,'#64748b');
 const names=['Browser Local','DeepSeek','Kimi'];
 names.forEach((name,i)=>{const y=730+i*257;c.shadowColor='rgba(37,57,91,.08)';c.shadowBlur=32;c.shadowOffsetY=14;rect(c,304,y,2200,223,46,'#ffffff');c.shadowBlur=0;c.shadowOffsetY=0;
 c.strokeStyle=i===0?BLUE:'#dce4ee';c.lineWidth=i===0?5:2;c.beginPath();c.roundRect(304,y,2200,223,46);c.stroke();
 if(i===0)rect(c,305,y+30,9,163,4,BLUE);
 c.strokeStyle=i===0?BLUE:'#b8c6d8';c.lineWidth=5;c.beginPath();c.arc(398,y+110,20,0,Math.PI*2);c.stroke();if(i===0){c.fillStyle=BLUE;c.beginPath();c.arc(398,y+110,10,0,Math.PI*2);c.fill();}
 text(c,name,469,y+107,83,INK,'600');text(c,i===0?'On-device translation':'Your API key. Your choice.',474,y+168,44,'#6a7a91');
 rect(c,2095,y+69,295,75,36,i===0?'#e5f5ef':'#f0ebff');text(c,i===0?'LOCAL':'CLOUD',2242,y+120,36,i===0?'#08775d':'#7454ac','600','center');
 });
}
export function drawUI(canvas:HTMLCanvasElement,frame:number,host='ChatGPT',fixedLanguage?:number){
 const c=canvas.getContext('2d')!;chrome(c,host);
 if(host==='Settings'){settings(c);c.restore();return;}
 text(c,'☰',75,242,58,'#66758a');text(c,host,171,244,55,INK,'600');
 rect(c,W-195,180,86,86,43,host==='Claude'?'#eadfd2':'#e7eef9');text(c,'A',W-152,238,40,'#66758a','500','center');
 c.textAlign='center';
 if(host==='Claude'){c.font='500 106px Georgia, serif';c.fillStyle='#373a35';c.fillText('How can I help you today?',W/2,580);}else{text(c,'What can I help with?',W/2,580,112,INK,'600','center');}
 text(c,'',W/2,672,42,'#8794a6','400','center');
 c.shadowColor='rgba(52,69,97,.12)';c.shadowBlur=65;c.shadowOffsetY=24;
 rect(c,331,801,2138,531,70,host==='Claude'?'#ffffff':'#f8fafc');c.shadowBlur=0;c.shadowOffsetY=0;
 c.strokeStyle='#d6dfeb';c.lineWidth=3;c.beginPath();c.roundRect(331,801,2138,531,70);c.stroke();
 let value='';
 if(fixedLanguage!==undefined)value=LANGUAGES[fixedLanguage%8].short;
 else if(frame<200)value=frame>96?'帮我…':'';
 else if(frame<600){const i=Math.min(7,Math.floor((frame-200)/50));const item=LANGUAGES[i];const chars=Math.max(1,Math.floor((frame-item.start)/3)+1);value=item.short.slice(0,chars);}
 else if(frame<720)value=LANGUAGES[7].full;
 else value='Help me come up with a new design.';
 if(value){wrap(c,value,443,977,1880,frame>=720?100:121);}else{text(c,'Ask anything',443,977,112,'#a4afbd','400');}
 text(c,'+',440,1245,83,'#57677e','400');
 const busy=frame>=600&&frame<720&&fixedLanguage===undefined;
 const buttonX=busy?1855:2045,buttonWidth=busy?421:240;
 if(frame>=594&&frame<612&&fixedLanguage===undefined){rect(c,buttonX-17,1165,buttonWidth+34,136,30,'#d7e6ff');}
 rect(c,buttonX,1182,buttonWidth,102,19,busy?'#34425a':'#202a3a');text(c,busy?'Translating…':'-> EN',buttonX+buttonWidth/2,1251,busy?46:58,'#d7dde8','600','center');
 if(frame>=720&&fixedLanguage===undefined)text(c,'Undo',1880,1249,48,'#627594','500');
 c.fillStyle=host==='Claude'?'#d87955':'#1d2939';c.beginPath();c.arc(2371,1234,53,0,Math.PI*2);c.fill();text(c,'↑',2371,1260,70,'white','500','center');
 text(c,host==='Claude'?'Claude can make mistakes. Please double-check responses.':'ChatGPT can make mistakes. Check important info.',W/2,1470,30,'#8995a5','400','center');
 if(frame>=576&&frame<648&&fixedLanguage===undefined){const k=clamp((frame-576)/24);const px=2520+(2163-2520)*k,py=1450+(1240-1450)*k;c.save();c.translate(px,py);c.fillStyle='white';c.strokeStyle='#152033';c.lineWidth=6;c.beginPath();c.moveTo(0,0);c.lineTo(0,106);c.lineTo(27,80);c.lineTo(51,128);c.lineTo(76,115);c.lineTo(51,69);c.lineTo(89,63);c.closePath();c.fill();c.stroke();c.restore();}
 c.restore();
}
export function createUITexture(){const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;texture.minFilter=THREE.LinearMipmapLinearFilter;return {canvas,texture};}
