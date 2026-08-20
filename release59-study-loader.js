// Hobah Release 59 — load Study AI only when a voice command or Study control needs it.
(()=>{
  let promise=null;
  const loadScript=src=>new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(s=>s.src&&new URL(s.src,location.href).pathname===src);
    if(existing){resolve();return}
    const el=document.createElement('script');
    el.src=`${src}?v=59`;
    el.async=false;
    el.onload=resolve;
    el.onerror=reject;
    document.body.appendChild(el);
  });
  async function loadStudy(){
    if(promise)return promise;
    promise=(async()=>{
      await loadScript('/curated-notes.js');
      await loadScript('/study-hub.js');
    })().catch(e=>{promise=null;console.warn('Study AI loader:',e);throw e});
    return promise;
  }
  window.THE81_FEATURES=Object.assign(window.THE81_FEATURES||{},{core:loadStudy,study:loadStudy});
})();
