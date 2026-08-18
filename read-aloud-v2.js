(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let studyAudio=null,studyAbort=false,studyFlow=null;
  const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
  const scriptureAudio=()=>$$('audio').find(a=>!a.classList.contains('studyAiNarration')&&a.src)||null;
  const setState=t=>{const e=$('#audioState');if(e)e.textContent=t};
  const setRef=t=>{const e=$('#audioRef');if(e)e.textContent=t};
  const setPlay=t=>{const e=$('#audioPlay');if(e)e.textContent=t};

  function organisePlayer(){
    const bar=$('#audioBar'),title=$('.audioTitle'),controls=$('.audioControls'),modes=$('#audioModes');
    if(!bar||!title||!controls||!modes)return false;
    bar.classList.add('audioBarClean');
    if(!$('#audioPanelLabel')){const label=document.createElement('div');label.id='audioPanelLabel';label.className='audioPanelLabel';label.innerHTML='<span>READ ALOUD</span><small>Continuous scripture · natural voice</small>';bar.insertBefore(label,title)}
    const close=$('#audioClose');if(close&&close.parentElement!==title){close.classList.add('audioTopClose');title.appendChild(close)}
    if(!$('#audioTransport')){const transport=document.createElement('div');transport.id='audioTransport';transport.className='audioTransport';const prev=$('#audioPrev'),play=$('#audioPlay'),next=$('#audioNext');if(prev)transport.appendChild(prev);if(play)transport.appendChild(play);if(next)transport.appendChild(next);controls.insertBefore(transport,controls.firstChild)}
    if(!$('#audioUtilities')){const util=document.createElement('div');util.id='audioUtilities';util.className='audioUtilities';const voice=$('#voiceSelect'),rate=$('#rateSelect'),cont=$('#audioContinuous'),sleep=$('#audioSleep');[voice,rate,cont,sleep].filter(Boolean).forEach(x=>util.appendChild(x));controls.appendChild(util)}
    if(!$('#audioSettingsLabel')){const label=document.createElement('div');label.id='audioSettingsLabel';label.className='audioSettingsLabel';label.textContent='LISTENING SETTINGS';const firstSetting=modes.querySelector('.audioAmbientSetting,.audioVoiceSetting');if(firstSetting)modes.insertBefore(label,firstSetting);else modes.appendChild(label)}
    return true;
  }

  function waitForPlayer(){if(organisePlayer())return;const root=$('#audioBar')||document.body;const obs=new MutationObserver(()=>{if(organisePlayer())obs.disconnect()});obs.observe(root,{childList:true,subtree:true});setTimeout(()=>obs.disconnect(),15000)}

  function splitForSpeech(text){const out=[],sent=clean(text).split(/(?<=[.!?])\s+/);let cur='';for(const s of sent){if((cur+' '+s).length>820&&cur){out.push(cur.trim());cur=s}else cur+=(cur?' ':'')+s}if(cur)out.push(cur.trim());return out}
  async function makeSpeech(text){const r=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin',mode:localStorage.getItem('meb:audioMode')||'normal'})});if(!r.ok)throw new Error('Study narration unavailable');return r.blob()}

  function stopStudyNarration(resume=false){studyAbort=true;if(studyAudio){try{studyAudio.pause();if(studyAudio.src.startsWith('blob:'))URL.revokeObjectURL(studyAudio.src)}catch{}studyAudio.remove();studyAudio=null}window.MEB_STUDY_AUDIO_ACTIVE=false;if(resume)resumeScripture()}

  async function narrateStudyAnswer(text){
    const parts=splitForSpeech(text);if(!parts.length){resumeScripture();return}
    studyAbort=false;window.MEB_STUDY_AUDIO_ACTIVE=true;const oldRef=$('#audioRef')?.textContent||'Read aloud';setRef('Study AI explanation');setPlay('❚❚');
    for(let i=0;i<parts.length;i++){
      if(studyAbort)return;setState(`Study AI • ${i+1}/${parts.length}`);
      try{
        const blob=await makeSpeech(parts[i]);if(studyAbort)return;
        const a=document.createElement('audio');studyAudio=a;a.className='studyAiNarration';a.preload='auto';a.setAttribute('playsinline','');a.style.display='none';
        const scripture=scriptureAudio();if(scripture?.parentElement)scripture.parentElement.insertBefore(a,scripture);else document.body.appendChild(a);
        a.src=URL.createObjectURL(blob);a.load();
        await new Promise((resolve,reject)=>{a.onended=resolve;a.onerror=()=>reject(new Error('Study narration playback error'));a.play().catch(reject)});
        try{URL.revokeObjectURL(a.src)}catch{}a.remove();studyAudio=null;
      }catch(e){console.warn(e);setState('Could not read Study AI answer');break}
    }
    window.MEB_STUDY_AUDIO_ACTIVE=false;setRef(oldRef);if(!studyAbort)resumeScripture();
  }

  function resumeScripture(){const flow=studyFlow;studyFlow=null;if(!flow?.audio)return;$('#studyAiDialog')?.open&&$('#studyAiDialog').close();setState('Returning to scripture…');flow.audio.play().catch(()=>$('#audioPlay')?.click())}
  function beginStudyFlow(){const a=scriptureAudio();if(!a||!window.MEB_NATURAL_AUDIO_ACTIVE)return;studyFlow={audio:a,ref:$('#audioRef')?.textContent||'',startedAt:Date.now()};if(!a.paused)a.pause();setState('Study AI • preparing explanation…')}
  function latestAssistantText(){const msgs=$$('#studyAiMessages .studyAiMsg.assistant p');return clean(msgs[msgs.length-1]?.innerText||msgs[msgs.length-1]?.textContent||'')}
  function waitForAnswer(){const started=Date.now();let last='';const timer=setInterval(()=>{if(!studyFlow){clearInterval(timer);return}const btn=$('#studyAiForm button'),answer=latestAssistantText();if(answer)last=answer;const done=btn&&btn.textContent.trim()==='Ask'&&last&&last!=='Starting answer…';if(done){clearInterval(timer);narrateStudyAnswer(last)}else if(Date.now()-started>120000){clearInterval(timer);setState('Study AI took too long');resumeScripture()}},250)}

  document.addEventListener('submit',e=>{if(e.target?.id!=='studyAiForm')return;const voiceExplain=$('#audioVoiceStatus')?.textContent?.includes('Explaining')||false;if(window.MEB_NATURAL_AUDIO_ACTIVE||voiceExplain){beginStudyFlow();setTimeout(waitForAnswer,80)}},true);
  document.addEventListener('click',e=>{if(e.target?.id==='audioClose'&&window.MEB_STUDY_AUDIO_ACTIVE){stopStudyNarration(false);studyFlow=null}},true);

  window.MEB_STUDY_AUDIO_CONTROL={pause(){if(studyAudio&&!studyAudio.paused){studyAudio.pause();setState('Study AI paused');setPlay('▶');return true}return false},play(){if(studyAudio?.paused){studyAudio.play();setState('Study AI explanation');setPlay('❚❚');return true}return false},stop(){if(window.MEB_STUDY_AUDIO_ACTIVE){stopStudyNarration(false);studyFlow=null;setState('Ready');setPlay('▶');return true}return false}};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForPlayer);else waitForPlayer();
})();
