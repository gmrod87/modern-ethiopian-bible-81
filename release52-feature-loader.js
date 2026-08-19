(()=>{
  const V='52';
  const loaded=new Map();
  const started={study:false,research:false,extras:false};
  const idle=(timeout=1000)=>new Promise(resolve=>{
    if('requestIdleCallback' in window)requestIdleCallback(()=>resolve(),{timeout});
    else setTimeout(resolve,32);
  });
  function script(src){
    if(loaded.has(src))return loaded.get(src);
    const p=new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src&&new URL(s.src,location.href).pathname===src);
      if(existing){resolve();return}
      const s=document.createElement('script');
      s.src=`${src}?v=${V}`;s.async=false;s.defer=false;
      s.onload=resolve;s.onerror=reject;document.body.appendChild(s);
    });
    loaded.set(src,p);return p;
  }
  async function loadList(list){
    for(const src of list){
      await idle(700);
      try{await script('/'+src)}catch(e){console.warn('Deferred Hobah feature unavailable:',src,e)}
    }
  }
  const study=[...Array.from({length:10},(_,i)=>`study-data-${String(i).padStart(2,'0')}.js`),'curated-notes.js','study.js','study-hub.js'];
  const research=['research-data.js','research-texts.js','research-suite.js'];
  const extras=['chronology.js','experience.js','ambient-audio.js'];
  function loadStudy(){if(started.study)return;started.study=true;loadList(study)}
  function loadResearch(){if(started.research)return;started.research=true;loadList(research)}
  function loadExtras(){if(started.extras)return;started.extras=true;loadList(extras)}
  function scheduleForRoute(){
    if(location.hash.startsWith('#read/')){
      if('requestIdleCallback' in window)requestIdleCallback(loadStudy,{timeout:2200});else setTimeout(loadStudy,900);
      setTimeout(()=>{if('requestIdleCallback' in window)requestIdleCallback(loadExtras,{timeout:5000});else loadExtras()},4200);
    }
  }
  addEventListener('hashchange',scheduleForRoute,{passive:true});
  if(document.readyState==='complete')scheduleForRoute();else addEventListener('load',scheduleForRoute,{once:true,passive:true});

  /* Only feature-specific taps trigger feature code. Header/menu taps never do. */
  document.addEventListener('pointerdown',e=>{
    const t=e.target.closest?.('#readerStudyLibrary,#studyHubBtn,#studyAiFloat,.studyToggle,[data-study]');
    if(t)loadStudy();
    const r=e.target.closest?.('#readerResearch,[data-research],.researchLaunch,.researchPrimary');
    if(r){loadStudy();loadResearch()}
    const x=e.target.closest?.('#ambientBtn,#audioAmbient,[data-ambient],#chronologyBtn,[data-chronology]');
    if(x)loadExtras();
  },{capture:true,passive:true});

  /* Research can load later without competing with first interaction. */
  setTimeout(()=>{
    if(location.hash.startsWith('#read/')&&'requestIdleCallback' in window)requestIdleCallback(loadResearch,{timeout:12000});
  },9000);

  window.THE81_FEATURES={core:loadStudy,study:loadStudy,research:loadResearch,extras:loadExtras};
})();
