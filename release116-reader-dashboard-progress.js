const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f),VERSION='116';
for(const f of ['app.js','release94-ancient-library.js','release97-ancient-library.css','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release116 missing '+f);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!/const V='115';/.test(app))throw new Error('Release116 expected app runtime v115');
if(app.includes('__hobahCanonDashboard116'))throw new Error('Release116 canonical dashboard already installed');

const runtime=String.raw`
;(()=>{
  if(window.__hobahCanonDashboard116)return;
  window.__hobahCanonDashboard116=true;
  const $=(s,r=document)=>r?.querySelector?.(s)||null;
  const $$=(s,r=document)=>r?.querySelectorAll?[...r.querySelectorAll(s)]:[];
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const safeParse=v=>{try{return JSON.parse(v)}catch{return null}};
  const getProgress=()=>{try{return safeParse(localStorage.getItem('hobah:lastReading')||'null')}catch{return null}};
  const setProgress=p=>{try{localStorage.setItem('hobah:lastReading',JSON.stringify(p))}catch{}};

  function clearCanonFind(){
    const box=$('#chapterText');if(!box)return;
    $$('.hobahCanonFindMark',box).forEach(mark=>mark.replaceWith(document.createTextNode(mark.textContent||'')));
    box.normalize();
    const status=$('#canonReaderMatchStatus');if(status)status.textContent='';
  }
  function findCanonText(){
    const input=$('#canonReaderSearch'),box=$('#chapterText'),status=$('#canonReaderMatchStatus');
    if(!input||!box||!status)return;
    clearCanonFind();
    const q=clean(input.value);if(!q)return;
    const needle=q.toLocaleLowerCase(),walker=document.createTreeWalker(box,NodeFilter.SHOW_TEXT,{acceptNode(node){
      if(!clean(node.nodeValue))return NodeFilter.FILTER_REJECT;
      if(node.parentElement?.closest('mark,.vnum,button'))return NodeFilter.FILTER_REJECT;
      return node.nodeValue.toLocaleLowerCase().includes(needle)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    let count=0,first=null;
    for(const node of nodes){
      const text=node.nodeValue,lower=text.toLocaleLowerCase();let from=0,idx=lower.indexOf(needle,from);if(idx<0)continue;
      const frag=document.createDocumentFragment();
      while(idx>=0){
        if(idx>from)frag.append(document.createTextNode(text.slice(from,idx)));
        const mark=document.createElement('mark');mark.className='hobahCanonFindMark';mark.textContent=text.slice(idx,idx+q.length);frag.append(mark);first=first||mark;count++;
        from=idx+q.length;idx=lower.indexOf(needle,from);
      }
      if(from<text.length)frag.append(document.createTextNode(text.slice(from)));
      node.replaceWith(frag);
    }
    status.textContent=count?count+' match'+(count===1?'':'es'):'No matches';
    first?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function upgradeCanonDashboard(detail={}){
    const reader=$('.reader:not(.ancientPageReader)'),tools=$('.readerTools',reader);if(!reader||!tools)return;
    const book=$('#bookSelect',tools),chapter=$('#chapterSelect',tools),verse=$('#verseSelect',tools),listen=$('#listenChapter',tools),study=$('#studyChapter',tools),save=$('#saveChapter',tools),font=$('#fontButton',reader);
    if(!book||!chapter||!listen||!study||!font)return;
    tools.classList.add('canonicalReaderTools');
    if(verse)verse.hidden=true;
    listen.textContent='▶ Read aloud';study.textContent='✦ Study AI';
    let find=$('#canonFindToggle',tools);if(!find){find=document.createElement('button');find.id='canonFindToggle';find.type='button';find.textContent='⌕ Find in text';}
    let books=$('#canonBooksBtn',tools);if(!books){books=document.createElement('button');books.id='canonBooksBtn';books.type='button';books.textContent='Books';}
    tools.append(book,chapter,listen,study,find,font,books);
    if(save){save.classList.add('canonSaveChapter');save.setAttribute('aria-label','Save chapter');$('.readerHead',reader)?.append(save)}
    if(!$('#canonInlineFind',reader)){
      const bar=document.createElement('div');bar.id='canonInlineFind';bar.className='ancientInlineFind canonInlineFind';bar.hidden=true;
      bar.innerHTML='<span>⌕</span><input id="canonReaderSearch" type="search" placeholder="Find in this chapter…" aria-label="Find in this chapter"><button id="canonReaderFindBtn" type="button">Find</button><button id="canonReaderClearBtn" type="button" aria-label="Close find">×</button>';
      const status=document.createElement('div');status.id='canonReaderMatchStatus';status.className='ancientReaderMatchStatus canonReaderMatchStatus';
      tools.after(bar,status);
    }
    find.onclick=()=>{const bar=$('#canonInlineFind');if(!bar)return;bar.hidden=!bar.hidden;if(!bar.hidden)setTimeout(()=>$('#canonReaderSearch')?.focus(),20)};
    books.onclick=()=>$('#bottomBooks')?.click();
    $('#canonReaderFindBtn').onclick=findCanonText;
    $('#canonReaderSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findCanonText()}};
    $('#canonReaderClearBtn').onclick=()=>{const input=$('#canonReaderSearch');if(input)input.value='';clearCanonFind();const bar=$('#canonInlineFind');if(bar)bar.hidden=true};
    const b=detail.book,c=detail.chapter;if(b&&c)setProgress({type:'canon',slug:b.slug,title:b.title,chapter:c.n,updatedAt:Date.now()});
  }

  function openAncientProgress(progress,e){
    e?.preventDefault?.();e?.stopPropagation?.();
    if(window.HobahAncientLibrary?.open)window.HobahAncientLibrary.open(progress.workId,progress.chapterIndex||0,{restore:true});
    else document.dispatchEvent(new CustomEvent('hobah:open-ancient-progress',{detail:progress}));
  }
  function enhanceHomeContinue(){
    if(location.hash&&location.hash!=='#home')return;
    const progress=getProgress();if(!progress||progress.type!=='ancient'||!progress.workId)return;
    const hero=$('.homeHero .primaryBtn'),card=$('.continueGrid .continueCard');if(!hero||!card)return;
    const label=clean(progress.chapterLabel||'');
    hero.textContent='Continue reading';hero.setAttribute('href','#');hero.dataset.ancientContinue='1';hero.onclick=e=>openAncientProgress(progress,e);
    card.setAttribute('href','#');card.dataset.ancientContinue='1';card.onclick=e=>openAncientProgress(progress,e);
    const eyebrow=$('span',card),title=$('b',card),small=$('small',card);
    if(eyebrow)eyebrow.textContent='ANCIENT LIBRARY';
    if(title)title.textContent=progress.title+(label?' — '+label:'');
    if(small)small.textContent='Your place is saved automatically.';
  }

  document.addEventListener('hobah:chapter',e=>upgradeCanonDashboard(e.detail||{}));
  document.addEventListener('hobah:ancient-progress',enhanceHomeContinue);
  const boot=()=>{
    const app=$('#app');if(app)new MutationObserver(()=>{if($('.homeHero',app))enhanceHomeContinue()}).observe(app,{childList:true,subtree:true});
    enhanceHomeContinue();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
`;
app+=runtime;
app=app.replace("const V='115';","const V='116';");
fs.writeFileSync(p('app.js'),app);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!/const LIB_VERSION='115';/.test(lib))throw new Error('Release116 expected Ancient Library v115');
if(lib.includes('__hobahAncientProgress116'))throw new Error('Release116 Ancient progress already installed');
const end=lib.lastIndexOf('})();');if(end<0)throw new Error('Release116 Ancient Library IIFE end missing');
const progressRuntime=String.raw`

/* Hobah Release 116 — unified reading progress for Ancient Library. */
if(!window.__hobahAncientProgress116){
  window.__hobahAncientProgress116=true;
  const progressKey='hobah:lastReading';
  const readProgress=()=>{try{return JSON.parse(localStorage.getItem(progressKey)||'null')}catch{return null}};
  const writeProgress=p=>{try{localStorage.setItem(progressKey,JSON.stringify(p))}catch{}document.dispatchEvent(new CustomEvent('hobah:ancient-progress',{detail:p}))};
  const baseOpenAncientReader=openAncientReader;
  let currentProgress=null,saveTimer=null;
  openAncientReader=async function(workId,chapterIndex=0,options={}){
    const before=readProgress(),same=before?.type==='ancient'&&before.workId===workId&&Number(before.chapterIndex||0)===Number(chapterIndex||0),restoreY=same?Math.max(0,Number(before.scrollY)||0):0;
    await baseOpenAncientReader(workId,chapterIndex);
    const work=findWork(workId),chapter=work?.chapters?.[chapterIndex];
    if(!work||!chapter)return;
    currentProgress={type:'ancient',workId:work.id,title:work.title,chapterIndex:Number(chapterIndex)||0,chapterLabel:clean(chapter.label||''),scrollY:restoreY,updatedAt:Date.now()};
    writeProgress(currentProgress);
    if(restoreY>0)setTimeout(()=>{if(document.querySelector('.ancientPageReader'))window.scrollTo({top:restoreY,left:0,behavior:'instant'})},60);
  };
  const saveScroll=()=>{
    if(!currentProgress||!document.querySelector('.ancientPageReader'))return;
    currentProgress={...currentProgress,scrollY:Math.max(0,Math.round(window.scrollY||0)),updatedAt:Date.now()};writeProgress(currentProgress);
  };
  window.addEventListener('scroll',()=>{if(!currentProgress||!document.querySelector('.ancientPageReader'))return;clearTimeout(saveTimer);saveTimer=setTimeout(saveScroll,180)},{passive:true});
  window.addEventListener('pagehide',saveScroll,{passive:true});
  window.HobahAncientLibrary={...(window.HobahAncientLibrary||{}),open:(workId,chapterIndex=0,options={})=>openAncientReader(workId,chapterIndex,options)};
  document.addEventListener('hobah:open-ancient-progress',e=>{const p=e.detail||{};if(p.workId)openAncientReader(p.workId,Number(p.chapterIndex)||0,{restore:true})});
}
`;
lib=lib.slice(0,end)+progressRuntime+'\n'+lib.slice(end);
lib=lib.replace("const LIB_VERSION='115';","const LIB_VERSION='116';");
fs.writeFileSync(p('release94-ancient-library.js'),lib);

const css=String.raw`
/* Hobah Release 116 — Ancient-style control dashboard for every canonical reader */
.canonicalReaderTools{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:9px!important;padding:12px!important;align-items:stretch!important;margin-top:18px!important;}
.canonicalReaderTools select,.canonicalReaderTools button{min-height:48px!important;height:48px!important;border-radius:14px!important;max-width:100%!important;box-sizing:border-box!important;}
.canonicalReaderTools #bookSelect,.canonicalReaderTools #chapterSelect{grid-column:1/-1!important;width:100%!important;padding-left:12px!important;font-size:15px!important;font-weight:700!important;text-overflow:ellipsis!important;overflow:hidden!important;}
.canonicalReaderTools #verseSelect{display:none!important;}
.canonicalReaderTools #listenChapter,.canonicalReaderTools #studyChapter{grid-column:auto!important;font-weight:800!important;font-size:.88rem!important;}
.canonicalReaderTools #listenChapter{background:#0d574c!important;color:#f8f4ea!important;border-color:#0d574c!important;}
.canonicalReaderTools #studyChapter{background:#fffdf8!important;color:#0d574c!important;}
.canonicalReaderTools #canonFindToggle,.canonicalReaderTools #fontButton,.canonicalReaderTools #canonBooksBtn{grid-column:auto!important;min-width:0!important;font-size:.78rem!important;}
.canonicalReaderTools #canonFindToggle{grid-column:1!important;}
.canonicalReaderTools #fontButton{grid-column:2!important;margin:0!important;width:100%!important;}
.canonicalReaderTools #canonBooksBtn{grid-column:1/-1!important;width:100%!important;}
.canonInlineFind{max-width:100%!important;margin:10px 0 0!important;}
.canonReaderMatchStatus{max-width:100%!important;margin:6px 0 0!important;}
.readerHead{position:relative!important;}
.canonSaveChapter{position:absolute!important;right:0!important;bottom:16px!important;width:44px!important;height:44px!important;min-width:44px!important;border-radius:50%!important;font-size:22px!important;background:rgba(255,253,248,.92)!important;color:#0d574c!important;border:1px solid rgba(13,87,76,.18)!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;}
.hobahCanonFindMark{background:#f2d89b!important;color:inherit!important;border-radius:3px!important;padding:0 .05em!important;}
@media(min-width:720px){
  .canonicalReaderTools{grid-template-columns:minmax(230px,1.5fr) minmax(150px,1fr) auto auto auto auto auto!important;align-items:center!important;}
  .canonicalReaderTools #bookSelect,.canonicalReaderTools #chapterSelect,.canonicalReaderTools #canonFindToggle,.canonicalReaderTools #fontButton,.canonicalReaderTools #canonBooksBtn{grid-column:auto!important;width:auto!important;}
}
@media(max-width:380px){
  .canonicalReaderTools{padding:9px!important;gap:7px!important;}
  .canonicalReaderTools select,.canonicalReaderTools button{min-height:46px!important;height:46px!important;}
  .canonSaveChapter{right:0!important;bottom:12px!important;width:40px!important;height:40px!important;min-width:40px!important;}
}
`;
fs.appendFileSync(p('release97-ancient-library.css'),'\n'+css+'\n');

let html=fs.readFileSync(p('index.html'),'utf8').replace(/\?v=115\b/g,'?v=116');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=116#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const V='116';",'__hobahCanonDashboard116','canonFindToggle','hobah:lastReading'])if(!app.includes(required))throw new Error('Release116 app integration missing '+required);
for(const required of ["const LIB_VERSION='116';",'__hobahAncientProgress116','HobahAncientLibrary','scrollY'])if(!lib.includes(required))throw new Error('Release116 Ancient integration missing '+required);
for(const required of ['canonicalReaderTools','#canonBooksBtn','.hobahCanonFindMark'])if(!css.includes(required))throw new Error('Release116 CSS integration missing '+required);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
console.log('Hobah Release 116: canonical readers now use the Ancient Library control dashboard; Ancient reading place persists and resumes from Home');
