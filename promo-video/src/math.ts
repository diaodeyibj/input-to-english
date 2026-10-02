export const clamp=(v:number,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const smooth=(v:number)=>{const x=clamp(v);return x*x*(3-2*x);};
export const range=(f:number,a:number,b:number)=>smooth((f-a)/(b-a));
export const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const beat=(f:number)=>Math.exp(-((f%25)/6));
export const seed=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
