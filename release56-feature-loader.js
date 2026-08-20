(()=>{
  const V='56';
  const loaded=new Map();
  const started={study:false,research:false,extras:false};
  const $=s=>document.querySelector(s);

  function script(src){
    if(loaded.has(src))return loaded.get(src);
    const p=new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src&&new URL(s.src,location.href).pathname===src);
      if(existing){resolve();return}
      const el=document.createElement('script');
      el.src=`${src}?v=${V}`;
      el.async=false;
      el.onload=resolve;
      el.onerror=reject;
      document.body.appendChild(el);
    });
    loaded.set(src,p);
    return p;
  }

  async function loadList(list){
    for(const src of list){
      try{await script('/'+src)}catch(e){console.warn('Hobah optional feature unavailable:',src,e)}
    }
  }

  const study=[...Array.from({length:10},(_,i)=>`study-data-${String(i).padStart(2,'0')}.js`),'curated-notes.js','study.js','study-hub.js'];
  const research=['research-data.js','research-texts.js','research-suite.js'];
  const extras=['chronology.js','experience.js','ambient-audio.js'];

  async function loadStudy(){
    if(started.study)return loaded.get('__study')||Promise.resolve();
    started.study=true;
    const p=loadList(study);
    loaded.set('__study',p);
    return p;
  }
  async function loadResearch(){
    if(started.research)return loaded.get('__research')||Promise.resolve();
    started.research=true;
    const p=(async()=>{await loadStudy();await loadList(research)})();
    loaded.set('__research',p);
    return p;
  }
  async function loadExtras(){
    if(started.extras)return loaded.get('__extras')||Promise.resolve();
    started.extras=true;
    const p=loadList(extras);
    loaded.set('__extras',p);
    return p;
  }

  function addLauncher(parent,id,label,kind){
    if(!parent||document.getElementById(id))return;
    const b=document.createElement('button');
    b.id=id;
    b.type='button';
    b.textContent=label;
    b.dataset.hobahLazy=kind;
    parent.appendChild(b);
  }

  function mountLaunchers(){
    if(location.hash.startsWith('#read/')){
      const tools=$('.readerTools');
      if(tools){
        addLauncher(tools,'readerStudyLibrary','✦ Study','study');
        addLauncher(tools,'readerResearch','⌕ Research','research');
      }
    }else if(location.hash==='#home'||!location.hash){
      const hero=$('.heroActions');
      if(hero)addLauncher(hero,'homeStudyLibrary','✦ Study Library','study');
    }
  }

  function mountSoon(){
    let tries=0;
    const tick=()=>{
      mountLaunchers();
      const ready=$('.readerTools')||$('.heroActions');
      if(!ready&&++tries<30)setTimeout(tick,100);
    };
    tick();
  }

  async function activateLazyButton(btn,kind){
    if(!btn||btn.dataset.loading==='1')return;
    btn.dataset.loading='1';
    const original=btn.textContent;
    btn.textContent=kind==='research'?'Loading research…':'Loading study…';
    btn.disabled=true;
    const id=btn.id;
    btn.remove();
    try{
      if(kind==='research')await loadResearch();else if(kind==='extras')await loadExtras();else await loadStudy();
      requestAnimationFrame(()=>{
        const target=document.getElementById(id);
        if(target&&target!==btn)target.click();
        else if(kind==='study')document.getElementById('studyHubBtn')?.click();
        else if(kind==='research')document.querySelector('.researchLaunch,.researchPrimary,#readerResearch')?.click();
      });
    }catch(e){
      console.warn(e);
      btn.disabled=false;
      btn.dataset.loading='0';
      btn.textContent=original;
      ($('.readerTools')||$('.heroActions'))?.appendChild(btn);
    }
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-hobah-lazy]');
    if(!b)return;
    e.preventDefault();
    e.stopPropagation();
    activateLazyButton(b,b.dataset.hobahLazy);
  },true);

  document.addEventListener('pointerdown',e=>{
    if(e.target.closest?.('#studyHubBtn,#studyAiFloat,.studyToggle,[data-study]'))loadStudy();
    if(e.target.closest?.('.researchLaunch,.researchPrimary,[data-research]'))loadResearch();
    if(e.target.closest?.('#ambientBtn,#audioAmbient,[data-ambient],#chronologyBtn,[data-chronology]'))loadExtras();
  },{capture:true,passive:true});

  addEventListener('hashchange',mountSoon,{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountSoon,{once:true});else mountSoon();

  window.THE81_FEATURES={core:loadStudy,study:loadStudy,research:loadResearch,extras:loadExtras};
})();
