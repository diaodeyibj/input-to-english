export const FPS = 60;
export const DURATION = 1800;
export const BPM = 144;
export const EVENTS = {click:600, english:720, showcase:1000, brand:1400};
export const LANGUAGES = [
 {id:'zh',name:'CHINESE',short:'帮我设计…',full:'帮我设计一个更好的明天。',start:200},
 {id:'ja',name:'JAPANESE',short:'手伝って…',full:'新しいアイデアを考えるのを手伝って。',start:250},
 {id:'ko',name:'KOREAN',short:'도와줘…',full:'새로운 이야기를 만드는 걸 도와줘.',start:300},
 {id:'de',name:'GERMAN',short:'Hilf mir…',full:'Hilf mir, etwas Neues zu entwerfen.',start:350},
 {id:'es',name:'SPANISH',short:'Ayúdame…',full:'Ayúdame a escribir una nueva historia.',start:400},
 {id:'fr',name:'FRENCH',short:'Aide-moi…',full:'Aide-moi à imaginer la suite.',start:450},
 {id:'it',name:'ITALIAN',short:'Aiutami…',full:'Aiutami a creare qualcosa di nuovo.',start:500},
 {id:'ru',name:'RUSSIAN',short:'Помоги мне…',full:'Помоги мне придумать новый дизайн.',start:550},
];
export const phaseAt = frame => frame<200?'intro':frame<600?'languages':frame<1000?'transform':frame<1400?'showcase':'brand';
