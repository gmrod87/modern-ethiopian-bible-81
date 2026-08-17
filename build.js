const {execFileSync}=require('child_process');
const fs=require('fs');
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
execFileSync('tar',['-xzf','native-bible-app.tar.gz','-C','dist'],{stdio:'inherit'});

const release='7';
fs.copyFileSync('study-v2.js','dist/study.js');
fs.copyFileSync('study.css','dist/study.css');
const dataFiles=fs.readdirSync('.').filter(x=>/^study-data-\d+\.js$/.test(x)).sort();
for(const f of dataFiles) fs.copyFileSync(f,`dist/${f}`);

// The native reader renders verses directly from its bundled OT/Ethiopian/NT corpora.
// Build the study UI from those already-rendered verses rather than a second book-data API.
let study=fs.readFileSync('dist/study.js','utf8');
const missingFetch="      const b=await fetch(`/data/${slug}.json`).then(r=>r.json()),chapter=b.chapters.find(x=>x.n===c)||b.chapters[0],sec=sectionFor(a,c);";
const nativeSource="      const sec=sectionFor(a,c),verseMap=new Map([...article.querySelectorAll('.verse')].map(p=>{const q=p.cloneNode(true);q.querySelector('.vnum')?.remove();const v=+p.dataset.v;return [v,{v,t:q.textContent.trim()}]}));";
if(!study.includes(missingFetch)) throw new Error('Study patch target not found');
study=study.replace(missingFetch,nativeSource);
study=study.replaceAll('chapter.verses.find(x=>x.v===v)','verseMap.get(v)');
study=study.replace(
  "      const head=article.previousElementSibling;",
  "      const head=article.previousElementSibling;\n      if(!document.querySelector('.studyAvailable'))article.insertAdjacentHTML('beforebegin',`<div class=\"studyAvailable\"><span>✦</span><div><b>Study notes available</b><small>Historical context is on this chapter. Tap <strong>✦ Study</strong> beneath any verse.</small></div></div>`);"
);
fs.writeFileSync('dist/study.js',study);
fs.appendFileSync('dist/study.css',`\n.studyAvailable{display:flex;gap:12px;align-items:center;margin:14px 0 18px;padding:13px 14px;border:1px solid rgba(137,94,29,.42);border-radius:14px;background:rgba(175,124,46,.13)}.studyAvailable>span{font-size:24px;color:#9a681f}.studyAvailable div{display:flex;flex-direction:column;gap:3px}.studyAvailable b{font-size:15px}.studyAvailable small{font-size:12px;line-height:1.4;opacity:.78}.studyAvailable strong{color:#8c5c19}.studyToggle{display:flex!important;width:max-content!important;border:1px solid rgba(154,104,31,.36)!important;background:rgba(175,124,46,.12)!important;border-radius:999px!important;padding:6px 11px!important;margin:3px 0 10px!important;font-size:11px!important;font-weight:800!important}\n`);

let html=fs.readFileSync('dist/index.html','utf8');
// Query versions force an older installed service worker to fetch the current study files immediately.
if(!html.includes('/study.css')) html=html.replace('</head>',`  <link rel="stylesheet" href="/study.css?v=${release}" />\n</head>`);
if(!html.includes('/study.js')){
  const scripts=dataFiles.map(f=>`  <script src="/${f}?v=${release}"></script>`).join('\n')+`\n  <script src="/study.js?v=${release}"></script>\n`;
  html=html.replace('</body>',scripts+'</body>');
}
fs.writeFileSync('dist/index.html',html);

const swPath='dist/sw.js';
if(fs.existsSync(swPath)){
  let sw=fs.readFileSync(swPath,'utf8');
  sw=sw.replace(/const V=['\"][^'\"]+['\"]/,"const V='meb-native-v7-study-visible'");
  const add=['/study.js','/study.css',...dataFiles.map(f=>'/'+f)];
  sw=sw.replace("'/manifest.webmanifest'",`'/manifest.webmanifest',${add.map(x=>`'${x}'`).join(',')}`);
  fs.writeFileSync(swPath,sw);
}
console.log(`Native 81-book Bible app + visible study UI release ${release} built (${dataFiles.length} study data parts)`);
