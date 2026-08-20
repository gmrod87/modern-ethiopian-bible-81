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
  "app=app.replace(from,to);",
  "app=app.replace(from,()=>to);",
  'literal replacement function'
);
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
const finalPatches=`
swap(
  "async function askStudy(question,{speak=false,body=null,autoResume=false,quick=false}={}){\\n  await loadStudyData().catch(()=>{});",
  "async function askStudy(question,{speak=false,body=null,autoResume=false,quick=false}={}){\\n  if(!quick)await loadStudyData().catch(()=>{});",
  'skip full study preload for voice explain'
);
swap(
  "setAudioStatus('Returning to Scripture…');setTimeout(()=>resumeNarration(),220);",
  "setAudioStatus('Returning to Scripture…');setTimeout(()=>resumeNarration(),35);",
  'fast Scripture resume'
);
`;
replace(
  "fs.writeFileSync(p('app.js'),app);",
  finalPatches+"\\nfs.writeFileSync(p('app.js'),app);",
  'final low-latency patches'
);
fs.writeFileSync(file,s);
console.log('Hobah Release 68 prep: safe audio patch source prepared');
