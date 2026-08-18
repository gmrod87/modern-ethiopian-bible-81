(()=>{
  const $=s=>document.querySelector(s);
  const AC=window.AudioContext||window.webkitAudioContext;
  let ctx=null,master=null,filter=null,timer=null,voices=[],profileId='',active=false;
  const enabled=()=>localStorage.getItem('meb:ambient')==='1';
  const profiles={
    gratitude:{label:'Grateful',key:'G major',step:11800,chords:[[55,59,62,67],[60,64,67,72],[52,55,59,64],[50,54,57,62]]},
    comfort:{label:'Calm',key:'F major',step:12500,chords:[[53,57,60,65],[58,62,65,70],[48,55,60,64],[53,57,60,65]]},
    loving:{label:'Tender',key:'C major',step:12000,chords:[[48,52,55,60],[45,48,52,57],[41,45,48,53],[43,47,50,55]]},
    hope:{label:'Hopeful',key:'D major',step:11600,chords:[[50,54,57,62],[55,59,62,67],[47,50,54,59],[45,49,52,57]]},
    mystery:{label:'Mystery',key:'D minor',step:13200,chords:[[50,53,57,62],[46,50,53,58],[48,52,55,60],[45,48,52,57]]},
    reflective:{label:'Reflective',key:'A minor',step:13400,chords:[[45,48,52,57],[41,45,48,53],[48,52,55,60],[43,47,50,55]]},
    wisdom:{label:'Still',key:'C major',step:12800,chords:[[48,52,55,60],[53,57,60,65],[45,48,52,57],[43,47,50,55]]}
  };
  const gratitudePsalms=new Set([8,19,23,34,65,84,92,95,96,98,100,103,104,107,117,118,136,145,146,147,148,149,150]);
  const lamentPsalms=new Set([6,13,22,31,38,42,43,44,51,69,77,88,102,130,137]);
  const apocalypse=new Set(['1-enoch','daniel','revelation','ezra-sutuel-4-ezra-apocalyptic-core','daniel-greek-additions','4-baruch-paralipomena-of-jeremiah']);
  const sorrow=new Set(['lamentations','job','ecclesiastes','prayer-of-manasseh']);
  const wisdom=new Set(['proverbs','sirach-ecclesiasticus','wisdom-of-solomon','james']);

  function currentRef(){const m=location.hash.match(/^#read\/([^/]+)\/(\d+)/);return m?{slug:m[1],chapter:+m[2]}:null}
  function profileFor(ref=currentRef()){
    if(!ref)return 'comfort';
    const {slug,chapter}=ref;
    if(apocalypse.has(slug))return 'mystery';
    if(slug==='psalms'){if(gratitudePsalms.has(chapter))return 'gratitude';if(lamentPsalms.has(chapter))return 'reflective';return 'comfort'}
    if(sorrow.has(slug))return 'reflective';
    if(wisdom.has(slug))return 'wisdom';
    if(slug==='song-of-songs'||slug==='1-john'||(slug==='1-corinthians'&&chapter===13)||(slug==='john'&&chapter>=13&&chapter<=17))return 'loving';
    if((slug==='matthew'&&chapter>=26&&chapter<=27)||(slug==='mark'&&chapter>=14&&chapter<=15)||(slug==='luke'&&chapter>=22&&chapter<=23)||(slug==='john'&&chapter>=18&&chapter<=19))return 'reflective';
    if((slug==='matthew'&&chapter===28)||(slug==='mark'&&chapter===16)||(slug==='luke'&&chapter===24)||(slug==='john'&&chapter>=20)||slug==='romans')return 'hope';
    return 'comfort';
  }
  const hz=m=>440*Math.pow(2,(m-69)/12);
  function ensureContext(){
    if(!AC)return null;
    if(ctx)return ctx;
    ctx=new AC();master=ctx.createGain();filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=920;filter.Q.value=.35;filter.connect(master);master.connect(ctx.destination);master.gain.value=0;return ctx;
  }
  function clearVoices(delay=0){const old=voices.splice(0);setTimeout(()=>old.forEach(v=>{try{v.stop()}catch{}}),delay)}
  function fadeTo(value,seconds=2){if(!master||!ctx)return;const now=ctx.currentTime;master.gain.cancelScheduledValues(now);master.gain.setValueAtTime(master.gain.value,now);master.gain.linearRampToValueAtTime(value,now+seconds)}
  function playChord(notes,duration=15){
    if(!ctx||!filter)return;const now=ctx.currentTime,created=[];
    notes.forEach((m,i)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();o.type=i===0?'triangle':'sine';o.frequency.value=hz(m);o.detune.value=i%2?2:-2;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(i===0?.007:.006,now+3.2);g.gain.setValueAtTime(i===0?.007:.006,now+duration-4);g.gain.linearRampToValueAtTime(0,now+duration);o.connect(g);g.connect(filter);o.start(now);o.stop(now+duration+.2);created.push(o)
    });
    const root=ctx.createOscillator(),rg=ctx.createGain();root.type='sine';root.frequency.value=hz(notes[0]-12);rg.gain.setValueAtTime(0,now);rg.gain.linearRampToValueAtTime(.004,now+4);rg.gain.linearRampToValueAtTime(0,now+duration);root.connect(rg);rg.connect(filter);root.start(now);root.stop(now+duration+.2);created.push(root);voices.push(...created);setTimeout(()=>{voices=voices.filter(v=>!created.includes(v))},(duration+1)*1000)
  }
  function schedule(id){
    const p=profiles[id]||profiles.comfort;let n=0;playChord(p.chords[n],p.step/1000+4);timer=setInterval(()=>{n=(n+1)%p.chords.length;playChord(p.chords[n],p.step/1000+4)},p.step)
  }
  function updateButton(){const b=$('#audioAmbient');if(!b)return;const id=profileFor(),p=profiles[id];b.classList.toggle('active',enabled());b.textContent=enabled()?`♫ ${p.label}`:'♫ Ambient';b.title=enabled()?`Adaptive ambient music: ${p.label} · ${p.key}. Tap to turn off.`:'Turn on quiet adaptive ambient music behind Read Aloud.'}
  async function start(){
    if(!enabled())return;const c=ensureContext();if(!c)return;try{await c.resume()}catch{}const id=profileFor();if(timer&&profileId!==id){clearInterval(timer);timer=null;fadeTo(0,1.2);clearVoices(1800)}if(!timer){profileId=id;schedule(id)}active=true;fadeTo(.72,2.8);updateButton()
  }
  function pause(){if(!ctx)return;active=false;fadeTo(0,1.8);if(timer){clearInterval(timer);timer=null}clearVoices(2400);updateButton()}
  function stop(){pause();profileId=''}
  function audioPlaying(){const a=document.querySelector('audio');return !!a&&!a.paused&&!a.ended}
  function toggleAmbient(){
    const next=!enabled();localStorage.setItem('meb:ambient',next?'1':'0');
    if(next){ensureContext()?.resume?.().catch?.(()=>{});if(audioPlaying())start()}else stop();
    const p=profiles[profileFor()];const state=$('#audioState');if(state)state.textContent=next?`Ambient ready · ${p.label} · ${p.key}`:'Ambient music off';updateButton()
  }
  function ensureControl(){
    const ctr=$('.audioControls');if(!ctr)return;if($('#audioAmbient')){updateButton();return}
    const b=document.createElement('button');b.id='audioAmbient';b.className='audioExtra audioAmbient';b.type='button';b.onclick=toggleAmbient;const sleep=$('#audioSleep'),close=$('#audioClose');ctr.insertBefore(b,sleep||close);updateButton()
  }
  function init(){
    ensureControl();new MutationObserver(ensureControl).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('play',e=>{if(e.target?.tagName==='AUDIO')start()},true);
    document.addEventListener('pause',e=>{if(e.target?.tagName==='AUDIO'&&!e.target.ended)pause()},true);
    document.addEventListener('click',e=>{if(e.target?.id==='audioClose')stop()},true);
    document.addEventListener('pointerdown',()=>{if(enabled())ensureContext()?.resume?.().catch?.(()=>{})},{passive:true});
    addEventListener('hashchange',()=>{if(enabled()&&audioPlaying())setTimeout(start,120);else updateButton()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

// Read Aloud UI cleanup + Study AI narration bridge.
(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let studyAudio=null,studyAbort=false,studyFlow=null;
  const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
  const scriptureAudio=()=>$$('audio').find(a=>!a.classList.contains('studyAiNarration')&&a.src)||null;
  const setState=t=>{const e=$('#audioState');if(e)e.textContent=t},setRef=t=>{const e=$('#audioRef');if(e)e.textContent=t},setPlay=t=>{const e=$('#audioPlay');if(e)e.textContent=t};

  function organisePlayer(){
    const bar=$('#audioBar'),title=$('.audioTitle'),controls=$('.audioControls'),modes=$('#audioModes');if(!bar||!title||!controls||!modes)return false;
    bar.classList.add('audioBarClean');
    if(!$('#audioPanelLabel')){const label=document.createElement('div');label.id='audioPanelLabel';label.className='audioPanelLabel';label.innerHTML='<span>READ ALOUD</span><small>Continuous scripture · natural voice</small>';bar.insertBefore(label,title)}
    const close=$('#audioClose');if(close&&close.parentElement!==title){close.classList.add('audioTopClose');title.appendChild(close)}
    if(!$('#audioTransport')){const transport=document.createElement('div');transport.id='audioTransport';transport.className='audioTransport';[$('#audioPrev'),$('#audioPlay'),$('#audioNext')].filter(Boolean).forEach(x=>transport.appendChild(x));controls.insertBefore(transport,controls.firstChild)}
    if(!$('#audioUtilities')){const util=document.createElement('div');util.id='audioUtilities';util.className='audioUtilities';[$('#voiceSelect'),$('#rateSelect'),$('#audioContinuous'),$('#audioSleep')].filter(Boolean).forEach(x=>util.appendChild(x));controls.appendChild(util)}
    if(!$('#audioSettingsLabel')){const label=document.createElement('div');label.id='audioSettingsLabel';label.className='audioSettingsLabel';label.textContent='LISTENING SETTINGS';const first=modes.querySelector('.audioAmbientSetting,.audioVoiceSetting');if(first)modes.insertBefore(label,first);else modes.appendChild(label)}
    return true;
  }
  function waitForPlayer(){if(organisePlayer())return;const root=$('#audioBar')||document.body;const obs=new MutationObserver(()=>{if(organisePlayer())obs.disconnect()});obs.observe(root,{childList:true,subtree:true});setTimeout(()=>obs.disconnect(),15000)}
  function splitForSpeech(text){const out=[],sent=clean(text).split(/(?<=[.!?])\s+/);let cur='';for(const s of sent){if((cur+' '+s).length>820&&cur){out.push(cur.trim());cur=s}else cur+=(cur?' ':'')+s}if(cur)out.push(cur.trim());return out}
  async function makeSpeech(text){const r=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin',mode:localStorage.getItem('meb:audioMode')||'normal'})});if(!r.ok)throw new Error('Study narration unavailable');return r.blob()}
  function stopStudyNarration(resume=false){studyAbort=true;if(studyAudio){try{studyAudio.pause();if(studyAudio.src.startsWith('blob:'))URL.revokeObjectURL(studyAudio.src)}catch{}studyAudio.remove();studyAudio=null}window.MEB_STUDY_AUDIO_ACTIVE=false;if(resume)resumeScripture()}
  async function narrateStudyAnswer(text){
    const parts=splitForSpeech(text);if(!parts.length){resumeScripture();return}studyAbort=false;window.MEB_STUDY_AUDIO_ACTIVE=true;const oldRef=$('#audioRef')?.textContent||'Read aloud';setRef('Study AI explanation');setPlay('❚❚');
    for(let i=0;i<parts.length;i++){
      if(studyAbort)return;setState(`Study AI • ${i+1}/${parts.length}`);
      try{const blob=await makeSpeech(parts[i]);if(studyAbort)return;const a=document.createElement('audio');studyAudio=a;a.className='studyAiNarration';a.preload='auto';a.setAttribute('playsinline','');a.style.display='none';const scripture=scriptureAudio();if(scripture?.parentElement)scripture.parentElement.insertBefore(a,scripture);else document.body.appendChild(a);a.src=URL.createObjectURL(blob);a.load();await new Promise((resolve,reject)=>{a.onended=resolve;a.onerror=()=>reject(new Error('Study narration playback error'));a.play().catch(reject)});try{URL.revokeObjectURL(a.src)}catch{}a.remove();studyAudio=null}catch(e){console.warn(e);setState('Could not read Study AI answer');break}
    }
    window.MEB_STUDY_AUDIO_ACTIVE=false;setRef(oldRef);if(!studyAbort)resumeScripture();
  }
  function resumeScripture(){const flow=studyFlow;studyFlow=null;if(!flow?.audio)return;$('#studyAiDialog')?.open&&$('#studyAiDialog').close();setState('Returning to scripture…');flow.audio.play().catch(()=>$('#audioPlay')?.click())}
  function beginStudyFlow(){const a=scriptureAudio();if(!a||!window.MEB_NATURAL_AUDIO_ACTIVE)return;studyFlow={audio:a,startedAt:Date.now()};if(!a.paused)a.pause();setState('Study AI • preparing explanation…')}
  function latestAssistantText(){const msgs=$$('#studyAiMessages .studyAiMsg.assistant p');return clean(msgs[msgs.length-1]?.innerText||msgs[msgs.length-1]?.textContent||'')}
  function waitForAnswer(){const started=Date.now();let last='';const timer=setInterval(()=>{if(!studyFlow){clearInterval(timer);return}const btn=$('#studyAiForm button'),answer=latestAssistantText();if(answer)last=answer;const done=btn&&btn.textContent.trim()==='Ask'&&last&&last!=='Starting answer…';if(done){clearInterval(timer);narrateStudyAnswer(last)}else if(Date.now()-started>120000){clearInterval(timer);setState('Study AI took too long');resumeScripture()}},250)}
  document.addEventListener('submit',e=>{if(e.target?.id!=='studyAiForm')return;const voiceExplain=$('#audioVoiceStatus')?.textContent?.includes('Explaining')||false;if(window.MEB_NATURAL_AUDIO_ACTIVE||voiceExplain){beginStudyFlow();setTimeout(waitForAnswer,80)}},true);
  document.addEventListener('click',e=>{if(e.target?.id==='audioClose'&&window.MEB_STUDY_AUDIO_ACTIVE){stopStudyNarration(false);studyFlow=null}},true);
  window.MEB_STUDY_AUDIO_CONTROL={pause(){if(studyAudio&&!studyAudio.paused){studyAudio.pause();setState('Study AI paused');setPlay('▶');return true}return false},play(){if(studyAudio?.paused){studyAudio.play();setState('Study AI explanation');setPlay('❚❚');return true}return false},stop(){if(window.MEB_STUDY_AUDIO_ACTIVE){stopStudyNarration(false);studyFlow=null;setState('Ready');setPlay('▶');return true}return false}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForPlayer);else waitForPlayer();
})();
