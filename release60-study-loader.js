// Hobah Release 60 — keep study data off the critical startup path.
(()=>{
  const V='60';
  let dataPromise=null,studyPromise=null;
  const loadScript=src=>new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(s=>s.src&&new URL(s.src,location.href).pathname===src);
    if(existing){
      if(existing.dataset.hobahLoaded==='1'){resolve();return}
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const el=document.createElement('script');
    el.src=`${src}?v=${V}`;
    el.async=true;
    el.onload=()=>{el.dataset.hobahLoaded='1';resolve()};
    el.onerror=reject;
    document.body.appendChild(el);
  });
  async function loadData(){
    if(window.MEB_STUDY_DATA&&Object.keys(window.MEB_STUDY_DATA).length>=20)return window.MEB_STUDY_DATA;
    if(dataPromise)return dataPromise;
    dataPromise=Promise.all(Array.from({length:10},(_,i)=>loadScript(`/study-data-${String(i).padStart(2,'0')}.js`)))
      .then(()=>window.MEB_STUDY_DATA||{})
      .catch(e=>{dataPromise=null;console.warn('Study data loader:',e);throw e});
    return dataPromise;
  }
  async function loadStudy(){
    if(studyPromise)return studyPromise;
    studyPromise=(async()=>{
      await loadData();
      await loadScript('/curated-notes.js');
      await loadScript('/study-hub.js');
    })().catch(e=>{studyPromise=null;console.warn('Study AI loader:',e);throw e});
    return studyPromise;
  }
  window.MEB_LOAD_STUDY_DATA=loadData;
  window.THE81_FEATURES=Object.assign(window.THE81_FEATURES||{},{core:loadStudy,study:loadStudy});
})();
