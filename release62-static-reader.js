(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const page=window.HOBAH_PAGE||{};
  const verses=Array.isArray(page.verses)?page.verses:[];
  let audio=null,queue=[],qi=0,pausedAt=0,playing=false,voiceListening=false,rec=null,studyOpen=false,resumeAfterStudy=false;
  const mode=()=>localStorage.getItem('meb:audioMode')||'normal';
  const setStatus=t=>{const e=$('#audioStatus');if(e)e.textContent=t};
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const escapeHTML=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function chunks(text,limit=900){const out=[];let cur='';for(const s of clean(text).split(/(?<=[.!?])\s+/)){if(cur&&(`${cur} ${s}`).length>limit){out.push(cur);cur=s}else cur+=(cur?' ':'')+s}if(cur)out.push(cur);return out}
  function chapterText(){return verses.map(v=>`${v.v}. ${v.t}`).join(' ')}
  function contextText(){
    if(mode()==='normal')return'';
    const d=(window.MEB_STUDY_DATA||{})[page.slug]||{};
    const sec=(d.sections||[]).find(s=>page.chapter>=s.start&&page.chapter<=s.end);
    if(mode()==='advanced')return clean([`Advanced context for ${page.title} ${page.chapter}.`,d.period&&`Historical period: ${d.period}.`,d.genre&&`Genre: ${d.genre}.`,d.overview,d.scholarship,sec&&`${sec.title}. ${sec.note}`].filter(Boolean).join(' '));
    return clean([`Context for ${page.title} ${page.chapter}.`,d.overview,sec&&`${sec.title}. ${sec.note}`].filter(Boolean).join(' '));
  }
  async function tts(text){const r=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin',mode:mode()})});if(!r.ok)throw Error('Natural voice unavailable');return r.blob()}
  function stopAudio(reset=false){playing=false;if(audio){try{audio.pause();if(audio.src.startsWith('blob:'))URL.revokeObjectURL(audio.src)}catch{}if(reset){audio.remove();audio=null;qi=0;pausedAt=0}}setStatus(reset?'Ready':'Paused')}
  async function playChunk(){
    if(!playing||qi>=queue.length){playing=false;setStatus('Finished');return}
    const text=queue[qi];setStatus(`Natural voice • ${qi+1} of ${queue.length}`);
    try{const blob=await tts(text);if(!playing)return;const a=document.createElement('audio');audio=a;a.setAttribute('playsinline','');a.preload='auto';a.style.display='none';document.body.appendChild(a);a.src=URL.createObjectURL(blob);a.onended=()=>{try{URL.revokeObjectURL(a.src)}catch{}a.remove();audio=null;qi++;playChunk()};a.onerror=()=>{a.remove();audio=null;qi++;playChunk()};await a.play()}catch(e){console.warn(e);playing=false;setStatus('Natural voice unavailable')}
  }
  function startReading(){const intro=contextText();queue=chunks([intro,chapterText()].filter(Boolean).join(' '));qi=0;playing=true;setStatus('Preparing natural voice…');playChunk()}
  function resumeReading(){if(audio&&audio.paused){playing=true;audio.play().catch(()=>{});setStatus('Reading…');return}if(queue.length){playing=true;playChunk();return}startReading()}

  function syncMode(){const m=mode();$$('[data-audio-mode]').forEach(b=>b.classList.toggle('active',b.dataset.audioMode===m))}
  $$('[data-audio-mode]').forEach(b=>b.onclick=()=>{localStorage.setItem('meb:audioMode',b.dataset.audioMode);syncMode()});syncMode();
  $('#readPlay')?.addEventListener('click',()=>{if(playing)stopAudio(false);else resumeReading()});
  $('#readRestart')?.addEventListener('click',()=>{stopAudio(true);startReading()});

  function studyDialog(){return $('#studyAiDialog')}
  function openStudy(seed=''){
    const d=studyDialog();if(!d)return;if(seed)$('#studyAiInput').value=seed;if(!d.open)d.showModal();studyOpen=true;setTimeout(()=>$('#studyAiInput')?.focus(),40)
  }
  $('#studyAiBtn')?.addEventListener('click',()=>openStudy());$('#studyAiClose')?.addEventListener('click',()=>{studyDialog()?.close();studyOpen=false});
  async function askStudy(question){
    const box=$('#studyAiMessages'),btn=$('#studyAiAsk');if(!box||!question)return'';
    btn.disabled=true;box.insertAdjacentHTML('beforeend',`<div class="studyMsg user"><b>You</b><p>${escapeHTML(question)}</p></div><div class="studyMsg assistant pending"><b>Study AI</b><p>Thinking…</p></div>`);const p=box.querySelector('.assistant.pending:last-child p');
    const d=(window.MEB_STUDY_DATA||{})[page.slug]||{},sec=(d.sections||[]).find(s=>page.chapter>=s.start&&page.chapter<=s.end);
    try{
      const r=await fetch('/api/study-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,mode:'study',context:{currentReference:`${page.title} ${page.chapter}`,scripture:chapterText().slice(0,9000),bookBackground:[d.period,d.genre,d.overview,d.scholarship].filter(Boolean).join(' '),sectionContext:sec?`${sec.title}: ${sec.note}`:'',studyNotes:[]},history:[]})});
      if(!r.ok)throw Error('Study AI unavailable');
      const reader=r.body.getReader(),dec=new TextDecoder();let buf='',answer='';
      while(true){const {done,value}=await reader.read();buf+=dec.decode(value||new Uint8Array(),{stream:!done});const lines=buf.split(/\n/);buf=lines.pop()||'';for(const line of lines){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')continue;try{const j=JSON.parse(raw);if(typeof j.delta==='string')answer+=j.delta;else if(j.type==='response.output_text.delta'&&typeof j.delta==='string')answer+=j.delta}catch{}if(answer)p.textContent=answer}if(done)break}
      if(!answer)answer=p.textContent==='Thinking…'?'Study AI returned no text.':p.textContent;p.textContent=answer;p.closest('.assistant').classList.remove('pending');return answer
    }catch(e){p.textContent='Study AI is unavailable right now.';p.closest('.assistant').classList.remove('pending');return''}finally{btn.disabled=false}
  }
  $('#studyAiForm')?.addEventListener('submit',async e=>{e.preventDefault();const input=$('#studyAiInput'),q=input.value.trim();if(!q)return;input.value='';const answer=await askStudy(q);if(answer&&resumeAfterStudy){setStatus('Reading Study AI explanation…');const wasQueue=queue,wasQi=qi;const studyChunks=chunks(answer);for(const part of studyChunks){if(!resumeAfterStudy)break;try{const blob=await tts(part);await new Promise((resolve,reject)=>{const a=document.createElement('audio');a.className='studyAudio';a.style.display='none';document.body.appendChild(a);a.src=URL.createObjectURL(blob);a.onended=()=>{try{URL.revokeObjectURL(a.src)}catch{}a.remove();resolve()};a.onerror=reject;a.play().catch(reject)})}catch{break}}resumeAfterStudy=false;queue=wasQueue;qi=wasQi;studyDialog()?.close();resumeReading()}});

  function explainThat(){if(playing)stopAudio(false);resumeAfterStudy=true;openStudy(`Explain the part of ${page.title} ${page.chapter} I was just listening to in more detail. Explain the immediate context, important wording, historical background, and main theological or interpretive points. Keep it clear, then go deeper.`);$('#studyAiForm')?.requestSubmit()}

  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const vEnabled=()=>localStorage.getItem('meb:voiceCommands')==='1';
  function voiceStatus(t){const e=$('#voiceStatus');if(e)e.textContent=t}
  function syncVoice(){const b=$('#voiceToggle');if(!b)return;const on=vEnabled();b.classList.toggle('active',on);b.setAttribute('aria-checked',on?'true':'false');voiceStatus(on?'Listening…':(SR?'Off':'Not supported'))}
  function parseCmd(t){t=clean(t).toLowerCase();if(/explain (that|this)|what does that mean/.test(t))return'explain';if(/^(please )?(stop|pause|stop reading|hold on)$/.test(t))return'pause';if(/^(please )?(play|resume|continue|continue reading)$/.test(t))return'play';return''}
  function startVoice(){if(!SR||!vEnabled())return;if(rec)return;rec=new SR();rec.lang='en-AU';rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=3;rec.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){for(let a=0;a<e.results[i].length;a++){const c=parseCmd(e.results[i][a].transcript||'');if(c){if(c==='pause')stopAudio(false);if(c==='play')resumeReading();if(c==='explain')explainThat();break}}}};rec.onend=()=>{rec=null;if(vEnabled())setTimeout(startVoice,80)};rec.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){localStorage.setItem('meb:voiceCommands','0');syncVoice()}};try{rec.start()}catch{} }
  $('#voiceToggle')?.addEventListener('click',()=>{const on=!vEnabled();localStorage.setItem('meb:voiceCommands',on?'1':'0');if(!on){try{rec?.abort()}catch{}rec=null}else startVoice();syncVoice()});syncVoice();if(vEnabled())startVoice();
})();