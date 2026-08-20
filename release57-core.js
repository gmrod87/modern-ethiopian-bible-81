const {execFileSync}=require('child_process');
const fs=require('fs');
const zlib=require('zlib');
const D='dist',V='57';
const p=f=>`${D}/${f}`;
const read=f=>fs.readFileSync(p(f),'utf8');
const write=(f,s)=>fs.writeFileSync(p(f),s);

if(!fs.existsSync(p('index.html'))||!fs.existsSync(p('app.js'))||!fs.existsSync(p('books.json')))throw new Error('Release57: core build output missing');

// Create one JSON payload per book. Never decode a full testament in the browser.
fs.mkdirSync(p('data'),{recursive:true});
for(const cat of ['ot','eth','nt']){
  const src=p(`${cat}.b64`);
  if(!fs.existsSync(src))continue;
  const decoded=zlib.gunzipSync(Buffer.from(fs.readFileSync(src,'utf8').trim(),'base64')).toString('utf8');
  const corpus=JSON.parse(decoded);
  for(const [slug,book] of Object.entries(corpus))write(`data/${slug}.json`,JSON.stringify(book));
}

// Keep app.js as the single startup controller and make book loading granular.
let app=read('app.js');
app=app.replace("  books=await fetch('/books.json').then(r=>r.json());","  window.MEB_BOOKS_PROMISE=window.MEB_BOOKS_PROMISE||fetch('/books.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Bible index unavailable');return r.json()});\n  books=await window.MEB_BOOKS_PROMISE;window.MEB_BOOKS=books;");
const fetchBookRe=/async function fetchBook\(slug\)\{[\s\S]*?\n\}/;
if(!fetchBookRe.test(app))throw new Error('Release57: fetchBook function not found');
app=app.replace(fetchBookRe,`async function fetchBook(slug){
  if(currentBook?.slug===slug && currentBook.chapters?.[0]?.verses)return currentBook;
  const meta=bookMap.get(slug);if(!meta)throw Error('Unknown book');
  const r=await fetch('/data/'+encodeURIComponent(slug)+'.json',{cache:'no-store'});
  if(!r.ok)throw Error('Book unavailable');
  currentBook=await r.json();return currentBook;
}`);
app=app.replace(/navigator\.serviceWorker\.register\('\/sw\.js'\)/g,"navigator.serviceWorker.register('/sw.js?v=57')");
write('app.js',app);

// Production boot: one stylesheet bundle + one JS controller. No optional modules at startup.
let html=read('index.html');
html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>Hobah</title>');
html=html.replace(/Modern Ethiopian Bible/g,'Hobah').replace(/MODERN ETHIOPIAN BIBLE/g,'HOBAH');
html=html.replace(/Beautified Research Edition/g,'Ethiopian Canon • 81 Books');
html=html.replace(/\s*<script\b[^>]*src=["'][^"']+["'][^>]*><\/script>/gi,m=>/\/app\.js(?:\?|["'])/i.test(m)?`\n  <script type="module" src="/app.js?v=${V}"></script>`:'');
html=html.replace(/\s*<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi,m=>/\/styles\.css(?:\?|["'])/i.test(m)?`\n  <link rel="stylesheet" href="/styles.css?v=${V}" />`:'');
html=html.replace('</head>',`  <link rel="stylesheet" href="/core-v57.css?v=${V}" />\n</head>`);
write('index.html',html);

write('core-v57.css',`/* Hobah Release 57 — minimal stability core */
html{scroll-behavior:auto!important}body{overflow-x:hidden!important}
*,*::before,*::after{animation:none!important;transition:none!important;text-shadow:none!important}
.topbar{position:sticky!important;top:0!important;z-index:1000!important;display:grid!important;grid-template-columns:48px minmax(0,1fr) 48px 48px!important;align-items:center!important;gap:8px!important;min-height:64px!important;padding:8px 14px!important;box-sizing:border-box!important;background:#f5f2eb!important;border-bottom:1px solid rgba(30,45,40,.12)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.topbar>*{position:static!important;inset:auto!important;transform:none!important;pointer-events:auto!important;z-index:auto!important;box-sizing:border-box!important}
.topbar #menuBtn{grid-column:1!important}.topbar #homeBtn{grid-column:2!important;width:100%!important;max-width:none!important;min-width:0!important;height:44px!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0 8px!important;border:0!important;background:transparent!important;text-decoration:none!important}.topbar #savedBtn{grid-column:3!important}.topbar #themeBtn{grid-column:4!important}
.topbar .round{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important}
.searchbar{position:sticky!important;top:64px!important;z-index:900!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.drawer,.drawerHead,.readerTools,.audioBar{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.verse,.section,.drawerBook,.searchResult,.libraryItem{content-visibility:visible!important;contain:none!important}
#audioBar,#listenChapter,#listenVerse{display:none!important}
@media(max-width:600px){.topbar{grid-template-columns:44px minmax(0,1fr) 44px 44px!important;gap:4px!important;padding-left:8px!important;padding-right:8px!important}.brandTitle small{display:none!important}.searchbar{top:64px!important}}
`);

// Disable interception/caching completely while stabilising. Activation removes every old cache.
write('sw.js',`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())await caches.delete(k);await self.clients.claim()})()));\n`);

// Deterministic one-tap cleanup route. LocalStorage is deliberately preserved.
write('recovery.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Repair Hobah</title><style>body{font-family:system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f2eb;color:#17251f}.card{max-width:420px;margin:24px;padding:28px;border:1px solid #d8d3c8;border-radius:22px;background:#fff;text-align:center}a{display:inline-block;padding:12px 18px;border-radius:999px;background:#123c31;color:#fff;text-decoration:none}</style></head><body><main class="card"><h1>Repairing Hobah</h1><p id="s">Removing old app code and cache…</p><a id="go" href="/?fresh=${V}#home" hidden>Open Hobah</a></main><script>(async()=>{try{if('serviceWorker'in navigator){const r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(x=>x.unregister()))}if('caches'in window){const k=await caches.keys();await Promise.all(k.map(x=>caches.delete(x)))}document.getElementById('s').textContent='Done. Opening the clean Bible…';setTimeout(()=>location.replace('/?fresh=${V}#home'),150)}catch(e){document.getElementById('s').textContent='Repair complete. Tap below.';document.getElementById('go').hidden=false}})()</script></body></html>`);

for(const f of ['app.js','sw.js'])execFileSync(process.execPath,['--check',p(f)],{stdio:'inherit'});
if(/feature-loader|natural-audio|read-aloud|study-hub|research-suite|ambient-audio|chronology\.js/i.test(read('index.html')))throw new Error('Release57: optional runtime leaked into critical path');
console.log('Hobah Release 57 minimal stable core applied');
