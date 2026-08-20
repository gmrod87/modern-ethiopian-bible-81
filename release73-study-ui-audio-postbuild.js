const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='73',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js')))throw new Error('Release73: dist/app.js missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release73 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='72';","const V='73';",'runtime version');

const oldNarrate=`async function narrateStudyAnswer(text,autoResume=false){
  const parts=splitForTTS(text,850);if(!parts.length){if(autoResume)resumeScriptureAfterStudy();return}
  let sa=state.audio.studyAudio;if(!sa){sa=document.createElement('audio');sa.hidden=true;sa.className='studyAudio';sa.setAttribute('playsinline','');document.body.appendChild(sa);state.audio.studyAudio=sa}
  setAudioStatus('Study AI explanation');$('#audioRef').textContent='Study AI';
  for(let i=0;i<parts.length;i++){
    try{
      const blob=await getSpeechBlob(parts[i],'normal'),url=URL.createObjectURL(blob);sa.src=url;sa.load();await new Promise((resolve,reject)=>{sa.onended=resolve;sa.onerror=reject;sa.play().catch(reject)});URL.revokeObjectURL(url);
    }catch(e){console.warn(e);break}
  }
  if(autoResume)resumeScriptureAfterStudy();
}`;

const newNarrate=`function browserSpeakStudyPart(text){
  return new Promise(resolve=>{
    if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance){resolve(false);return}
    try{
      const u=new SpeechSynthesisUtterance(text);u.rate=.92;u.pitch=1;u.volume=1;
      const voices=window.speechSynthesis.getVoices?.()||[],v=voices.find(x=>/Samantha|Karen|Daniel|Serena|Moira/i.test(x.name))||voices.find(x=>/^en[-_]/i.test(x.lang));if(v)u.voice=v;
      let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(t);resolve(ok)};
      const t=setTimeout(()=>{try{window.speechSynthesis.cancel()}catch{}finish(false)},45000);
      u.onend=()=>finish(true);u.onerror=()=>finish(false);window.speechSynthesis.speak(u);
    }catch{resolve(false)}
  });
}
async function narrateStudyAnswer(text,autoResume=false){
  text=compactStudyAnswer(clean(text),300);
  const parts=splitForTTS(text,360);if(!parts.length){if(autoResume)resumeScriptureAfterStudy();return}
  let sa=state.audio.studyAudio;if(!sa){sa=document.createElement('audio');sa.hidden=true;sa.className='studyAudio';sa.setAttribute('playsinline','');document.body.appendChild(sa);state.audio.studyAudio=sa}
  setAudioStatus('Study AI explanation');const ref=$('#audioRef');if(ref)ref.textContent='Study AI';
  for(let i=0;i<parts.length;i++){
    const part=parts[i];setAudioStatus('Study AI • '+(i+1)+' of '+parts.length);
    let played=false;
    for(let attempt=0;attempt<2&&!played;attempt++){
      let url='';
      try{
        const blob=await getSpeechBlob(part,'normal');url=URL.createObjectURL(blob);sa.src=url;sa.load();claimVoiceChannel(sa);
        await new Promise((resolve,reject)=>{
          let settled=false;const finish=(err)=>{if(settled)return;settled=true;clearTimeout(timer);sa.onended=null;sa.onerror=null;err?reject(err):resolve()};
          const timer=setTimeout(()=>finish(new Error('Study audio chunk timed out')),45000);
          sa.onended=()=>finish();sa.onerror=()=>finish(new Error('Study audio chunk failed'));claimVoiceChannel(sa);sa.play().catch(finish);
        });
        played=true;
      }catch(e){console.warn('Study narration chunk '+(i+1)+' attempt '+(attempt+1),e)}finally{if(url)try{URL.revokeObjectURL(url)}catch{}}
    }
    if(!played){
      claimVoiceChannel(null);played=await browserSpeakStudyPart(part);
      if(!played)console.warn('Study narration skipped one failed chunk');
    }
  }
  setAudioStatus('Study AI • finished');if(autoResume)resumeScriptureAfterStudy();
}`;
swap(oldNarrate,newNarrate,'full Study AI narration queue');

// Shorter, clearer labels.
swap(
"function studyActionHTML(i){return '<div class=\"studyMsgActions\"><button type=\"button\" data-study-read=\"'+i+'\">▶ Read aloud</button><button type=\"button\" data-study-save=\"'+i+'\">♡ Save to library</button></div>'}",
"function studyActionHTML(i){return '<div class=\"studyMsgActions\"><button type=\"button\" data-study-read=\"'+i+'\">▶ Read aloud</button><button type=\"button\" data-study-save=\"'+i+'\">♡ Save</button></div>'}",
'compact Study AI labels'
);

fs.writeFileSync(p('app.js'),app);
fs.appendFileSync(p('styles.css'),`\n/* Hobah Release 73 — compact Study AI actions */\n.studyMsgActions{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;width:auto!important;margin:10px 0 0!important;position:static!important}.studyMsgActions button{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:0!important;min-height:38px!important;height:38px!important;padding:0 14px!important;border:1px solid #0d4c3f!important;border-radius:999px!important;background:#0d4c3f!important;color:#f3efe5!important;box-shadow:none!important;font:800 12px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif!important;white-space:nowrap!important}.studyMsgActions button:hover{background:#153f36!important}.studyMsgActions button:active{transform:scale(.98)}.studyMsgActions button:disabled{opacity:.55!important}.studyMsg.assistant{max-width:100%!important}@media(max-width:560px){.studyMsgActions{gap:7px!important;flex-wrap:wrap!important}.studyMsgActions button{height:36px!important;min-height:36px!important;padding:0 12px!important;font-size:11.5px!important}}\n`);

let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=72','/styles.css?v=73').replace('/app.js?v=72','/app.js?v=73').replace('/manifest.webmanifest?v=72','/manifest.webmanifest?v=73');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=73#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 73: compact Study AI controls and full 300-word narration applied');
