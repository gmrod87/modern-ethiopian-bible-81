const fs=require('fs'),path=require('path'),vm=require('vm'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','release97-ancient-library.css','ancient-library.json','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release108 missing '+f);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!lib.includes("const LIB_VERSION='107';"))throw new Error('Release108 expected Ancient Library v107');
if(!lib.includes('PREBUILT_ANCIENT_SHELF'))throw new Error('Release108 expected Release107 prebuilt shelf');
const manifest=JSON.parse(fs.readFileSync(p('ancient-library.json'),'utf8'));

function buildCatalogFromRuntime(runtime,data){
  const close='\n})();',at=runtime.lastIndexOf(close);
  if(at<0)throw new Error('Release108 could not expose catalog builder');
  const exposed=runtime.slice(0,at)+"\nglobalThis.__hobahRelease108BuildCatalog=buildCatalog;"+runtime.slice(at);
  const doc={readyState:'loading',documentElement:{dataset:{}},addEventListener(){},removeEventListener(){},querySelector(){return null},querySelectorAll(){return[]},body:{classList:{add(){},remove(){},toggle(){}}}};
  const context={console,document:doc,location:{hash:'',href:'http://localhost/'},navigator:{userAgent:'release108-build'},performance:{now:()=>0},setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:fn=>{if(typeof fn==='function')fn();return 0},cancelAnimationFrame(){},fetch(){throw new Error('Release108 build-time runtime must not fetch')},getSelection(){return null}};
  context.window=context;context.globalThis=context;
  vm.createContext(context);vm.runInContext(exposed,context,{timeout:20000,filename:'release94-ancient-library.js'});
  const fn=context.__hobahRelease108BuildCatalog;if(typeof fn!=='function')throw new Error('Release108 catalog builder unavailable');
  const catalog=fn(data);if(!Array.isArray(catalog)||!catalog.length)throw new Error('Release108 catalog empty');
  return catalog;
}

const fullCatalog=buildCatalogFromRuntime(lib,manifest);
const workDir=p('ancient-works');fs.rmSync(workDir,{recursive:true,force:true});fs.mkdirSync(workDir,{recursive:true});
for(const w of fullCatalog){
  if(!/^w\d+$/.test(String(w.id||'')))throw new Error('Release108 unsafe work id '+w.id);
  const work={id:String(w.id),title:String(w.title||'Ancient Text'),collection:String(w.collection||'early'),meta:{author:String(w.meta?.author||'Unknown author'),date:String(w.meta?.date||'Date uncertain')},chapters:(Array.isArray(w.chapters)?w.chapters:[]).map((c,i)=>({label:String(c.label||`Chapter ${i+1}`),text:String(c.text||''),chapterNumber:Number.isFinite(c.chapterNumber)?c.chapterNumber:i+1}))};
  fs.writeFileSync(path.join(workDir,work.id+'.json'),JSON.stringify(work));
}
if(fullCatalog.length<100)throw new Error('Release108 work split unexpectedly small');

const helperAnchor='function paintAncientInstant(){';
if(!lib.includes(helperAnchor))throw new Error('Release108 instant shelf anchor missing');
const helpers=`const ANCIENT_WORK_CACHE=new Map();\nconst ANCIENT_WORK_LOADING=new Map();\nfunction ancientShelfMeta(id){return PREBUILT_ANCIENT_SHELF.find(w=>w.id===id)||PREBUILT_ANCIENT_SHELF[0]||null}\nasync function loadAncientWork(id){\n  const meta=ancientShelfMeta(id);if(!meta)throw Error('Ancient Library is empty');id=meta.id;\n  if(ANCIENT_WORK_CACHE.has(id))return ANCIENT_WORK_CACHE.get(id);\n  if(ANCIENT_WORK_LOADING.has(id))return ANCIENT_WORK_LOADING.get(id);\n  const task=fetch('/ancient-works/'+encodeURIComponent(id)+'.json?v='+LIB_VERSION,{cache:'force-cache'}).then(async r=>{if(!r.ok)throw Error('Ancient work unavailable ('+r.status+')');const work=await r.json();if(!work||work.id!==id||!Array.isArray(work.chapters))throw Error('Ancient work is invalid');ANCIENT_WORK_CACHE.set(id,work);ANCIENT_WORK_LOADING.delete(id);return work}).catch(e=>{ANCIENT_WORK_LOADING.delete(id);throw e});\n  ANCIENT_WORK_LOADING.set(id,task);return task;\n}\nfunction warmAncientWork(id){loadAncientWork(id).catch(()=>{})}\n`;
lib=lib.replace(helperAnchor,helpers+helperAnchor);

const oldStart="async function openAncientReader(workId,chapterIndex=0){\n  try{\n    const m=await loadManifest(),catalog=buildCatalog(m),work=findWork(workId)||catalog[0];if(!work)return;chapterIndex=Math.max(0,Math.min(chapterIndex,work.chapters.length-1));const chapter=work.chapters[chapterIndex];\n    closeDrawer();closeSheet();state.fontStep=1;const app=$('#app');if(!app)return;";
const newStart="async function openAncientReader(workId,chapterIndex=0){\n  try{\n    document.activeElement?.blur?.();closeDrawer();closeSheet();state.fontStep=1;\n    const app=$('#app');if(!app)return;\n    const catalog=PREBUILT_ANCIENT_SHELF,work=await loadAncientWork(workId);if(!work)return;chapterIndex=Math.max(0,Math.min(chapterIndex,work.chapters.length-1));const chapter=work.chapters[chapterIndex];";
if(!lib.includes(oldStart))throw new Error('Release108 reader start block not found');
lib=lib.replace(oldStart,newStart);

const contentListener="  $('#booksHubContent',drawer)?.addEventListener('click',e=>{const ancient=e.target.closest('[data-ancient-work]');if(ancient){e.preventDefault();openAncientReader(ancient.dataset.ancientWork,0);return}if(e.target.closest('a[href^=\"#read/\"]'))closeDrawer()});";
if(!lib.includes(contentListener))throw new Error('Release108 Ancient card listener not found');
lib=lib.replace(contentListener,"  $('#booksHubContent',drawer)?.addEventListener('pointerdown',e=>{const ancient=e.target.closest?.('[data-ancient-work]');if(ancient)warmAncientWork(ancient.dataset.ancientWork)},{passive:true});\n"+contentListener);

lib=lib.replace("const LIB_VERSION='107';","const LIB_VERSION='108';");
fs.writeFileSync(p('release94-ancient-library.js'),lib);

const css=`\n/* Hobah Release 108 — reliable Ancient work taps + stable iOS scale */\nhtml,body{-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important;}\n.ancientWorkCard{touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important;cursor:pointer!important;}\n.ancientPageReader{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important;}\n.ancientPageReader *{box-sizing:border-box!important;}\n.ancientReaderTools select,.ancientInlineFind input,#booksHubSearchInput{font-size:16px!important;}\n.ancientReaderTools select{line-height:1.2!important;}\n@supports (-webkit-touch-callout:none){.ancientReaderTools select,.ancientInlineFind input,#booksHubSearchInput{font-size:16px!important;transform:none!important;}.ancientPageReader,.ancientChapterText,.ancientReaderTools{zoom:1!important;transform:none!important;}}\n`;
fs.appendFileSync(p('release97-ancient-library.css'),css);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='107';"))throw new Error('Release108 expected app runtime v107');
app=app.replace("const V='107';","const V='108';");fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=107','v=108');fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=108#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const LIB_VERSION='108'",'ANCIENT_WORK_CACHE','loadAncientWork','warmAncientWork',"fetch('/ancient-works/'",'const catalog=PREBUILT_ANCIENT_SHELF,work=await loadAncientWork'])if(!lib.includes(required))throw new Error('Release108 runtime missing '+required);
if(lib.includes('const m=await loadManifest(),catalog=buildCatalog(m),work=findWork(workId)'))throw new Error('Release108 old full-corpus reader path survived');
for(const required of ['font-size:16px','-webkit-text-size-adjust:100%','overflow-x:hidden'])if(!css.includes(required))throw new Error('Release108 CSS missing '+required);
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log(`Hobah Release 108: ${fullCatalog.length} Ancient works split into direct local files; iOS reader scale locked to normal form-control sizing`);
