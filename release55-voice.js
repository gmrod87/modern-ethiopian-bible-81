// Hobah Release 55 — low-latency hands-free voice commands.
(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null,listening=false,restarting=false,lastCommand='',lastCommandAt=0,restartTimer=null;
  const enabled=()=>localStorage.getItem('meb:voiceCommands')==='1';
  const clean=s=>String(s||'').toLowerCase().replace(/[.,!?;:]/g,' ').replace(/\s+/g,' ').trim();
  const setStatus=t=>{const e=$('#audioVoiceStatus');if(e)e.textContent=t};
  const scriptureAudio=()=>$('audio[data-meb-scripture-audio="1"]')||$$('audio').find(a=>!a.classList.contains('studyAiNarration')&&a.src)||null;

  function addStyles(){
    if($('#voiceCommandStyles'))return;const st=document.createElement('style');st.id='voiceCommandStyles';st.textContent=`
      .audioVoiceSetting{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;padding-top:11px;border-top:1px solid var(--line)}
      .audioVoiceCopy{min-width:0;display:flex;flex-direction:column;gap:3px}.audioVoiceCopy>span{font-size:10px;font-weight:900;letter-spacing:.14em;opacity:.72}.audioVoiceCopy>small{font-size:10px;line-height:1.35;opacity:.58}.audioVoiceCopy em{font-size:9px;line-height:1.35;opacity:.72;font-style:normal;margin-top:2px}
      .voiceToggle{position:relative;flex:0 0 48px;width:48px;height:28px;border:0!important;border-radius:999px!important;padding:0!important;background:rgba(120,110,100,.28)!important;box-shadow:none!important}.voiceToggle:after{content:'';position:absolute;width:22px;height:22px;left:3px;top:3px;border-radius:50%;background:var(--paper);box-shadow:0 1px 5px rgba(0,0,0,.2);transition:transform .18s ease}.voiceToggle.active{background:#751d1d!important}.voiceToggle.active:after{transform:translateX(20px)}
      @media(max-width:520px){.audioVoiceSetting{align-items:flex-start}.audioVoiceCopy small{max-width:210px}}
    `;document.head.appendChild(st)
  }

  function ensureControl(){
    addStyles();const modes=$('#audioModes');if(!modes)return false;
    let row=$('#audioVoiceSetting');if(!row){row=document.createElement('div');row.id='audioVoiceSetting';row.className='audioVoiceSetting';row.innerHTML='<div class="audioVoiceCopy"><span>VOICE COMMANDS</span><small>Say “stop”, “play”, or “explain that”. “Stop” holds your place so Study AI can explain and resume.</small><em id="audioVoiceStatus">Off</em></div><button id="audioVoiceToggle" class="voiceToggle" type="button" role="switch" aria-label="Voice command listening" aria-checked="false"></button>';modes.appendChild(row)}
    const b=$('#audioVoiceToggle');if(b&&!b.dataset.r55){b.dataset.r55='1';b.onclick=toggleListening}syncControl();return true
  }

  function syncControl(){const b=$('#audioVoiceToggle');if(!b)return;const on=enabled();b.classList.toggle('active',on);b.setAttribute('aria-checked',on?'true':'false');if(!on)setStatus(SR?'Off':'Voice recognition is not supported in this browser')}

  function commandFrom(text){
    const t=clean(text),saidWake=/\bhey\s+(siri|series|serious)\b/.test(t),body=t.replace(/.*\bhey\s+(siri|series|serious)\b/,'').trim(),c=saidWake?body:t;
    if(/\b(explain (that|this)|explain that in more detail|what does that mean|explain it)\b/.test(c))return'explain';
    if(/^(please )?(stop|stop reading|stop read aloud|hold|hold on)$/.test(c)||saidWake&&/\b(stop|hold)\b/.test(c))return'pause';
    if(/^(please )?(pause|pause reading)$/.test(c)||saidWake&&/\bpause\b/.test(c))return'pause';
    if(/^(please )?(play|resume|continue|continue reading)$/.test(c)||saidWake&&/\b(play|resume|continue)\b/.test(c))return'play';
    return''
  }

  function pauseReading(){
    if(window.MEB_STUDY_AUDIO_ACTIVE&&window.MEB_STUDY_AUDIO_CONTROL?.pause?.()){setStatus('Study AI paused');return true}
    const a=scriptureAudio();if(a?.src&&!a.paused){a.pause();setStatus('Paused • say “play” or “explain that”');return true}
    setStatus('Paused • say “play” or “explain that”');return !!a
  }

  function playReading(){
    if(window.MEB_STUDY_AUDIO_ACTIVE&&window.MEB_STUDY_AUDIO_CONTROL?.play?.()){setStatus('Study AI playing');return}
    const a=scriptureAudio();if(a?.src&&a.paused){a.play().catch(()=>$('#audioPlay')?.click());setStatus('Playing');return}
    $('#audioPlay')?.click();setStatus('Playing')
  }

  function splitLikeNarrator(text){const parts=[],sent=String(text||'').replace(/\s+/g,' ').trim().split(/(?<=[.!?])\s+/);let cur='',limit=420;for(const s of sent){if((cur+' '+s).length>limit&&cur){parts.push(cur.trim());cur=s;limit=900}else cur+=(cur?' ':'')+s}if(cur)parts.push(cur.trim());return parts}
  function recentNarration(){
    const ref=$('#audioRef')?.textContent?.trim()||'this passage',chapter=$$('#chapterText .verse').map(v=>{const q=v.cloneNode(true);q.querySelectorAll('button').forEach(b=>b.remove());return q.textContent.replace(/\s+/g,' ').trim()}).join(' ');
    if(!chapter)return {ref,text:''};const state=$('#audioState')?.textContent||'',m=state.match(/(\d+)\s*\/\s*(\d+)/),parts=splitLikeNarrator(`${ref}. ${chapter}`),i=m?Math.max(0,Math.min(parts.length-1,+m[1]-1)):0;return {ref,text:(parts[i]||chapter.slice(0,1100)).slice(0,1600)}
  }

  function submitExplanation(q){
    const input=$('#studyAiInput'),form=$('#studyAiForm');if(!input||!form)return false;
    input.value=q;setStatus('Explaining that…');form.requestSubmit();return true
  }

  function explainThat(){
    pauseReading();const recent=recentNarration();
    const q=`Explain the part I was just listening to in more detail. The Read Aloud reference is ${recent.ref}.${recent.text?` The recent narration was: “${recent.text}”`:''} Explain what it means in its immediate context, any important wording, historical background, and the main theological or interpretive points. Keep the explanation clear first, then add deeper detail.`;
    setStatus('Explaining that…');window.THE81_FEATURES?.core?.();
    const started=performance.now();
    const tryOpen=()=>{
      const dlg=$('#studyAiDialog');if(dlg){if(!dlg.open)$('#studyAiFloat')?.click();if(submitExplanation(q))return}
      if(performance.now()-started>5000){setStatus('Study AI is not ready');return}
      setTimeout(tryOpen,25)
    };
    tryOpen()
  }

  function handleTranscript(text,isFinal=false){
    const cmd=commandFrom(text);if(!cmd){if(isFinal&&text.trim())setStatus(`Heard: “${text.trim()}”`);return}
    const now=performance.now();if(cmd===lastCommand&&now-lastCommandAt<450)return;lastCommand=cmd;lastCommandAt=now;
    if(cmd==='pause')pauseReading();else if(cmd==='play')playReading();else if(cmd==='explain')explainThat()
  }

  function createRecognition(){
    if(!SR)return null;if(recognition)return recognition;const r=new SR();r.lang='en-AU';r.continuous=true;r.interimResults=true;r.maxAlternatives=3;
    r.onstart=()=>{listening=true;restarting=false;setStatus('Listening…')};
    r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const result=e.results[i];let handled=false;for(let a=0;a<Math.min(result.length,3);a++){const text=result[a]?.transcript||'';if(commandFrom(text)){handleTranscript(text,result.isFinal);handled=true;break}}if(!handled&&result.isFinal)handleTranscript(result[0]?.transcript||'',true)}};
    r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'||e.error==='audio-capture'){localStorage.setItem('meb:voiceCommands','0');listening=false;setStatus(e.error==='audio-capture'?'Microphone unavailable':'Microphone permission needed');syncControl()}else if(e.error!=='no-speech'&&e.error!=='aborted')setStatus('Listening interrupted')};
    r.onend=()=>{listening=false;if(restartTimer)clearTimeout(restartTimer);if(enabled()&&!restarting){restarting=true;restartTimer=setTimeout(()=>{restarting=false;startListening(false)},70)}};
    recognition=r;return r
  }

  function startListening(showMessage=true){if(!enabled()||!SR)return;const r=createRecognition();if(!r||listening)return;try{r.start();if(showMessage)setStatus('Listening…')}catch{if(showMessage)setStatus('Listening…')}}
  function stopListening(){restarting=true;if(restartTimer)clearTimeout(restartTimer);try{recognition?.abort()}catch{}listening=false;setStatus('Off');setTimeout(()=>{restarting=false},180)}
  function toggleListening(){if(!SR){setStatus('Voice recognition is not supported here');return}const on=!enabled();localStorage.setItem('meb:voiceCommands',on?'1':'0');syncControl();if(on)startListening();else stopListening()}

  function init(){
    ensureControl();const obs=new MutationObserver(()=>ensureControl());obs.observe($('#audioBar')||document.body,{childList:true,subtree:true});
    if(enabled()){syncControl();startListening(false)}
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&enabled()&&!listening)startListening(false)})
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
