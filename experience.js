(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let feelingMode=false;
  const moods=[
    {icon:'☀',title:'Grateful',line:'Slow down and notice what is good.',tone:'Warm · major',passages:[['Psalm 100','psalms',100],['Psalm 103','psalms',103],['Psalm 136','psalms',136]]},
    {icon:'◌',title:'Anxious or overwhelmed',line:'Quiet passages about safety, presence and trust.',tone:'Calm · major',passages:[['Psalm 23','psalms',23],['Psalm 46','psalms',46],['Matthew 6','matthew',6],['Philippians 4','philippians',4]]},
    {icon:'✦',title:'Curious / intrigued',line:'Enter the visionary, symbolic and apocalyptic side of Scripture.',tone:'Mysterious · minor',passages:[['Daniel 7','daniel',7],['1 Enoch 6','1-enoch',6],['1 Enoch 46','1-enoch',46],['Revelation 12','revelation',12]]},
    {icon:'♡',title:'Need love or comfort',line:'Read about being known, loved and held close.',tone:'Tender · major',passages:[['Psalm 139','psalms',139],['John 15','john',15],['1 Corinthians 13','1-corinthians',13],['1 John 4','1-john',4]]},
    {icon:'↟',title:'Need hope',line:'Passages that look beyond the present moment.',tone:'Hopeful · major',passages:[['Isaiah 40','isaiah',40],['Romans 8','romans',8],['Revelation 21','revelation',21]]},
    {icon:'☾',title:'Sad or grieving',line:'Scripture that makes room for sorrow without rushing it.',tone:'Reflective · minor',passages:[['Psalm 13','psalms',13],['Psalm 42','psalms',42],['Lamentations 3','lamentations',3],['John 11','john',11]]},
    {icon:'♢',title:'Need wisdom',line:'Practical and reflective writing for decisions and perspective.',tone:'Clear · major',passages:[['Proverbs 3','proverbs',3],['Ecclesiastes 3','ecclesiastes',3],['Sirach 2','sirach-ecclesiasticus',2],['Sirach 6','sirach-ecclesiasticus',6]]},
    {icon:'⚑',title:'Need courage',line:'For steadiness when something difficult is in front of you.',tone:'Steady · major',passages:[['Joshua 1','joshua',1],['Psalm 27','psalms',27],['2 Timothy 1','2-timothy',1]]},
    {icon:'↺',title:'Want to reset',line:'Repentance, return and starting again.',tone:'Penitent · minor → major',passages:[['Psalm 51','psalms',51],['Prayer of Manasseh','prayer-of-manasseh',1],['Luke 15','luke',15]]}
  ];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const route=(slug,c)=>`#read/${slug}/${c}`;

  function renderFeelings(){
    feelingMode=true;
    const box=$('#drawerBooks');if(!box)return;
    box.innerHTML=`<section class="feelingGuide"><div class="feelingIntro"><span>HOW ARE YOU ARRIVING?</span><h3>What are you feeling?</h3><p>Choose a feeling and go straight to a few passages that fit the moment. There is no wrong choice — this is simply a gentler way into the library.</p></div><div class="feelingGrid">${moods.map(m=>`<article class="feelingCard"><div class="feelingCardHead"><i>${m.icon}</i><div><h4>${esc(m.title)}</h4><small>${esc(m.tone)}</small></div></div><p>${esc(m.line)}</p><div class="feelingPassages">${m.passages.map(p=>`<a href="${route(p[1],p[2])}">${esc(p[0])}<span>→</span></a>`).join('')}</div></article>`).join('')}</div><p class="feelingFoot">These suggestions are devotional pathways, not claims that one passage has only one meaning or purpose.</p></section>`;
    box.querySelectorAll('.feelingPassages a').forEach(a=>a.addEventListener('click',()=>$('#closeDrawer')?.click()));
  }

  function bindFilterResets(){
    $$('#filters button:not(#feelingFilter)').forEach(b=>{if(b.dataset.feelingReset)return;b.dataset.feelingReset='1';b.addEventListener('click',()=>{feelingMode=false})});
  }
  function addFeelingTab(){
    const filters=$('#filters');if(!filters)return;
    if(!$('#feelingFilter')){
      const b=document.createElement('button');b.id='feelingFilter';b.type='button';b.textContent='What are you feeling?';filters.appendChild(b);
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();$$('#filters button').forEach(x=>x.classList.toggle('active',x===b));renderFeelings()});
    }
    bindFilterResets();
  }
  function openFeelingGuide(){
    $('#menuBtn')?.click();
    setTimeout(()=>$('#feelingFilter')?.click(),60);
  }
  function addHomeEntry(){
    const hero=$('.heroActions');if(hero&&!$('#homeFeelingBtn')){const b=document.createElement('button');b.id='homeFeelingBtn';b.className='pill';b.innerHTML='♡ What are you feeling?';b.onclick=openFeelingGuide;hero.appendChild(b)}
  }
  function init(){
    addFeelingTab();addHomeEntry();
    new MutationObserver(()=>{addFeelingTab();addHomeEntry();if(feelingMode&&$('#drawer')?.getAttribute('aria-hidden')==='false'&&!$('#drawerBooks .feelingGuide'))renderFeelings()}).observe(document.body,{childList:true,subtree:true});
    addEventListener('hashchange',()=>setTimeout(addHomeEntry,80));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

// Hands-free Read Aloud controls. This is an in-app voice listener; it does not connect to Apple's Siri service.
(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null,listening=false,restarting=false,lastTranscript='',lastCommandAt=0;
  const enabled=()=>localStorage.getItem('meb:voiceCommands')==='1';
  const clean=s=>String(s||'').toLowerCase().replace(/[.,!?;:]/g,' ').replace(/\s+/g,' ').trim();
  const naturalAudio=()=>[...document.querySelectorAll('audio')].find(a=>a.src)||document.querySelector('audio');
  const setStatus=t=>{const e=$('#audioVoiceStatus');if(e)e.textContent=t};

  function addStyles(){
    if($('#voiceCommandStyles'))return;
    const st=document.createElement('style');st.id='voiceCommandStyles';st.textContent=`
      .audioVoiceSetting{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;padding-top:11px;border-top:1px solid var(--line)}
      .audioVoiceCopy{min-width:0;display:flex;flex-direction:column;gap:3px}.audioVoiceCopy>span{font-size:10px;font-weight:900;letter-spacing:.14em;opacity:.72}.audioVoiceCopy>small{font-size:10px;line-height:1.35;opacity:.58}.audioVoiceCopy em{font-size:9px;line-height:1.35;opacity:.72;font-style:normal;margin-top:2px}
      .voiceToggle{position:relative;flex:0 0 48px;width:48px;height:28px;border:0!important;border-radius:999px!important;padding:0!important;background:rgba(120,110,100,.28)!important;box-shadow:none!important}.voiceToggle:after{content:'';position:absolute;width:22px;height:22px;left:3px;top:3px;border-radius:50%;background:var(--paper);box-shadow:0 1px 5px rgba(0,0,0,.2);transition:transform .18s ease}.voiceToggle.active{background:#751d1d!important}.voiceToggle.active:after{transform:translateX(20px)}
      @media(max-width:520px){.audioVoiceSetting{align-items:flex-start}.audioVoiceCopy small{max-width:210px}}
    `;document.head.appendChild(st);
  }

  function ensureControl(){
    addStyles();const modes=$('#audioModes');if(!modes||$('#audioVoiceSetting'))return;
    const row=document.createElement('div');row.id='audioVoiceSetting';row.className='audioVoiceSetting';
    row.innerHTML='<div class="audioVoiceCopy"><span>VOICE COMMANDS</span><small>Say “Hey Siri, stop”, “pause”, “play”, or “explain that”. Direct commands work too.</small><em id="audioVoiceStatus">Off</em></div><button id="audioVoiceToggle" class="voiceToggle" type="button" role="switch" aria-label="Voice command listening" aria-checked="false"></button>';
    modes.appendChild(row);$('#audioVoiceToggle').onclick=toggleListening;syncControl();
  }

  function syncControl(){const b=$('#audioVoiceToggle');if(!b)return;const on=enabled();b.classList.toggle('active',on);b.setAttribute('aria-checked',on?'true':'false');if(!on)setStatus(SR?'Off':'Voice recognition is not supported in this browser')}

  function createRecognition(){
    if(!SR)return null;if(recognition)return recognition;
    const r=new SR();r.lang='en-AU';r.continuous=true;r.interimResults=false;r.maxAlternatives=2;
    r.onstart=()=>{listening=true;restarting=false;setStatus('Listening…')};
    r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(!e.results[i].isFinal)continue;const text=e.results[i][0]?.transcript||'';handleTranscript(text)}};
    r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'||e.error==='audio-capture'){localStorage.setItem('meb:voiceCommands','0');listening=false;setStatus(e.error==='audio-capture'?'Microphone unavailable':'Microphone permission needed');syncControl()}else if(e.error!=='no-speech'&&e.error!=='aborted')setStatus('Listening interrupted')};
    r.onend=()=>{listening=false;if(enabled()&&!restarting){restarting=true;setTimeout(()=>{restarting=false;startListening(false)},350)}};
    recognition=r;return r;
  }

  function startListening(showMessage=true){
    if(!enabled()||!SR)return;const r=createRecognition();if(!r||listening)return;
    try{r.start();if(showMessage)setStatus('Starting microphone…')}catch(e){if(showMessage)setStatus('Microphone already starting')}
  }
  function stopListening(){restarting=true;try{recognition?.stop()}catch{}listening=false;setStatus('Off');setTimeout(()=>{restarting=false},500)}
  function toggleListening(){
    if(!SR){setStatus('Voice recognition is not supported here');return}
    const on=!enabled();localStorage.setItem('meb:voiceCommands',on?'1':'0');syncControl();if(on)startListening();else stopListening();
  }

  function pauseReading(){const a=naturalAudio();if(a&&!a.paused){a.pause();setStatus('Paused');return true}setStatus('Already paused');return false}
  function playReading(){const a=naturalAudio();if(a?.src&&a.paused){a.play().catch(()=>$('#audioPlay')?.click());setStatus('Playing');return}$('#audioPlay')?.click();setStatus('Playing')}
  function stopReading(){window.speechSynthesis?.cancel();$('#audioClose')?.click();setStatus('Stopped')}

  function splitLikeNarrator(text){const parts=[],sent=String(text||'').replace(/\s+/g,' ').trim().split(/(?<=[.!?])\s+/);let cur='',limit=420;for(const s of sent){if((cur+' '+s).length>limit&&cur){parts.push(cur.trim());cur=s;limit=900}else cur+=(cur?' ':'')+s}if(cur)parts.push(cur.trim());return parts}
  function recentNarration(){
    const ref=$('#audioRef')?.textContent?.trim()||'this passage';
    const chapter=$$('#chapterText .verse').map(v=>{const q=v.cloneNode(true);q.querySelectorAll('button').forEach(b=>b.remove());return q.textContent.replace(/\s+/g,' ').trim()}).join(' ');
    if(!chapter)return {ref,text:''};
    const state=$('#audioState')?.textContent||'',m=state.match(/(\d+)\s*\/\s*(\d+)/),parts=splitLikeNarrator(`${ref}. ${chapter}`),i=m?Math.max(0,Math.min(parts.length-1,+m[1]-1)):0;
    return {ref,text:(parts[i]||chapter.slice(0,1100)).slice(0,1600)};
  }
  function explainThat(){
    pauseReading();const recent=recentNarration();
    const q=`Explain the part I was just listening to in more detail. The Read Aloud reference is ${recent.ref}.${recent.text?` The recent narration was: “${recent.text}”`:''} Explain what it means in its immediate context, any important wording, historical background, and the main theological or interpretive points. Keep the explanation clear first, then add deeper detail.`;
    const open=()=>{const input=$('#studyAiInput'),form=$('#studyAiForm');if(!input||!form){setStatus('Study AI is not ready');return}input.value=q;setStatus('Explaining that…');form.requestSubmit()};
    if($('#studyAiDialog')){if(!$('#studyAiDialog').open)$('#studyAiFloat')?.click();setTimeout(open,120)}else{setStatus('Opening Study AI…');setTimeout(()=>{$('#studyAiFloat')?.click();setTimeout(open,160)},300)}
  }

  function commandFrom(text){
    const t=clean(text),saidWake=/\bhey\s+(siri|series|serious)\b/.test(t),body=t.replace(/.*\bhey\s+(siri|series|serious)\b/,'').trim();
    const c=saidWake?body:t;
    if(/\b(explain (that|this)|explain that in more detail|what does that mean|explain it)\b/.test(c))return'explain';
    if(/^(please )?(stop|stop reading|stop read aloud)$/.test(c)||saidWake&&/\bstop\b/.test(c))return'stop';
    if(/^(please )?(pause|pause reading)$/.test(c)||saidWake&&/\bpause\b/.test(c))return'pause';
    if(/^(please )?(play|resume|continue|continue reading)$/.test(c)||saidWake&&/\b(play|resume|continue)\b/.test(c))return'play';
    return'';
  }
  function handleTranscript(text){
    const now=Date.now(),cmd=commandFrom(text);lastTranscript=text;if(!cmd){setStatus(`Heard: “${text.trim()}”`);return}if(now-lastCommandAt<700)return;lastCommandAt=now;
    if(cmd==='stop')stopReading();else if(cmd==='pause')pauseReading();else if(cmd==='play')playReading();else if(cmd==='explain')explainThat();
  }

  function initVoice(){ensureControl();const obs=new MutationObserver(()=>ensureControl());obs.observe($('#audioBar')||document.body,{childList:true,subtree:true});if(enabled()){syncControl();startListening(false)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initVoice);else initVoice();
})();
