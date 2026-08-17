const {execFileSync}=require('child_process');
const fs=require('fs');
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
execFileSync('tar',['--no-same-owner','-xzf','native-bible-app.tar.gz','-C','dist'],{stdio:'inherit'});

const release='17';
for(const f of ['study-v2.js','study.css','curated-notes.js','natural-audio.js','study-hub.js','study-hub.css']) fs.copyFileSync(f,'dist/'+(f==='study-v2.js'?'study.js':f));
const dataFiles=fs.readdirSync('.').filter(x=>/^study-data-\d+\.js$/.test(x)).sort();
for(const f of dataFiles) fs.copyFileSync(f,`dist/${f}`);

let study=fs.readFileSync('dist/study.js','utf8');
const missingFetch="      const b=await fetch(`/data/${slug}.json`).then(r=>r.json()),chapter=b.chapters.find(x=>x.n===c)||b.chapters[0],sec=sectionFor(a,c);";
const nativeSource="      const sec=sectionFor(a,c),verseMap=new Map([...article.querySelectorAll('.verse')].map(p=>{const q=p.cloneNode(true);q.querySelector('.vnum')?.remove();const v=+p.dataset.v;return [v,{v,t:q.textContent.trim()}]}));";
if(!study.includes(missingFetch)) throw new Error('Study patch target not found');
study=study.replace(missingFetch,nativeSource);
study=study.replaceAll('chapter.verses.find(x=>x.v===v)','verseMap.get(v)');

const marker='  async function enhance()';
const selective=[
"  const curated=(meta,c,v)=>window.MEB_CURATED_NOTES?.[meta.slug+':'+c+':'+v]||'';",
"  function worthStudy(meta,a,sec,c,v,text){ return !!curated(meta,c,v); }",
"  function substantialPanel(meta,a,sec,c,v,text){",
"    const ref=studyRef(meta.title,c,v),is=saved(ref),special=curated(meta,c,v);",
"    if(!special) return '';",
"    return '<div class=\"studyVerseInner\"><div class=\"studyTop\"><span>CURATED STUDY NOTE</span><b>'+esc(meta.title)+' '+c+':'+v+'</b></div><div class=\"studyBlock\"><p>'+esc(special)+'</p></div><button class=\"studySave verseStudySave\" data-ref=\"'+esc(ref)+'\" data-v=\"'+v+'\">'+(is?'♥ Saved study note':'♡ Save study note')+'</button><p class=\"studyDisclaimer\">Editorial study note — not part of the biblical text.</p></div>';",
"  }"
].join('\n');
if(!study.includes(marker)) throw new Error('Enhance marker not found');
study=study.replace(marker,selective+'\n'+marker);
study=study.replace('box.innerHTML=versePanel(meta,a,sec,c,v,verse.t);','box.innerHTML=substantialPanel(meta,a,sec,c,v,verse.t);');
study=study.replace("      const head=article.previousElementSibling;","      const head=article.previousElementSibling;\n      const eligibleCount=[...article.querySelectorAll('.verse')].filter(p=>{const v=+p.dataset.v,verse=verseMap.get(v);return verse&&worthStudy(meta,a,sec,c,v,verse.t)}).length;\n      if(eligibleCount&&!document.querySelector('.studyAvailable'))article.insertAdjacentHTML('beforebegin','<div class=\"studyAvailable\"><span>✦</span><div><b>Curated study notes</b><small>Only selected verses with substantial historical, textual, linguistic, or interpretive value are annotated.</small></div></div>');");
study=study.replace("      $$('.verse').forEach(p=>{if(p.dataset.studyAttached)return;p.dataset.studyAttached='1';const v=+p.dataset.v,verse=verseMap.get(v);if(!verse)return;", "      $$('.verse').forEach(p=>{if(p.dataset.studyAttached)return;p.dataset.studyAttached='1';const v=+p.dataset.v,verse=verseMap.get(v);if(!verse||!worthStudy(meta,a,sec,c,v,verse.t))return;");
fs.writeFileSync('dist/study.js',study);

fs.appendFileSync('dist/study.css','\n.studyAvailable{display:flex;gap:12px;align-items:center;margin:14px 0 18px;padding:13px 14px;border:1px solid rgba(137,94,29,.42);border-radius:14px;background:rgba(175,124,46,.10)}.studyAvailable>span{font-size:24px;color:#9a681f}.studyAvailable div{display:flex;flex-direction:column;gap:3px}.studyAvailable b{font-size:15px}.studyAvailable small{font-size:12px;line-height:1.45;opacity:.78}.studyToggle{display:flex!important;width:max-content!important;border:1px solid rgba(154,104,31,.36)!important;background:rgba(175,124,46,.10)!important;border-radius:999px!important;padding:6px 11px!important;margin:3px 0 10px!important;font-size:11px!important;font-weight:800!important}.studyVerseInner .studyBlock p{font-size:14px;line-height:1.72;margin:0}.studyVerseInner{padding:18px!important}\n');

// Mobile/PWA header fix. Some iPhone browser/PWA combinations report a zero
// safe-area inset even though the status area still overlaps the page. Keep a
// real minimum top buffer so the controls can never sit against the screen edge.
fs.appendFileSync('dist/styles.css',`\n@media(max-width:900px){
  :root{
    --meb-top-gap:max(24px, env(safe-area-inset-top, 0px));
    --meb-safe-left:env(safe-area-inset-left, 0px);
    --meb-safe-right:env(safe-area-inset-right, 0px);
    --meb-header-height:calc(58px + var(--meb-top-gap));
  }
  .topbar{
    position:sticky!important;
    top:0!important;
    height:var(--meb-header-height)!important;
    min-height:var(--meb-header-height)!important;
    padding-top:var(--meb-top-gap)!important;
    padding-bottom:8px!important;
    padding-left:max(14px,var(--meb-safe-left))!important;
    padding-right:max(14px,var(--meb-safe-right))!important;
    align-items:center!important;
  }
  .topbar .round{
    width:44px!important;height:44px!important;
    min-width:44px!important;min-height:44px!important;
    flex:0 0 44px!important;
    display:grid!important;place-items:center!important;
    padding:0!important;line-height:1!important;
    touch-action:manipulation!important;
    -webkit-tap-highlight-color:transparent;
  }
  .topbar .brand{
    min-width:0!important;
    min-height:44px!important;
    height:44px!important;
    overflow:hidden!important;
    padding:0 4px!important;
    touch-action:manipulation!important;
  }
  .topbar .brand>span:last-child{display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important}
  .topbar .brand b{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  .searchbar{
    top:var(--meb-header-height)!important;
    padding-left:max(14px,var(--meb-safe-left))!important;
    padding-right:max(14px,var(--meb-safe-right))!important;
  }
  .readerTools{top:calc(var(--meb-header-height) + 51px)!important}
  .drawer{padding-top:calc(var(--meb-top-gap) + 14px)!important}
  .drawerHead{top:calc(-1 * (var(--meb-top-gap) + 14px))!important;padding-top:calc(var(--meb-top-gap) + 14px)!important}
}
@media(max-width:480px){
  .topbar{gap:6px!important}
  .topbar .brand b{font-size:clamp(11px,3.25vw,14px)!important;line-height:1.05!important;letter-spacing:-.02em!important}
  .topbar .brandCross{font-size:23px!important}
}\n`);

let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/href=["']\/styles\.css(?:\?v=[^"']*)?["']/,`href="/styles.css?v=${release}"`);
if(!html.includes('/study.css')) html=html.replace('</head>','  <link rel="stylesheet" href="/study.css?v='+release+'" />\n  <link rel="stylesheet" href="/study-hub.css?v='+release+'" />\n</head>');
else if(!html.includes('/study-hub.css')) html=html.replace('</head>','  <link rel="stylesheet" href="/study-hub.css?v='+release+'" />\n</head>');
if(!html.includes('/study.js')){
  const scripts=dataFiles.map(f=>'  <script src="/'+f+'?v='+release+'"></script>').join('\n')+'\n  <script src="/curated-notes.js?v='+release+'"></script>\n  <script src="/study.js?v='+release+'"></script>\n  <script src="/natural-audio.js?v='+release+'"></script>\n  <script src="/study-hub.js?v='+release+'"></script>\n';
  html=html.replace('</body>',scripts+'</body>');
}else if(!html.includes('/study-hub.js')) html=html.replace('</body>','  <script src="/study-hub.js?v='+release+'"></script>\n</body>');
fs.writeFileSync('dist/index.html',html);

const swPath='dist/sw.js';
if(fs.existsSync(swPath)){
  let sw=fs.readFileSync(swPath,'utf8');
  sw=sw.replace(/const V=['\"][^'\"]+['\"]/,"const V='meb-native-v17-mobile-header-lower'");
  const add=['/study.js','/study.css','/curated-notes.js','/natural-audio.js','/study-hub.js','/study-hub.css',...dataFiles.map(f=>'/'+f)];
  sw=sw.replace("'/manifest.webmanifest'",`'/manifest.webmanifest',${add.map(x=>`'${x}'`).join(',')}`);
  fs.writeFileSync(swPath,sw);
}
console.log('Native Bible Study Library + Study AI release '+release+' built');
