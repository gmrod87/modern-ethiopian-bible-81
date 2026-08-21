async function voice90PauseCommand(){
  if(state.audio.studyBusy){
    if(VOICE90.phase==='speaking'){
      if(window.HobahNativeAudio)await window.HobahNativeAudio.pause({channel:'study'}).catch(()=>{});else try{state.audio.studyAudio?.pause()}catch{}
      VOICE90.phase='study-paused';setStudyPhase('paused');voice90Status('Study AI • paused');
    }
    return;
  }
  VOICE90.resumeAfterVoicePause=!!(state.audio.playing||VOICE90.resumeAfterVoicePause);
  pauseNarration();voice90Status('Paused • say “explain that” or “play”');
}
async function voice90PlayCommand(){
  if(state.audio.studyBusy&&VOICE90.phase==='study-paused'){
    if(window.HobahNativeAudio)await window.HobahNativeAudio.resume({channel:'study'}).catch(()=>{});else try{await state.audio.studyAudio?.play()}catch{}
    VOICE90.phase='speaking';setStudyPhase('speaking');voice90Status('Study AI • reading');return;
  }
  VOICE90.resumeAfterVoicePause=false;resumeNarration();
}
function completedText90(ev){
  const out=Array.isArray(ev?.response?.output)?ev.response.output:[],parts=[];
  for(const item of out)for(const c of (Array.isArray(item?.content)?item.content:[]))if(typeof c?.text==='string')parts.push(c.text);
  return clean(parts.join(' '));
}
requestVoiceExplanationJSON=async function(question,reference){
  const ctl=new AbortController();VOICE90.studyAbort=ctl;state.audio.studyRequestAbort=ctl;state.audio.studyCancelReason='';
  const studyURL=(window.HOBAH_API_BASE?window.HOBAH_API_BASE.replace(/\/$/,''):'')+'/api/study-chat';
  let answer='',doneText='',buffer='',reader=null,first=false,finished=false;
  const firstTimer=setTimeout(()=>{if(!first)ctl.abort()},12000),hardTimer=setTimeout(()=>ctl.abort(),32000);
  const consume=line=>{
    if(!line.startsWith('data:'))return false;const raw=line.slice(5).trim();if(!raw)return false;if(raw==='[DONE]')return true;
    let ev;try{ev=JSON.parse(raw)}catch{return false}
    if(ev.type==='response.output_text.delta'&&ev.delta){answer+=ev.delta;first=true;clearTimeout(firstTimer)}
    if(ev.type==='response.output_text.done'&&ev.text){doneText=ev.text;first=true;clearTimeout(firstTimer)}
    if(ev.type==='response.completed'){if(!doneText)doneText=completedText90(ev);return true}
    if(ev.type==='error')throw Error(ev.error?.message||'Study AI unavailable');return false;
  };
  try{
    const r=await fetch(studyURL,{method:'POST',headers:{'content-type':'application/json'},signal:ctl.signal,body:JSON.stringify({question,mode:'study',context:quickStudyContext(),history:[],quick:true})});
    if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Study AI unavailable')}
    reader=r.body?.getReader?.();if(!reader)throw Error('Study AI streaming unavailable');const decoder=new TextDecoder();
    while(!finished){const x=await reader.read();if(x.done)break;buffer+=decoder.decode(x.value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines){if(consume(line)){finished=true;break}}}
    if(!finished){buffer+=decoder.decode();for(const line of buffer.split('\n'))if(consume(line))break}
    const final=compactStudyAnswer(clean(doneText||answer),300);if(!final)throw Error('Study AI did not return an explanation');return final;
  }catch(e){if(e?.name==='AbortError')throw Error(state.audio.studyCancelReason==='user'?'Study explanation cancelled':first?'Study AI explanation timed out':'Study AI took too long to start');throw e}
  finally{clearTimeout(firstTimer);clearTimeout(hardTimer);try{reader?.cancel?.()}catch{}if(VOICE90.studyAbort===ctl)VOICE90.studyAbort=null;if(state.audio.studyRequestAbort===ctl)state.audio.studyRequestAbort=null}
};
function voice90WaitNativeStudyEnd(id,timeout=70000){
  return new Promise((resolve,reject)=>{
    let done=false;const finish=(ok,err)=>{if(done)return;done=true;clearTimeout(t);document.removeEventListener('hobah:native-audio-ended',onEnd);err?reject(err):resolve(ok)};
    const onEnd=e=>{if(e.detail?.channel!=='study')return;if(id&&e.detail?.id&&e.detail.id!==id)return;finish(true)};
    const t=setTimeout(()=>finish(false,new Error('Study narration timed out')),timeout);document.addEventListener('hobah:native-audio-ended',onEnd);
  });
}
async function voice90BrowserSpeak(text){
  if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance)return false;
  return await new Promise(resolve=>{try{const u=new SpeechSynthesisUtterance(text),male=selectedNarrator()==='male';u.rate=.94;u.pitch=male?.86:1;u.volume=1;const voices=window.speechSynthesis.getVoices?.()||[],re=male?/Daniel|Alex|Aaron|Arthur|Tom|Oliver|Lee/i:/Samantha|Karen|Serena|Moira|Ava|Victoria|Zoe/i;u.voice=voices.find(v=>re.test(v.name))||voices.find(v=>/^en[-_]/i.test(v.lang))||null;let settled=false;const finish=ok=>{if(settled)return;settled=true;clearTimeout(t);resolve(ok)},t=setTimeout(()=>{try{speechSynthesis.cancel()}catch{}finish(false)},70000);u.onend=()=>finish(true);u.onerror=()=>finish(false);speechSynthesis.cancel();speechSynthesis.speak(u)}catch{resolve(false)}});
}
narrateStudyAnswer=async function(text,autoResume=false){
  text=compactStudyAnswer(clean(text),300);const parts=splitForTTS(text,650);if(!parts.length)return;
  const ref=$('#audioRef');if(ref)ref.textContent='Study AI';setStudyPhase('speaking');VOICE90.phase='speaking';
  if(window.HobahNativeAudio){
    await Promise.resolve(window.HobahNativeAudioReady);
    const prepared=parts.map(part=>window.HobahNativeAudio.prepare({text:part,mode:'normal'}).catch(()=>{}));
    for(let i=0;i<parts.length;i++){
      const part=parts[i];await prepared[i];const id=window.HobahNativeAudio.keyFor(part,'normal');voice90Status('Study AI • reading '+(i+1)+' of '+parts.length);
      try{await window.HobahNativeAudio.play({channel:'study',text:part,mode:'normal',title:'Study AI',subtitle:'Explanation',rate:1,forcePlayback:true});await voice90WaitNativeStudyEnd(id)}
      catch(e){console.warn('Voice90 native Study narration',e);const ok=await voice90BrowserSpeak(part);if(!ok)throw e}
    }
    await window.HobahNativeAudio.stop({channel:'study'}).catch(()=>{});setStudyPhase('idle');VOICE90.phase='study';voice90Status('Study AI • finished');if(autoResume)await voice90ResumeScripture();return;
  }
  const sa=typeof ensureStudyNarrationAudio==='function'?ensureStudyNarrationAudio():(state.audio.studyAudio||(()=>{const a=document.createElement('audio');a.hidden=true;a.setAttribute('playsinline','');document.body.appendChild(a);state.audio.studyAudio=a;return a})());
  const speech=parts.map(part=>getSpeechBlob(part,'normal').then(blob=>({blob})).catch(error=>({error})));
  for(let i=0;i<parts.length;i++){
    let item=await speech[i],played=false;if(item.blob){let url='';try{url=URL.createObjectURL(item.blob);sa.src=url;sa.load();voice90Status('Study AI • reading '+(i+1)+' of '+parts.length);await new Promise((resolve,reject)=>{let settled=false;const finish=e=>{if(settled)return;settled=true;clearTimeout(t);sa.onended=null;sa.onerror=null;e?reject(e):resolve()},t=setTimeout(()=>finish(new Error('Study narration timed out')),70000);sa.onended=()=>finish();sa.onerror=()=>finish(new Error('Study narration failed'));const pp=sa.play();if(pp?.catch)pp.catch(finish)});played=true}catch(e){console.warn('Voice90 web Study narration',e)}finally{if(url)try{URL.revokeObjectURL(url)}catch{}}}
    if(!played){played=await voice90BrowserSpeak(parts[i]);if(!played)throw Error('Study AI could not start read aloud')}
  }
  setStudyPhase('idle');VOICE90.phase='study';voice90Status('Study AI • finished');if(autoResume)await voice90ResumeScripture();
};