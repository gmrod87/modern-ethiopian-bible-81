const fs=require('fs');
const file='release68-audio-postbuild.js';
let s=fs.readFileSync(file,'utf8');
const tick=String.fromCharCode(96);
const escapedTick='\\'+tick;
const replace=(from,to,label)=>{
  if(!s.includes(from))throw new Error('Release68 prep missing: '+label);
  s=s.replace(from,to);
};
replace(
  "function ttsKey(text,mode){return "+escapedTick+"${mode||'normal'}|${clean(text)}"+escapedTick+"}",
  "function ttsKey(text,mode){return (mode||'normal')+'|'+clean(text)}",
  'tts key'
);
replace(
  "currentReference:"+escapedTick+"${b.title} ${c.n}:${v}"+escapedTick,
  "currentReference:b.title+' '+c.n+':'+v",
  'quick reference'
);
replace(
  "scripture:nearby.map(x=>"+escapedTick+"${x.v}. ${x.t}"+escapedTick+").join('\\\\n')",
  "scripture:nearby.map(x=>x.v+'. '+x.t).join('\\\\n')",
  'quick scripture'
);
s=s.replace(
  "if(text===lastVoice&&now-lastVoiceAt<450)return;",
  "if(now-lastVoiceAt<650&&(text===lastVoice||text.startsWith(lastVoice)||lastVoice.startsWith(text)))return;"
);
fs.writeFileSync(file,s);
console.log('Hobah Release 68 prep: safe audio patch source prepared');
