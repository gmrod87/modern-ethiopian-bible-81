const {execFileSync}=require('child_process');
const fs=require('fs');
const zlib=require('zlib');
const D='dist',V='58';
const p=f=>`${D}/${f}`;

fs.rmSync(D,{recursive:true,force:true});
fs.mkdirSync(D,{recursive:true});
execFileSync('tar',['--no-same-owner','-xzf','native-bible-app.tar.gz','-C',D],{stdio:'inherit'});

for(const f of ['index.html','app.js','styles.css','books.json','ot.b64','eth.b64','nt.b64']){
  if(!fs.existsSync(p(f)))throw new Error(`Core source missing: ${f}`);
}
if(!fs.existsSync('release54-unified-ui.css'))throw new Error('Hobah unified UI source missing');
if(!fs.existsSync('hobah-mark.svg'))throw new Error('Hobah mark source missing');
const read=f=>fs.readFileSync(p(f),'utf8');
const write=(f,s)=>fs.writeFileSync(p(f),s);

// Split the three compressed corpora into one small payload per book.
fs.mkdirSync(p('data'),{recursive:true});
for(const cat of ['ot','eth','nt']){
  const raw=Buffer.from(read(`${cat}.b64`).trim(),'base64');
  const corpus=JSON.parse(zlib.gunzipSync(raw).toString('utf8'));
  for(const [slug,book] of Object.entries(corpus))write(`data/${slug}.json`,JSON.stringify(book));
}

// Patch only the native reader. No enhancement modules or mutation-observer layers.
let app=read('app.js');
const menuBinding="$('#menuBtn').onclick=()=>openDrawer('all');";
if(app.includes(menuBinding)&&!app.includes("const homeBtn=$('#homeBtn')")){
  app=app.replace(menuBinding,menuBinding+"const homeBtn=$('#homeBtn');if(homeBtn)homeBtn.onclick=e=>{e.preventDefault();closeDrawer();if(location.hash==='#home')renderHome();else location.hash='#home'};");
}
app=app.replace("  books=await fetch('/books.json').then(r=>r.json());","  window.MEB_BOOKS_PROMISE=window.MEB_BOOKS_PROMISE||fetch('/books.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Bible index unavailable');return r.json()});\n  books=await window.MEB_BOOKS_PROMISE;window.MEB_BOOKS=books;");
app=app.replace('renderDrawer(); updateSavedBadge(); populateVoices();','renderDrawer(); updateSavedBadge();');
const fetchBookRe=/async function fetchBook\(slug\)\{[\s\S]*?\n\}/;
if(!fetchBookRe.test(app))throw new Error('Core fetchBook function not found');
app=app.replace(fetchBookRe,`async function fetchBook(slug){
  if(currentBook?.slug===slug && currentBook.chapters?.[0]?.verses)return currentBook;
  if(!bookMap.get(slug))throw Error('Unknown book');
  const r=await fetch('/data/'+encodeURIComponent(slug)+'.json',{cache:'no-store'});
  if(!r.ok)throw Error('Book unavailable');
  currentBook=await r.json();return currentBook;
}`);
// Restore the newer Hobah home identity directly in the core renderer — no observer needed.
app=app.replace('<h1>Modern<br><em>Ethiopian</em> Bible</h1>','<h1 class="ancientCanonTitle"><span class="ancientLine1">The</span><span class="ancientLine2">Ancient</span><span class="ancientLine3">Canon</span></h1>');
app=app.replace('Your complete Bible now lives inside the app as native searchable text. No PDF chooser, no page-by-page parsing, no waiting for a 1,928-page document to open.','Read, search and listen across the complete 81-book Ethiopian canon in one fast, native Bible experience.');
app=app.replace('Native text edition • instant book & chapter opening','81 books • native text • instant chapter opening');
app=app.replace(/navigator\.serviceWorker\.register\('\/sw\.js(?:\?v=\d+)?'\)/g,`navigator.serviceWorker.register('/sw.js?v=${V}')`);
// Populate browser voices only when Read Aloud is actually used.
app=app.replace("function startAudio(vs,start,book,chapter){if(!('speechSynthesis'in window)||!vs.length)return toast('Read aloud is not supported here');","function startAudio(vs,start,book,chapter){if(!('speechSynthesis'in window)||!vs.length)return toast('Read aloud is not supported here');if(!$('#voiceSelect').options.length)populateVoices();");
write('app.js',app);

// Restore the current Hobah visual language as CSS only.
fs.copyFileSync('hobah-mark.svg',p('hobah-mark.svg'));
const baseCss=read('styles.css');
const unifiedCss=fs.readFileSync('release54-unified-ui.css','utf8');
write('hobah-core-ui.css',`/* Hobah Release ${V}: stable core + unified Hobah visual system */\n${baseCss}\n\n${unifiedCss}\n\n/* Stable-core compatibility */\n#themeBtn{display:none!important}\n.hero .ornament{display:none!important}\n.topbar #homeBtn .brandCross{font-size:0!important}\n.topbar #homeBtn .brandCross .hobahHeaderMark{display:block!important;width:44px!important;height:44px!important;object-fit:contain!important}\n@media(max-width:600px){.app{padding-left:12px!important;padding-right:12px!important}.hero{padding:26px 22px!important}.hero h1.ancientCanonTitle{font-size:clamp(48px,17vw,76px)!important}}\n`);

let html=read('index.html');
html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>Hobah — The Ancient Canon</title>');
html=html.replace(/Modern Ethiopian Bible/g,'Hobah').replace(/MODERN ETHIOPIAN BIBLE/g,'HOBAH').replace(/Beautified Research Edition/g,'Ethiopian Canon • 81 Books');
html=html.replace(/<meta name="theme-color" content="[^"]*"\s*\/>/i,'<meta name="theme-color" content="#F5F2EB" />');
html=html.replace(/placeholder="Search all 81 books…"/g,'placeholder="Search…"');
html=html.replace(/<a class="brand" href="#home">[\s\S]*?<\/a>/,`<a class="brand" id="homeBtn" href="#home" aria-label="Home"><span class="brandCross"><img class="hobahHeaderMark" src="/hobah-mark.svg?v=${V}" alt="Hobah" width="44" height="44" /></span><span class="brandTitle"><b>Hobah</b><small>The Ancient Canon • 81 Books</small></span></a>`);
if(!html.includes('id="homeBtn"'))html=html.replace(/<a class="brand" href="#home">/,'<a class="brand" id="homeBtn" href="#home" aria-label="Home">');
html=html.replace(/\s*<script\b[^>]*src=["'][^"']+["'][^>]*><\/script>/gi,m=>/\/app\.js(?:\?|["'])/i.test(m)?`\n  <script type="module" src="/app.js?v=${V}"></script>`:'');
html=html.replace(/\s*<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi,'');
html=html.replace('</head>',`  <link rel="stylesheet" href="/hobah-core-ui.css?v=${V}" />\n</head>`);
write('index.html',html);

// No fetch interception while stability is being proven. Activation only purges stale caches.
write('sw.js',`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())await caches.delete(k);await self.clients.claim()})()));\n`);

// One-tap removal of any old service worker. Saved verses/notes in localStorage remain untouched.
write('recovery.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Refresh Hobah</title><style>body{font-family:system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f2eb;color:#142e28}.card{max-width:420px;margin:24px;padding:30px;border:1px solid #d9d2c7;border-radius:24px;background:#fffdf8;text-align:center}h1{font-family:Georgia,serif}a{display:inline-block;padding:12px 18px;border-radius:999px;background:#1b5146;color:#fff;text-decoration:none}</style></head><body><main class="card"><h1>Refreshing Hobah</h1><p id="s">Removing the old app version…</p><a id="go" href="/?fresh=${V}#home" hidden>Open Hobah</a></main><script>(async()=>{try{if('serviceWorker'in navigator){const r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(x=>x.unregister()))}if('caches'in window){const k=await caches.keys();await Promise.all(k.map(x=>caches.delete(x)))}document.getElementById('s').textContent='Done. Opening The Ancient Canon…';setTimeout(()=>location.replace('/?fresh=${V}#home'),120)}catch(e){document.getElementById('s').textContent='Tap below to open Hobah.';document.getElementById('go').hidden=false}})()</script></body></html>`);

if(fs.existsSync(p('manifest.webmanifest'))){try{const m=JSON.parse(read('manifest.webmanifest'));m.name='Hobah — The Ancient Canon';m.short_name='Hobah';m.theme_color='#F5F2EB';m.background_color='#EEEAE1';write('manifest.webmanifest',JSON.stringify(m))}catch{}}

execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('sw.js')],{stdio:'inherit'});
const finalHtml=read('index.html');
const scripts=[...finalHtml.matchAll(/<script\b[^>]*src=["']([^"']+)/gi)].map(x=>x[1]);
if(scripts.length!==1||!scripts[0].startsWith('/app.js'))throw new Error('Core boot must contain exactly one external script');
if(!finalHtml.includes('/hobah-core-ui.css'))throw new Error('Unified Hobah CSS missing from production HTML');
console.log(`Hobah Release ${V} stable core + restored visual system built`);
