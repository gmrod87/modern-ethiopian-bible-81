// Hobah Release 61 — single-request study/context loader and direct Study AI header control.
(()=>{
  const V='61';
  let dataPromise=null,studyPromise=null;
  const loaded=new Map();
  function loadScript(src){
    if(loaded.has(src))return loaded.get(src);
    const p=new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src&&new URL(s.src,location.href).pathname===src);
      if(existing){
        if(existing.dataset.hobahLoaded==='1'||existing.readyState==='complete'){resolve();return}
        existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;
      }
      const el=document.createElement('script');el.src=`${src}?v=${V}`;el.async=true;
      el.onload=()=>{el.dataset.hobahLoaded='1';resolve()};el.onerror=()=>reject(new Error(`Could not load ${src}`));document.body.appendChild(el);
    }).catch(e=>{loaded.delete(src);throw e});
    loaded.set(src,p);return p;
  }
  async function loadData(){
    if(window.MEB_STUDY_DATA&&Object.keys(window.MEB_STUDY_DATA).length>=20)return window.MEB_STUDY_DATA;
    if(!dataPromise)dataPromise=loadScript('/study-data-all.js').then(()=>window.MEB_STUDY_DATA||{}).catch(e=>{dataPromise=null;throw e});
    return dataPromise;
  }
  async function loadStudy(){
    if(!studyPromise)studyPromise=(async()=>{await loadData();await loadScript('/curated-notes.js');await loadScript('/study-hub.js');return true})().catch(e=>{studyPromise=null;throw e});
    return studyPromise;
  }
  async function openAI(){
    const b=document.getElementById('studyAiHeaderBtn');if(b){b.disabled=true;b.textContent='Opening…'}
    try{await loadStudy();const dlg=document.getElementById('studyAiDialog');if(dlg&&!dlg.open){const f=document.getElementById('studyAiFloat');if(f)f.click();else dlg.showModal()}}
    catch(e){console.warn('Study AI load failed',e);const t=document.getElementById('toast');if(t){t.textContent='Study AI could not load. Tap again.';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}}
    finally{if(b){b.disabled=false;b.textContent='Study AI'}}
  }
  function bindHeader(){const b=document.getElementById('studyAiHeaderBtn');if(b&&!b.dataset.r61){b.dataset.r61='1';b.addEventListener('click',openAI)}}
  window.MEB_LOAD_STUDY_DATA=loadData;
  window.THE81_FEATURES=Object.assign(window.THE81_FEATURES||{},{core:loadStudy,study:loadStudy});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindHeader,{once:true});else bindHeader();
})();
