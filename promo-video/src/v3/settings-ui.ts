const FONT='"Segoe UI", "Microsoft YaHei", sans-serif';
function rect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,color:string){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function text(c:CanvasRenderingContext2D,s:string,x:number,y:number,size:number,color='#152033',weight=500){c.font=`${weight} ${size}px ${FONT}`;c.fillStyle=color;c.textAlign='left';c.textBaseline='alphabetic';c.fillText(s,x,y);}
export function drawSettings(canvas:HTMLCanvasElement,frame:number){
 const c=canvas.getContext('2d')!;c.clearRect(0,0,2800,1600);c.save();c.beginPath();c.roundRect(0,0,2800,1600,65);c.clip();
 rect(c,0,0,2800,1600,0,'#eef3f8');rect(c,0,0,2800,125,0,'#f8fbff');
 ['#ff938c','#f5c66e','#80c8a0'].forEach((v,i)=>{c.fillStyle=v;c.beginPath();c.arc(78+i*53,63,14,0,Math.PI*2);c.fill();});
 text(c,'Input to English · Settings',970,84,40,'#62718a');
 rect(c,165,193,8,262,4,'#3158d4');text(c,'INPUT → ENGLISH',203,237,36,'#2343a4',700);
 text(c,'Choose the route your words take.',203,348,92,'#152033',650);
 text(c,'Pick one translation provider. Text is sent only when you press → EN.',203,425,41,'#5c6879');
 text(c,'Display language',2160,221,32,'#62718a');rect(c,2157,241,465,62,14,'#ffffff');text(c,'English  ▾',2193,286,36);
 rect(c,165,485,2475,108,24,'#ffffff');
 text(c,'Local providers keep prompt text on this device.',210,552,34,'#08775d');
 text(c,'Cloud sends text to the provider you select.',1482,552,34,'#6940a5');
 const selected=frame>=1230?1:0;
 ['Browser Local','DeepSeek','Kimi'].forEach((name,i)=>{
  const x=165,y=[627,833,1165][i],height=i?309:184,active=i===selected;
  rect(c,x,y,2475,height,29,'#ffffff');c.strokeStyle=active?'#3158d4':'#cbd6e4';c.lineWidth=active?6:2;c.beginPath();c.roundRect(x,y,2475,height,29);c.stroke();
  if(active)rect(c,x+2,y+26,7,height-52,3,'#3158d4');
  c.strokeStyle=active?'#3158d4':'#aebed4';c.lineWidth=4;c.beginPath();c.arc(x+58,y+54,17,0,Math.PI*2);c.stroke();if(active){c.fillStyle='#3158d4';c.beginPath();c.arc(x+58,y+54,9,0,Math.PI*2);c.fill();}
  text(c,name,x+102,y+69,48,'#152033',650);rect(c,x+2250,y+25,170,49,25,i?'#f1eafa':'#e5f5ef');text(c,i?'CLOUD':'LOCAL',x+2280,y+59,29,i?'#6940a5':'#08775d',650);
  text(c,i?`Sends only the prompt you translate to the official ${name} API.`:'Uses browser language tools and downloads supported language packs on demand.',x+102,y+115,35,'#5c6879');
  if(i===0){text(c,'Browser capability',x+102,y+160,29,'#5c6879');rect(c,x+2000,y+117,416,49,12,'#edf2f8');text(c,'Check availability',x+2025,y+151,30,'#43536d',600);return;}
  text(c,'API key',x+102,y+160,28,'#5c6879');text(c,'Model ID',x+1300,y+160,28,'#5c6879');
  rect(c,x+100,y+172,1140,57,12,'#fbfdff');rect(c,x+1294,y+172,1118,57,12,'#fbfdff');
  text(c,'••••••••••••••••••••',x+128,y+213,38,'#62718a');text(c,i===1?'deepseek-chat':'kimi-k2.6',x+1322,y+213,35);
  ['Save credentials','Delete API key','Test connection'].forEach((v,j)=>{rect(c,x+100+j*594,y+245,560,46,12,j===0?'#3158d4':'#edf2f8');text(c,v,x+123+j*594,y+277,29,j===0?'#ffffff':'#43536d',600);});
 });
 text(c,'API keys stay in extension-local storage. They are never synced or placed in website content.',165,1542,34,'#62718a');c.restore();
}
