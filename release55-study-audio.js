(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let studyAudio=null,studyAbort=false,studyFlow=null,answerObserver=null,answerTimer=null;
  const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
  const setState=t=>{const e=$('#audioState');if(e)e.textContent=t};
  const setRef=t=>{const e=$('#audioRef');if(e)e.textContent=t};
  const setPlay=t=>{const e=$('#audioPlay');if(e)e.textContent=t};

  function scriptureAudio(){
    const tagged=$('audio[data-meb-scripture-audio="1"]');if(tagged)return tagged;
    const candidates=$$('audio').filter(a=>!a.classList.contains('studyAiNarration')&&a.src);
    const a=candidates[0]||null;if(a)a.dataset.mebScriptureAudio='1';return a;
  }

  function organisePlayer(){
    const bar=$('#audioBar'),title=$('.audioTitle'),controls=$('.audioControls'),modes=$('#audioModes');
    if(!bar||!title||!controls||!modes)return false;
    bar.classList.add('audioBarClean');
    if(!$('#audioPanelLabel')){const label=document.createElement('div');label.id='audioPanelLabel';label.className='audioPanelLabel';label.innerHTML='<span>READ ALOUD</span><small>Continuous scripture · natural voice</small>';bar.insertBefore(label,title)}
    const close=$('#audioClose');if(close&&close.parentElement!==title){close.classList.add('audioTopClose');title.appendChild(close)}
    if(!$('#audioTransport')){const transport=document.createElement('div');transport.id='audioTransport';transport.className='audioTransport';[$('#audioPrev'),$('#audioPlay'),$('#audioNext')].filter(Boolean).forEach(x=>transport.appendChild(x));controls.insertBefore(transport,controls.firstChild)}
    if(!$('#audioUtilities')){const util=document.createElement('div');util.id='audioUtilities';util.className='audioUtilities';[$('#voiceSelect'),$('#rateSelect'),$('#audioContinuous'),$('#audioSleep')].filter(Boolean).forEach(x=>util.appendChild(x));controls.appendChild(util)}
    if(!$('#audioSettingsLabel')){const label=document.createElement('div');label.id='audioSettingsLabel';label.className='audioSettingsLabel';label.textContent='LISTENING SETTINGS';const first=modes.querySelector('.audioAmbientSetting,.audioVoiceSetting');if(first)modes.insertBefore(label,first);else modes.appendChild(label)}
    return true;
  }

  function waitForPlayer(){
    const tag=()=>{const a=$$('audio').find(x=>!x.classList.contains('studyAiNarration')&&x.src);if(a)a.dataset.mebScriptureAudio='1'};
    tag();if(organisePlayer())return;const root=$('#audioBar')||document.body;
    const obs=new MutationObserver(()=>{tag();if(organisePlayer())obs.disconnect()});obs.observe(root,{childList:true,subtree:true});setTimeout(()=>obs.disconnect(),15000)
  }

  function splitForSpeech(text){const out=[],sent=clean(text).split(/(?<=[.!?])\s+/);let cur='';for(const s of sent){if((cur+' '+s).length>760&&cur){out.push(cur.trim());cur=s}else cur+=(cur?' ':'')+s}if(cur)out.push(cur.trim());return out}
  async function makeSpeech(text){const r=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin',mode:localStorage.getItem('meb:audioMode')||'normal'})});if(!r.ok)throw new Error('Study narration unavailable');return r.blob()}

  function clearAnswerWatch(){if(answerObserver){answerObserver.disconnect();answerObserver=null}if(answerTimer){clearTimeout(answerTimer);answerTimer=null}}
  function stopStudyNarration(resume=false){studyAbort=true;clearAnswerWatch();if(studyAudio){try{studyAudio.pause();if(studyAudio.src.startsWith('blob:'))URL.revokeObjectURL(studyAudio.src)}catch{}studyAudio.remove();studyAudio=null}window.MEB_STUDY_AUDIO_ACTIVE=false;if(resume)resumeScripture()}

  async function narrateStudyAnswer(text){
    const parts=splitForSpeech(text);if(!parts.length){resumeScripture();return}
    studyAbort=false;window.MEB_STUDY_AUDIO_ACTIVE=true;
    const flow=studyFlow,oldRef=flow?.ref||$('#audioRef')?.textContent||'Read aloud';setRef('Study AI explanation');setState('Study AI • preparing voice…');setPlay('…');
    const speechPromises=parts.map(part=>makeSpeech(part));
    for(let i=0;i<parts.length;i++){
      if(studyAbort)return;setState(`Study AI • ${i+1}/${parts.length}`);
      try{
        const blob=await speechPromises[i];if(studyAbort)return;
        const a=document.createElement('audio');studyAudio=a;a.className='studyAiNarration';a.preload='auto';a.setAttribute('playsinline','');a.style.display='none';document.body.appendChild(a);
        a.src=URL.createObjectURL(blob);a.load();
        setPlay('❚❚');
        await new Promise((resolve,reject)=>{a.onended=resolve;a.onerror=()=>reject(new Error('Study narration playback error'));a.play().catch(reject)});
        try{URL.revokeObjectURL(a.src)}catch{}a.remove();studyAudio=null;
      }catch(e){console.warn(e);setState('Could not read Study AI answer');break}
    }
    window.MEB_STUDY_AUDIO_ACTIVE=false;setRef(oldRef);if(!studyAbort)resumeScripture();
  }

  function resumeScripture(){
    clearAnswerWatch();const flow=studyFlow;studyFlow=null;if(!flow?.audio)return;
    $('#studyAiDialog')?.open&&$('#studyAiDialog').close();
    try{if(Number.isFinite(flow.time)&&Math.abs(flow.audio.currentTime-flow.time)>.15)flow.audio.currentTime=flow.time}catch{}
    setRef(flow.ref||'Read aloud');setState('Returning to scripture…');setPlay('❚❚');
    flow.audio.play().then(()=>setState(flow.state||'Reading…')).catch(()=>$('#audioPlay')?.click())
  }

  function beginStudyFlow(){
    const a=scriptureAudio();if(!a?.src)return false;
    const assistants=$$('#studyAiMessages .studyAiMsg.assistant p').length;
    studyFlow={audio:a,time:a.currentTime||0,ref:$('#audioRef')?.textContent||'',state:$('#audioState')?.textContent||'',assistantCount:assistants,startedAt:Date.now()};
    if(!a.paused)a.pause();setState('Study AI • preparing explanation…');setPlay('…');return true
  }

  function latestNewAssistant(){
    if(!studyFlow)return'';const msgs=$$('#studyAiMessages .studyAiMsg.assistant p');if(msgs.length<=studyFlow.assistantCount)return'';
    return clean(msgs[msgs.length-1]?.innerText||msgs[msgs.length-1]?.textContent||'')
  }

  function waitForAnswer(){
    clearAnswerWatch();const started=Date.now();
    const check=()=>{
      if(!studyFlow){clearAnswerWatch();return}
      const btn=$('#studyAiForm button'),answer=latestNewAssistant();
      const done=!!answer&&answer!=='Starting answer…'&&!!btn&&!btn.disabled&&btn.textContent.trim()==='Ask';
      if(done){clearAnswerWatch();narrateStudyAnswer(answer);return}
      if(Date.now()-started>120000){clearAnswerWatch();setState('Study AI took too long');resumeScripture()}
    };
    const root=$('#studyAiDialog')||document.body;answerObserver=new MutationObserver(check);answerObserver.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled']});
    answerTimer=setTimeout(check,0);setTimeout(check,80)
  }

  document.addEventListener('submit',e=>{
    if(e.target?.id!=='studyAiForm')return;
    const voiceExplain=$('#audioVoiceStatus')?.textContent?.includes('Explaining')||false;
    const a=scriptureAudio();if(!a?.src||(!window.MEB_NATURAL_AUDIO_ACTIVE&&!voiceExplain))return;
    if(beginStudyFlow())queueMicrotask(waitForAnswer)
  },true);

  document.addEventListener('click',e=>{if(e.target?.id==='audioClose'&&window.MEB_STUDY_AUDIO_ACTIVE){stopStudyNarration(false);studyFlow=null}},true);

  window.MEB_STUDY_AUDIO_CONTROL={
    pause(){if(studyAudio&&!studyAudio.paused){studyAudio.pause();setState('Study AI paused');setPlay('▶');return true}return false},
    play(){if(studyAudio?.paused){studyAudio.play();setState('Study AI explanation');setPlay('❚❚');return true}return false},
    stop(){if(window.MEB_STUDY_AUDIO_ACTIVE){stopStudyNarration(false);studyFlow=null;setState('Ready');setPlay('▶');return true}return false},
    resumeScripture(){if(studyFlow){stopStudyNarration(true);return true}return false}
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForPlayer);else waitForPlayer();
})();
