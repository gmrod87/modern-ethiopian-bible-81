// Hobah Release 64 — immediate Study AI narration using the already-unlocked Scripture audio element.
(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let flow=null,answerObserver=null,answerTimeout=null,aborted=false;
  const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
  const setState=t=>{const e=$('#audioState');if(e)e.textContent=t};
  const setRef=t=>{const e=$('#audioRef');if(e)e.textContent=t};
  const setPlay=t=>{const e=$('#audioPlay');if(e)e.textContent=t};

  function scriptureAudio(){
    const tagged=$('audio[data-meb-scripture-audio="1"]');if(tagged)return tagged;
    const a=$$('audio').find(x=>!x.classList.contains('studyAiNarration')&&x.src)||null;
    if(a)a.dataset.mebScriptureAudio='1';return a;
  }

  function organisePlayer(){
    const bar=$('#audioBar'),title=$('.audioTitle'),controls=$('.audioControls'),modes=$('#audioModes');
    if(!bar||!title||!controls||!modes)return false;
    bar.classList.add('audioBarClean');
    if(!$('#audioPanelLabel')){const label=document.createElement('div');label.id='audioPanelLabel';label.className='audioPanelLabel';label.innerHTML='<span>READ ALOUD</span><small>Continuous scripture · natural voice</small>';bar.insertBefore(label,title)}
    const close=$('#audioClose');if(close&&close.parentElement!==title){close.classList.add('audioTopClose');title.appendChild(close)}
    if(!$('#audioTransport')){const t=document.createElement('div');t.id='audioTransport';t.className='audioTransport';[$('#audioPrev'),$('#audioPlay'),$('#audioNext')].filter(Boolean).forEach(x=>t.appendChild(x));controls.insertBefore(t,controls.firstChild)}
    if(!$('#audioUtilities')){const u=document.createElement('div');u.id='audioUtilities';u.className='audioUtilities';[$('#voiceSelect'),$('#rateSelect'),$('#audioContinuous'),$('#audioSleep')].filter(Boolean).forEach(x=>u.appendChild(x));controls.appendChild(u)}
    if(!$('#audioSettingsLabel')){const l=document.createElement('div');l.id='audioSettingsLabel';l.className='audioSettingsLabel';l.textContent='LISTENING SETTINGS';const first=modes.querySelector('.audioAmbientSetting,.audioVoiceSetting');first?modes.insertBefore(l,first):modes.appendChild(l)}
    return true;
  }

  function waitForPlayer(){
    const tag=()=>{const a=$$('audio').find(x=>!x.classList.contains('studyAiNarration')&&x.src);if(a)a.dataset.mebScriptureAudio='1'};
    tag();if(organisePlayer())return;const root=$('#audioBar')||document.body;
    const o=new MutationObserver(()=>{tag();if(organisePlayer())o.disconnect()});o.observe(root,{childList:true,subtree:true});setTimeout(()=>o.disconnect(),15000)
  }

  function splitSpeech(text){
    const out=[],sent=clean(text).split(/(?<=[.!?])\s+/);let cur='';
    for(const s of sent){if((cur+' '+s).length>620&&cur){out.push(cur.trim());cur=s}else cur+=(cur?' ':'')+s}
    if(cur)out.push(cur.trim());return out
  }
  async function makeSpeech(text){
    const r=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin',mode:localStorage.getItem('meb:audioMode')||'normal'})});
    if(!r.ok)throw new Error('Study narration unavailable');return r.blob()
  }
  function clearWatch(){if(answerObserver){answerObserver.disconnect();answerObserver=null}if(answerTimeout){clearTimeout(answerTimeout);answerTimeout=null}}

  function saveHandlers(a){return {onended:a.onended,onplay:a.onplay,onpause:a.onpause,ontimeupdate:a.ontimeupdate,onerror:a.onerror}}
  function blankHandlers(a){a.onended=null;a.onplay=null;a.onpause=null;a.ontimeupdate=null;a.onerror=null}
  function restoreHandlers(a,h){a.onended=h.onended;a.onplay=h.onplay;a.onpause=h.onpause;a.ontimeupdate=h.ontimeupdate;a.onerror=h.onerror}

  function beginFlow(){
    const a=scriptureAudio();if(!a?.src)return false;
    if(flow)cancelFlow(false);
    const assistants=$$('#studyAiMessages .studyAiMsg.assistant p').length;
    flow={a,src:a.src,time:a.currentTime||0,rate:a.playbackRate||1,handlers:saveHandlers(a),ref:$('#audioRef')?.textContent||'Read aloud',state:$('#audioState')?.textContent||'Reading…',assistantCount:assistants,consumed:0,queue:[],pumping:false,complete:false,resumed:false};
    aborted=false;a.pause();window.MEB_STUDY_AUDIO_ACTIVE=true;setRef('Study AI explanation');setState('Study AI • answering…');setPlay('…');return true
  }

  function latestAnswer(){
    if(!flow)return'';const msgs=$$('#studyAiMessages .studyAiMsg.assistant p');if(msgs.length<=flow.assistantCount)return'';
    return clean(msgs[msgs.length-1]?.innerText||msgs[msgs.length-1]?.textContent||'')
  }

  function enqueue(text){
    for(const part of splitSpeech(text)){if(!part)return;flow.queue.push({text:part,promise:makeSpeech(part)})}
    pump()
  }

  function harvest(final=false){
    if(!flow)return;const answer=latestAnswer();if(!answer||answer==='Starting answer…')return;
    if(flow.consumed>answer.length)flow.consumed=0;
    const rest=answer.slice(flow.consumed).trimStart();if(!rest){if(final){flow.complete=true;finishIfReady()}return}
    let take='';
    if(final)take=rest;
    else{
      // Start speaking as soon as the first complete thought is available instead of waiting for the whole AI answer.
      const matches=[...rest.matchAll(/[.!?](?=\s|$)/g)];
      if(matches.length){const cut=matches[matches.length-1].index+1;if(cut>=55)take=rest.slice(0,cut)}
    }
    if(take){const pos=answer.indexOf(take,flow.consumed);flow.consumed=(pos>=0?pos:flow.consumed)+take.length;enqueue(take)}
    if(final){flow.complete=true;finishIfReady()}
  }

  async function playBlob(blob,label){
    if(!flow||aborted)return;const a=flow.a,url=URL.createObjectURL(blob);blankHandlers(a);a.pause();a.src=url;a.load();a.playbackRate=1;
    setState(label);setPlay('❚❚');
    try{await new Promise((resolve,reject)=>{a.onended=resolve;a.onerror=()=>reject(new Error('Study narration playback error'));const p=a.play();if(p?.catch)p.catch(reject)})}
    finally{try{URL.revokeObjectURL(url)}catch{}}
  }

  async function pump(){
    if(!flow||flow.pumping||aborted)return;flow.pumping=true;
    try{
      while(flow&&!aborted&&flow.queue.length){const item=flow.queue.shift();try{const blob=await item.promise;if(!flow||aborted)return;await playBlob(blob,'Study AI • reading explanation…')}catch(e){console.warn(e);setState('Could not read Study AI answer')}}
    }finally{if(flow)flow.pumping=false;finishIfReady()}
  }

  async function restoreScripture(){
    if(!flow||flow.resumed||aborted)return;flow.resumed=true;clearWatch();const f=flow,a=f.a;flow=null;window.MEB_STUDY_AUDIO_ACTIVE=false;
    blankHandlers(a);a.pause();a.src=f.src;a.load();a.playbackRate=f.rate;
    await new Promise(resolve=>{if(a.readyState>=1)return resolve();const done=()=>resolve();a.addEventListener('loadedmetadata',done,{once:true});setTimeout(done,700)});
    try{a.currentTime=f.time}catch{}
    restoreHandlers(a,f.handlers);setRef(f.ref);setState('Returning to scripture…');setPlay('❚❚');
    $('#studyAiDialog')?.open&&$('#studyAiDialog').close();
    try{await a.play();setState(f.state||'Reading…')}catch{setPlay('▶');setState('Tap play to continue scripture')}
  }

  function finishIfReady(){if(flow&&flow.complete&&!flow.pumping&&!flow.queue.length)restoreScripture()}
  function cancelFlow(resume=false){
    clearWatch();if(!flow)return;aborted=true;const f=flow,a=f.a;flow=null;window.MEB_STUDY_AUDIO_ACTIVE=false;blankHandlers(a);a.pause();
    if(resume){a.src=f.src;a.load();a.playbackRate=f.rate;try{a.currentTime=f.time}catch{}restoreHandlers(a,f.handlers);a.play().catch(()=>{});setRef(f.ref);setState(f.state)}
  }

  function watchAnswer(){
    clearWatch();const started=Date.now();
    const check=()=>{
      if(!flow)return;const btn=$('#studyAiForm button');harvest(false);
      const done=!!btn&&!btn.disabled&&btn.textContent.trim()==='Ask'&&!!latestAnswer()&&latestAnswer()!=='Starting answer…';
      if(done){harvest(true);clearWatch();return}
      if(Date.now()-started>120000){harvest(true);clearWatch();if(flow&&!flow.complete){flow.complete=true;finishIfReady()}}
    };
    const root=$('#studyAiDialog')||document.body;answerObserver=new MutationObserver(check);answerObserver.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled']});
    check();answerTimeout=setTimeout(()=>{harvest(true);if(flow){flow.complete=true;finishIfReady()}},120000)
  }

  document.addEventListener('submit',e=>{
    if(e.target?.id!=='studyAiForm')return;
    const voiceExplain=$('#audioVoiceStatus')?.textContent?.includes('Explaining')||false,a=scriptureAudio();
    if(!a?.src||(!window.MEB_NATURAL_AUDIO_ACTIVE&&!voiceExplain))return;
    if(beginFlow())queueMicrotask(watchAnswer)
  },true);
  document.addEventListener('click',e=>{if(e.target?.id==='audioClose'&&flow)cancelFlow(false)},true);

  window.MEB_STUDY_AUDIO_CONTROL={
    pause(){if(flow?.a&&!flow.a.paused){flow.a.pause();setState('Study AI paused');setPlay('▶');return true}return false},
    play(){if(flow?.a?.paused){flow.a.play().catch(()=>{});setState('Study AI explanation');setPlay('❚❚');return true}return false},
    stop(){if(flow){cancelFlow(false);setState('Ready');setPlay('▶');return true}return false},
    resumeScripture(){if(flow){cancelFlow(true);return true}return false}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForPlayer);else waitForPlayer();
})();
