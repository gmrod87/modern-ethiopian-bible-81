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
