export const FPS = 60;
export const FRAMES = 1680;
export const NATIVE = '帮我设计一个更有创意的新标志。';
export const ENGLISH = 'Help me design a more creative new logo.';
export const EVENTS = {firstHit:15, detour:123, simplify:330, click:447, english:528, platforms:630, claude:744, lift:880, textLift:1044, morph:1098, brand:1314, fade:1644};
export const MAIN = {x:240,y:290,width:1440,height:580};
export const EDITOR = {x:44,y:190,width:1352,height:272};
export const EN_RECT = {x:MAIN.x+EDITOR.x+EDITOR.width-24-132,y:MAIN.y+EDITOR.y+EDITOR.height-18-64,width:132,height:64};
export const clamp = (v) => Math.max(0,Math.min(1,v));
export const ease = (v) => 1-Math.pow(1-clamp(v),3);
export const progress = (f,a,b) => clamp((f-a)/(b-a));
export const tween = (f,a,b,x,y) => x+(y-x)*ease(progress(f,a,b));
export const mix = (a,b,t) => a+(b-a)*t;
export function cursorAt(f) {
  const end = {x:EN_RECT.x+EN_RECT.width/2,y:EN_RECT.y+EN_RECT.height/2};
  if(f<390) return {x:1770,y:890,opacity:0};
  if(f<=447) return {x:tween(f,390,440,1760,end.x),y:tween(f,390,440,890,end.y),opacity:progress(f,390,400)};
  return {x:tween(f,462,535,end.x,1720),y:tween(f,462,535,end.y,915),opacity:1-progress(f,550,580)};
}
export function stateAt(f) {
  const shot=f<123?'Idea':f<330?'Detour':f<630?'One click':f<880?'Two platforms':f<1098?'Momentum':f<1314?'Logo formation':'Brand';
  return {frame:f,shot,host:f<744?'ChatGPT':'Claude',text:f<528?NATIVE:ENGLISH,busy:f>=447&&f<528};
}
