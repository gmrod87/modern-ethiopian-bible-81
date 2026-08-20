const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='74',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js')))throw new Error('Release74: dist/app.js missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release74 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='73';","const V='74';",'runtime version');

swap(
"function studyActionHTML(i){return '<div class=\"studyMsgActions\"><button type=\"button\" data-study-read=\"'+i+'\">▶ Read aloud</button><button type=\"button\" data-study-save=\"'+i+'\">♡ Save</button></div>'}",
"function studyActionHTML(i){return '<div class=\"studyMsgActions\"><button type=\"button\" class=\"studyPhysicalBtn studyPlayBtn\" data-study-read=\"'+i+'\" data-state=\"play\" aria-label=\"Read explanation aloud\" title=\"Read aloud\"><span aria-hidden=\"true\">▶</span></button><button type=\"button\" class=\"studyPhysicalBtn studySaveBtn\" data-study-save=\"'+i+'\" aria-label=\"Save explanation\" title=\"Save\"><span aria-hidden=\"true\">♡</span></button></div>'}",
'physical Study AI controls'
);

const oldRead=`async function readStudyAnswer(text){
  text=clean(text);if(!text)return;if(state.audio.studyBusy){toast('Study AI is already speaking');return}
  const a=ensureScriptureAudio(),resume=!!(state.audio.playing&&a&&!a.paused);
  if(resume){a.pause();state.audio.resumeAfterStudy=true}
  state.audio.studyBusy=true;suspendRecognitionForStudy();claimVoiceChannel(null);
  try{await narrateStudyAnswer(text,false)}catch(e){console.warn('Study read aloud',e);toast('Read aloud was interrupted')}
  finally{state.audio.studyBusy=false;if(resume)resumeScriptureAfterStudy();resumeRecognitionAfterStudy()}
}`;
const newRead=`function setStudyReadButton(btn,state='play'){
  if(!btn)return;const icon=btn.querySelector('span')||btn;btn.dataset.state=state;
  icon.textContent=state==='pause'?'Ⅱ':state==='loading'?'…':'▶';
  btn.setAttribute('aria-label',state==='pause'?'Pause explanation':state==='loading'?'Preparing explanation':'Read explanation aloud');
}
function toggleCurrentStudyRead(btn,index){
  if(!state.audio.studyManualActive||state.audio.studyManualIndex!==index)return false;
  const sa=state.audio.studyAudio;
  if(state.audio.studyFallbackSpeaking&&'speechSynthesis'in window){
    if(window.speechSynthesis.paused){window.speechSynthesis.resume();setStudyReadButton(btn,'pause');setAudioStatus('Study AI • reading')}
    else{window.speechSynthesis.pause();setStudyReadButton(btn,'play');setAudioStatus('Study AI • paused')}
    return true;
  }
  if(!sa||!sa.src)return false;
  if(sa.paused){claimVoiceChannel(sa);sa.play().catch(()=>{});setStudyReadButton(btn,'pause');setAudioStatus('Study AI • reading')}
  else{sa.pause();setStudyReadButton(btn,'play');setAudioStatus('Study AI • paused')}
  return true;
}
async function readStudyAnswer(text,button=null,index=null){
  text=clean(text);if(!text)return;
  if(state.audio.studyBusy&&!state.audio.studyManualActive){toast('Study AI is already speaking');return}
  const a=ensureScriptureAudio(),resume=!!(state.audio.playing&&a&&!a.paused);
  if(resume){a.pause();state.audio.resumeAfterStudy=true}
  state.audio.studyBusy=true;state.audio.studyManualActive=true;state.audio.studyManualIndex=index;state.audio.studyManualButton=button;state.audio.studyFallbackSpeaking=false;
  setStudyReadButton(button,'loading');suspendRecognitionForStudy();claimVoiceChannel(null);
  try{await narrateStudyAnswer(text,false)}catch(e){console.warn('Study read aloud',e);toast('Read aloud was interrupted')}
  finally{
    setStudyReadButton(button,'play');state.audio.studyManualActive=false;state.audio.studyManualIndex=null;state.audio.studyManualButton=null;state.audio.studyFallbackSpeaking=false;state.audio.studyBusy=false;
    if(resume)resumeScriptureAfterStudy();resumeRecognitionAfterStudy();
  }
}`;
swap(oldRead,newRead,'play pause Study AI control');

const oldWire=`function wireStudyActions(body){
  if(!body||body.dataset.studyActions==='1')return;body.dataset.studyActions='1';
  body.addEventListener('click',async e=>{
    const rb=e.target.closest('[data-study-read]'),sb=e.target.closest('[data-study-save]');
    if(rb){const i=+rb.dataset.studyRead,m=state.studyHistory[i];if(!m||m.role!=='assistant')return;rememberStudyAnswer(m.text,state.studyHistory[i-1]?.role==='user'?state.studyHistory[i-1].text:'');const old=rb.textContent;rb.disabled=true;rb.textContent='Reading…';try{await readStudyAnswer(m.text)}finally{rb.disabled=false;rb.textContent=old}return}
    if(sb){const i=+sb.dataset.studySave,m=state.studyHistory[i];if(!m||m.role!=='assistant')return;saveStudyExplanation(rememberStudyAnswer(m.text,state.studyHistory[i-1]?.role==='user'?state.studyHistory[i-1].text:''))}
  });
}`;
const newWire=`function wireStudyActions(body){
  if(!body||body.dataset.studyActions==='1')return;body.dataset.studyActions='1';
  body.addEventListener('click',async e=>{
    const rb=e.target.closest('[data-study-read]'),sb=e.target.closest('[data-study-save]');
    if(rb){
      const i=+rb.dataset.studyRead,m=state.studyHistory[i];if(!m||m.role!=='assistant')return;
      if(toggleCurrentStudyRead(rb,i))return;
      rememberStudyAnswer(m.text,state.studyHistory[i-1]?.role==='user'?state.studyHistory[i-1].text:'');
      await readStudyAnswer(m.text,rb,i);return;
    }
    if(sb){
      const i=+sb.dataset.studySave,m=state.studyHistory[i];if(!m||m.role!=='assistant')return;
      if(saveStudyExplanation(rememberStudyAnswer(m.text,state.studyHistory[i-1]?.role==='user'?state.studyHistory[i-1].text:''))){const icon=sb.querySelector('span');if(icon)icon.textContent='♥';sb.classList.add('saved')}
    }
  });
}`;
swap(oldWire,newWire,'Study AI physical button wiring');

const oldNarrate=`function browserSpeakStudyPart(text){
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
const newNarrate=`function browserSpeakStudyPart(text){
  return new Promise(resolve=>{
    if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance){resolve(false);return}
    try{
      const u=new SpeechSynthesisUtterance(text);u.rate=.92;u.pitch=1;u.volume=1;
      const voices=window.speechSynthesis.getVoices?.()||[],v=voices.find(x=>/Samantha|Karen|Daniel|Serena|Moira/i.test(x.name))||voices.find(x=>/^en[-_]/i.test(x.lang));if(v)u.voice=v;
      state.audio.studyFallbackSpeaking=true;setStudyReadButton(state.audio.studyManualButton,'pause');
      let done=false;const finish=ok=>{if(done)return;done=true;state.audio.studyFallbackSpeaking=false;clearTimeout(t);resolve(ok)};
      const t=setTimeout(()=>{try{window.speechSynthesis.cancel()}catch{}finish(false)},60000);
      u.onend=()=>finish(true);u.onerror=()=>finish(false);window.speechSynthesis.speak(u);
    }catch{state.audio.studyFallbackSpeaking=false;resolve(false)}
  });
}
async function narrateStudyAnswer(text,autoResume=false){
  text=compactStudyAnswer(clean(text),300);
  const parts=splitForTTS(text,650);if(!parts.length){if(autoResume)resumeScriptureAfterStudy();return}
  let sa=state.audio.studyAudio;if(!sa){sa=document.createElement('audio');sa.hidden=true;sa.className='studyAudio';sa.setAttribute('playsinline','');document.body.appendChild(sa);state.audio.studyAudio=sa}
  setAudioStatus('Study AI • preparing');const ref=$('#audioRef');if(ref)ref.textContent='Study AI';

  // Start every TTS request together. The first chunk can play as soon as it is ready,
  // while the remaining chunks finish generating in the background.
  const speech=parts.map(part=>getSpeechBlob(part,'normal').then(blob=>({blob,part})).catch(error=>({error,part})));

  for(let i=0;i<parts.length;i++){
    let item=await speech[i],played=false;
    if(item.error){
      try{item={blob:await getSpeechBlob(parts[i],'normal'),part:parts[i]}}catch(error){item={error,part:parts[i]}}
    }
    if(item.blob){
      let url='';
      try{
        url=URL.createObjectURL(item.blob);sa.src=url;sa.load();claimVoiceChannel(sa);setStudyReadButton(state.audio.studyManualButton,'pause');setAudioStatus('Study AI • reading');
        await new Promise((resolve,reject)=>{
          let settled=false;const finish=(err)=>{if(settled)return;settled=true;clearTimeout(timer);sa.onended=null;sa.onerror=null;err?reject(err):resolve()};
          const timer=setTimeout(()=>finish(new Error('Study audio chunk timed out')),65000);
          sa.onended=()=>finish();sa.onerror=()=>finish(new Error('Study audio chunk failed'));claimVoiceChannel(sa);sa.play().catch(finish);
        });
        played=true;
      }catch(e){console.warn('Study narration chunk '+(i+1),e)}finally{if(url)try{URL.revokeObjectURL(url)}catch{}}
    }
    if(!played){claimVoiceChannel(null);played=await browserSpeakStudyPart(parts[i]);if(!played)console.warn('Study narration skipped one failed chunk')}
  }
  setStudyReadButton(state.audio.studyManualButton,'play');setAudioStatus('Study AI • finished');if(autoResume)resumeScriptureAfterStudy();
}`;
swap(oldNarrate,newNarrate,'prefetched continuous Study AI narration');

fs.writeFileSync(p('app.js'),app);
fs.appendFileSync(p('styles.css'),`\n/* Hobah Release 74 — physical Study AI controls */\n.studyMsg.assistant{display:grid!important;grid-template-columns:minmax(0,1fr) 56px!important;column-gap:20px!important;align-items:center!important;width:100%!important}.studyMsg.assistant>p{width:100%!important;max-width:none!important}.studyMsgActions{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:16px!important;width:56px!important;margin:0!important;padding:0!important}.studyMsgActions .studyPhysicalBtn{width:52px!important;height:52px!important;min-width:52px!important;min-height:52px!important;padding:0!important;border-radius:17px!important;border:1px solid rgba(255,255,255,.38)!important;background:linear-gradient(180deg,#176554 0%,#0d4c3f 72%,#0a4338 100%)!important;color:#f3efe5!important;box-shadow:0 5px 0 #07382f,0 9px 18px rgba(8,53,44,.2),inset 0 1px 0 rgba(255,255,255,.26)!important;transform:translateY(0);transition:transform .1s ease,box-shadow .1s ease,background .15s ease!important}.studyMsgActions .studyPhysicalBtn span{font-size:19px!important;line-height:1!important;font-weight:900!important}.studyMsgActions .studyPhysicalBtn:hover{background:linear-gradient(180deg,#1b6d5b,#0f5648)!important}.studyMsgActions .studyPhysicalBtn:active{transform:translateY(3px)!important;box-shadow:0 2px 0 #07382f,0 5px 10px rgba(8,53,44,.18),inset 0 1px 0 rgba(255,255,255,.22)!important}.studyMsgActions .studyPlayBtn[data-state=\"pause\"]{background:linear-gradient(180deg,#1b6d5b,#0b493d)!important}.studyMsgActions .studySaveBtn.saved span{font-size:21px!important}.studyMsgActions .studySaveBtn.saved{background:linear-gradient(180deg,#1a6958,#0b493d)!important}@media(max-width:560px){.studyMsg.assistant{grid-template-columns:minmax(0,1fr) 48px!important;column-gap:12px!important}.studyMsgActions{width:48px!important;gap:13px!important}.studyMsgActions .studyPhysicalBtn{width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important;border-radius:15px!important}.studyMsgActions .studyPhysicalBtn span{font-size:17px!important}}\n`);

let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=73','/styles.css?v=74').replace('/app.js?v=73','/app.js?v=74').replace('/manifest.webmanifest?v=73','/manifest.webmanifest?v=74');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=74#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 74: prefetched continuous Study AI audio and physical play/save controls applied');
