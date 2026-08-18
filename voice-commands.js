(()=>{
  const $=s=>document.querySelector(s),Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null,listening=false,manualStop=false,restartTimer=null,processing=false;
  const clean=s=>String(s||'').toLowerCase().replace(/[.,!?;:]/g,' ').replace(/\s+/g,' ').trim();
  const narrator=()=>window.MEB_NARRATOR;

  function setState(text){document.querySelectorAll('[data-voice-state]').forEach(e=>e.textContent=text)}
  function sync(){document.body.classList.toggle('voiceHandsFree',listening);document.querySelectorAll('[data-voice-toggle]').forEach(e=>e.checked=listening);document.querySelectorAll('.voiceCommandControl').forEach(e=>e.classList.toggle('active',listening))}
  function ensureControl(){
    const tools=$('.readerTools');if(!tools||tools.querySelector('.voiceCommandControl'))return;
    const wrap=document.createElement('div');wrap.className='voiceCommandControl';wrap.innerHTML=`<div class="voiceCommandCopy"><span class="voiceCommandDot" aria-hidden="true"></span><div><b>Hands-free Read Aloud</b><small data-voice-state>${Recognition?'Off':'Voice commands are not supported in this browser'}</small></div></div><label class="voiceCommandSwitch" aria-label="Turn hands-free listening on or off"><input data-voice-toggle type="checkbox" ${Recognition?'':'disabled'}><span class="voiceCommandTrack"></span></label><p class="voiceCommandHelp"><b>Say:</b> “Read this chapter” · “Stop” · “Explain that in more detail” · “Continue reading” · “Repeat that”</p>`;tools.appendChild(wrap);
    const toggle=wrap.querySelector('[data-voice-toggle]');toggle.checked=listening;toggle.onchange=()=>toggle.checked?startListening():stopListening();sync()
  }

  function makeRecognition(){
    if(recognition||!Recognition)return recognition;
    recognition=new Recognition();recognition.lang=navigator.language||'en-AU';recognition.continuous=true;recognition.interimResults=false;recognition.maxAlternatives=3;
    recognition.onstart=()=>{if(listening){setState('Listening for voice commands…');sync()}};
    recognition.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const result=e.results[i];if(!result.isFinal)continue;for(let j=0;j<result.length;j++){if(handleTranscript(result[j].transcript))return}}};
    recognition.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){listening=false;manualStop=true;setState('Microphone permission is off');sync();return}if(e.error!=='aborted'&&listening)setState('Listening paused — reconnecting…')};
    recognition.onend=()=>{recognition=null;if(!listening||manualStop)return;clearTimeout(restartTimer);restartTimer=setTimeout(()=>{if(listening)beginRecognition()},350)};
    return recognition
  }
  function beginRecognition(){try{makeRecognition()?.start()}catch{recognition=null;clearTimeout(restartTimer);restartTimer=setTimeout(()=>{if(listening)beginRecognition()},500)}}
  function startListening(){if(!Recognition){setState('Voice commands are not supported in this browser');return}listening=true;manualStop=false;sync();setState('Starting microphone…');beginRecognition()}
  function stopListening(){listening=false;manualStop=true;clearTimeout(restartTimer);try{recognition?.stop()}catch{}recognition=null;setState('Off');sync()}
  function feedback(command){setState(`Heard: “${command}”`);setTimeout(()=>{if(listening&&!processing)setState('Listening for voice commands…')},1800)}

  function normalizeCommand(raw){return clean(raw).replace(/^(hey )?(siri|bible|reader)\s+/,'').replace(/^please\s+/,'').trim()}
  function handleTranscript(raw){
    const c=normalizeCommand(raw),n=narrator();if(!c||!n)return false;
    if(/^(stop listening|turn listening off|microphone off)$/.test(c)){feedback('stop listening');stopListening();return true}
    if(/^(stop|pause|hold on|wait)$/.test(c)){n.pause();feedback('stop');return true}
    if(/^(continue|resume|keep reading|continue reading|carry on)$/.test(c)){n.resume();feedback('continue reading');return true}
    if(/^(repeat|repeat that|read that again|say that again)$/.test(c)){n.repeat();feedback('repeat that');return true}
    if(/^(read this verse|read the verse|start this verse)$/.test(c)){n.startVerse();feedback('read this verse');return true}
    if(/^(read|read aloud|start|start reading|read this|read this chapter|start this chapter)$/.test(c)){n.startChapter();feedback('read this chapter');return true}
    if(/^(end reading|close read aloud|stop reading completely)$/.test(c)){n.stop();feedback('end reading');return true}
    if(/^(next|next part|skip|skip ahead)$/.test(c)){n.next();feedback('next part');return true}
    if(/^(previous|previous part|go back|back one)$/.test(c)){n.previous();feedback('previous part');return true}
    if(/^(faster|read faster|speed up)$/.test(c)){n.setRateBy(1);feedback('faster');return true}
    if(/^(slower|read slower|slow down)$/.test(c)){n.setRateBy(-1);feedback('slower');return true}
    if(/^(normal mode|normal reading)$/.test(c)){n.setReadMode('normal');feedback('normal mode');return true}
    if(/^(context mode|context added|add context)$/.test(c)){n.setReadMode('context');feedback('context mode');return true}
    if(/^(advanced mode|advanced reading)$/.test(c)){n.setReadMode('advanced');feedback('advanced mode');return true}
    if(/^(ambient on|ambient music on|turn on ambient|turn on ambient music)$/.test(c)){window.MEB_AMBIENT?.set(true);feedback('ambient music on');return true}
    if(/^(ambient off|ambient music off|turn off ambient|turn off ambient music)$/.test(c)){window.MEB_AMBIENT?.set(false);feedback('ambient music off');return true}
    if(/^(explain that|explain that more|explain that in more detail|what does that mean|tell me more|tell me more about that)$/.test(c)){feedback('explain that in more detail');explainCurrent();return true}
    return false
  }

  function currentContext(segment){
    const a=window.MEB_STUDY_DATA?.[segment?.slug]||{},sec=(a.sections||[]).find(s=>segment.chapter>=s.start&&segment.chapter<=s.end),notes=[];
    for(const [key,text] of Object.entries(window.MEB_CURATED_NOTES||{})){const [slug,chapter,verse]=key.split(':');if(slug===segment?.slug&&+chapter===segment.chapter)notes.push({reference:`${segment.reference}:${verse}`,type:'verse',text});if(notes.length===4)break}
    return {currentReference:segment?.reference||'Passage just read',scripture:segment?.text||'',bookBackground:[a.period,a.genre,a.overview,a.scholarship].filter(Boolean).join(' '),sectionContext:sec?`${sec.title}: ${sec.note}`:'',studyNotes:notes}
  }
  async function readAnswer(r){
    const type=r.headers.get('content-type')||'';if(!type.includes('text/event-stream')){const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Study AI is unavailable');return d.answer||''}
    if(!r.ok)throw new Error('Study AI is unavailable');const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',answer='';
    while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop()||'';for(const block of blocks)for(const line of block.split(/\r?\n/)){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')continue;let event;try{event=JSON.parse(raw)}catch{continue}if(event.type==='response.output_text.delta'&&event.delta)answer+=event.delta;else if(event.type==='error')throw new Error(event.message||'Study AI is unavailable')}if(done)break}
    return answer.trim()
  }
  async function explainCurrent(){
    if(processing)return;const n=narrator(),segment=n?.getCurrentSegment?.();if(!segment?.text){setState('Start reading first, then ask me to explain');return}
    processing=true;n.pause();n.show();n.setStatus('Study AI is explaining the part you stopped on…');setState('Explaining the part you stopped on…');
    try{
      const question=`Explain this exact part that was just read in more detail: “${segment.text}” Begin with the plain meaning, then give the immediate context and the most important historical, literary, or theological detail. Keep it clear enough to understand by listening.`;
      const r=await fetch('/api/study-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,mode:'study',context:currentContext(segment),history:[]})}),answer=await readAnswer(r);
      if(!answer)throw new Error('No explanation returned');const spoken=answer.replace(/\[([^\]]+)\]\([^\)]+\)/g,'$1').replace(/[*_`#>]/g,'').replace(/\s+/g,' ').trim();setState('Reading the explanation…');await n.speakExplanation(spoken,'Explanation')
    }catch(e){console.warn('Voice explanation unavailable',e);n.setStatus('Explanation unavailable — say “continue reading”');setState('I could not explain that right now')}
    finally{processing=false;if(listening)setTimeout(()=>setState('Listening for voice commands…'),1800)}
  }

  function init(){document.body.classList.toggle('voiceCommandsAvailable',!!Recognition);ensureControl();new MutationObserver(ensureControl).observe($('#app')||document.body,{subtree:true,childList:true});addEventListener('hashchange',()=>setTimeout(ensureControl,50))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
