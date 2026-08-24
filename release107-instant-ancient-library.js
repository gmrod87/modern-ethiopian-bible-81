const fs=require('fs'),path=require('path'),vm=require('vm'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','ancient-library.json','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release107 missing '+f);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!lib.includes("const LIB_VERSION='106';"))throw new Error('Release107 expected Ancient Library v106');

const manifest=JSON.parse(fs.readFileSync(p('ancient-library.json'),'utf8'));
if(!Array.isArray(manifest.sections)||manifest.sections.length<25)throw new Error('Release107 Ancient Library manifest is missing or incomplete');

function buildShelfFromFinalRuntime(runtime,data){
  const close='\n})();';
  const at=runtime.lastIndexOf(close);
  if(at<0)throw new Error('Release107 could not expose final Ancient catalog builder');
  const exposed=runtime.slice(0,at)+"\nglobalThis.__hobahRelease107BuildCatalog=buildCatalog;"+runtime.slice(at);
  const doc={
    readyState:'loading',
    documentElement:{dataset:{}},
    addEventListener(){},
    removeEventListener(){},
    querySelector(){return null},
    querySelectorAll(){return []},
    body:{classList:{add(){},remove(){},toggle(){}}}
  };
  const context={
    console,
    document:doc,
    location:{hash:'',href:'http://localhost/'},
    navigator:{userAgent:'release107-build'},
    performance:{now:()=>0},
    setInterval:()=>0,
    clearInterval(){},
    setTimeout:()=>0,
    clearTimeout(){},
    requestAnimationFrame:fn=>{if(typeof fn==='function')fn();return 0},
    cancelAnimationFrame(){},
    fetch(){throw new Error('Release107 build-time runtime must not fetch')},
    getSelection(){return null}
  };
  context.window=context;
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(exposed,context,{timeout:15000,filename:'release94-ancient-library.js'});
  if(typeof context.__hobahRelease107BuildCatalog!=='function')throw new Error('Release107 final catalog builder was not exposed');
  const catalog=context.__hobahRelease107BuildCatalog(data);
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Release107 final Ancient catalog is empty');
  return catalog.map(w=>({
    id:String(w.id||''),
    title:String(w.title||'Ancient Text'),
    collection:String(w.collection||'early'),
    meta:{
      author:String(w.meta?.author||'Unknown author'),
      date:String(w.meta?.date||'Date uncertain')
    },
    chapterCount:Array.isArray(w.chapters)?w.chapters.length:0
  }));
}

const shelf=buildShelfFromFinalRuntime(lib,manifest);
const shelfJSON=JSON.stringify(shelf).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');

const instantHelpers=`
const PREBUILT_ANCIENT_SHELF=${shelfJSON};
function paintAncientInstant(){
  const catalog=PREBUILT_ANCIENT_SHELF,q=state.query.toLowerCase();
  $('#ancientTabCount').textContent=\`${'${catalog.length}'} books & letters\`;
  const filters=[['all','All'],['ancient','Ancient writings'],['apostolic','Apostolic Fathers'],['early','Early Church'],['canon','Canon history']];
  $('#booksHubChips').innerHTML=\`<div class="books97AncientFilters">${'${filters.map(([id,label])=>`<button type="button" data-ancient-part="${id}" class="${state.ancientPart===id?\'active\':\'\'}">${label}</button>`).join(\'\')}'}</div>\`;
  const list=catalog.filter(w=>{
    if(state.ancientPart!=='all'&&w.collection!==state.ancientPart)return false;
    if(!q)return true;
    return \`${'${w.title} ${w.meta?.author||\'\'} ${w.meta?.date||\'\'} ${partLabel(w.collection)}'}\`.toLowerCase().includes(q);
  });
  $('#booksHubStatus').innerHTML=\`<b>${'${list.length} ${list.length===1?\'work\':\'works\'}'}</b><span>${'${q?\'Matching titles, authors and dates\':\'Books, letters and primary texts\'}'}</span>\`;
  $('#booksHubContent').innerHTML=list.length?\`<div class="ancientShelf">${'${list.map(w=>`<button type="button" class="ancientTextCard ancientWorkCard" data-ancient-work="${w.id}"><span class="ancientCardTop"><em>${esc(w.meta?.author||\'Unknown author\')} · ${esc(w.meta?.date||\'Date uncertain\')}</em><i>›</i></span><b>${esc(w.title)}</b><small>${esc(partLabel(w.collection))} · ${w.chapterCount>1?`${w.chapterCount} chapters / sections`:\'Complete text\'}</small></button>`).join(\'\')}'}</div>\`:\`<div class="booksEmpty"><b>No Ancient Library results</b><span>${'${q?\'Try another title, author or date.\':\'No texts are available.\'}'}</span></div>\`;
}
`;
const paintAnchor='function paintAncient(m){';
if(!lib.includes(paintAnchor))throw new Error('Release107 paintAncient anchor missing');
lib=lib.replace(paintAnchor,instantHelpers+paintAnchor);
lib=lib.replace(/function paintAncient\(m\)\{\s*if\(!m\)return;/,"function paintAncient(m){\n  if(!m){paintAncientInstant();return;}");

const renderStart='async function renderAncient(){';
const renderEnd='\nfunction paragraphHTML';
const ra=lib.indexOf(renderStart),rb=lib.indexOf(renderEnd,ra+renderStart.length);
if(ra<0||rb<0)throw new Error('Release107 renderAncient range missing');
const instantRender=`async function renderAncient(){
  if(state.manifest){paintAncient(state.manifest);return}
  paintAncientInstant();
}
`;
lib=lib.slice(0,ra)+instantRender+lib.slice(rb);

lib=lib.replace("const LIB_VERSION='106';","const LIB_VERSION='107';");
fs.writeFileSync(p('release94-ancient-library.js'),lib);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='106';"))throw new Error('Release107 expected app runtime v106');
app=app.replace("const V='106';","const V='107';");
fs.writeFileSync(p('app.js'),app);

let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=106','v=107');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){
  const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));
  m.start_url='/?v=107#home';
  fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m));
}

for(const required of ["const LIB_VERSION='107'",'PREBUILT_ANCIENT_SHELF','paintAncientInstant','Matching titles, authors and dates'])if(!lib.includes(required))throw new Error('Release107 Ancient integration missing '+required);
if(/Opening Ancient Library…[\\s\\S]{0,300}Loading Ancient Library/.test(lib))throw new Error('Release107 loading screen survived in Ancient shelf renderer');
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log(`Hobah Release 107: Ancient Library shelf is prebuilt at build time and opens instantly (${shelf.length} works)`);
