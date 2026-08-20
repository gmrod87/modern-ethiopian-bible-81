const {execFileSync}=require('child_process');
const fs=require('fs');
const zlib=require('zlib');
const D='dist',V='57';
const p=f=>`${D}/${f}`;

fs.rmSync(D,{recursive:true,force:true});
fs.mkdirSync(D,{recursive:true});
execFileSync('tar',['--no-same-owner','-xzf','native-bible-app.tar.gz','-C',D],{stdio:'inherit'});

for(const f of ['index.html','app.js','styles.css','books.json','ot.b64','eth.b64','nt.b64']){
  if(!fs.existsSync(p(f)))throw new Error(`Core source missing: ${f}`);
}
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
const fetchBookRe=/async function fetchBook\(slug\)\{[\s\S]*?\n\}/;
if(!fetchBookRe.test(app))throw new Error('Core fetchBook function not found');
app=app.replace(fetchBookRe,`async function fetchBook(slug){
  if(currentBook?.slug===slug && currentBook.chapters?.[0]?.verses)return currentBook;
  if(!bookMap.get(slug))throw Error('Unknown book');
  const r=await fetch('/data/'+encodeURIComponent(slug)+'.json',{cache:'no-store'});
  if(!r.ok)throw Error('Book unavailable');
  currentBook=await r.json();return currentBook;
}`);
app=app.replace(/navigator\.serviceWorker\.register\('\/sw\.js'\)/g,"navigator.serviceWorker.register('/sw.js?v=57')");
write('app.js',app);

let html=read('index.html');
html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>Hobah</title>');
html=html.replace(/Modern Ethiopian Bible/g,'Hobah').replace(/MODERN ETHIOPIAN BIBLE/g,'HOBAH').replace(/Beautified Research Edition/g,'Ethiopian Canon • 81 Books');
html=html.replace(/<a class="brand" href="#home">/,'<a class="brand" id="homeBtn" href="#home" aria-label="Home">');
html=html.replace(/\s*<script\b[^>]*src=["'][^"']+["'][^>]*><\/script>/gi,m=>/\/app\.js(?:\?|["'])/i.test(m)?`\n  <script type="module" src="/app.js?v=${V}"></script>`:'');
html=html.replace(/\s*<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi,m=>/\/styles\.css(?:\?|["'])/i.test(m)?`\n  <link rel="stylesheet" href="/styles.css?v=${V}" />`:'');
html=html.replace('</head>',`  <link rel="stylesheet" href="/core-v57.css?v=${V}" />\n</head>`);
write('index.html',html);

write('core-v57.css',`/* Hobah 57: stable native reader only */
html{scroll-behavior:auto!important}body{overflow-x:hidden!important}
*,*::before,*::after{animation:none!important;transition:none!important;text-shadow:none!important}
.topbar{position:sticky!important;top:0!important;z-index:1000!important;display:grid!important;grid-template-columns:48px minmax(0,1fr) 48px 48px!important;align-items:center!important;gap:8px!important;min-height:64px!important;padding:8px 14px!important;box-sizing:border-box!important;background:#f5f2eb!important;border-bottom:1px solid rgba(30,45,40,.12)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.topbar>*{position:static!important;inset:auto!important;transform:none!important;pointer-events:auto!important;z-index:auto!important;box-sizing:border-box!important}
.topbar #menuBtn{grid-column:1!important}.topbar #homeBtn{grid-column:2!important;width:100%!important;max-width:none!important;min-width:0!important;height:44px!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0 8px!important;border:0!important;background:transparent!important;text-decoration:none!important}.topbar #savedBtn{grid-column:3!important}.topbar #themeBtn{grid-column:4!important}
.topbar .round{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important}
.searchbar{position:sticky!important;top:64px!important;z-index:900!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.drawer,.drawerHead,.readerTools,.audioBar{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.verse,.section,.drawerBook,.searchResult,.libraryItem{content-visibility:visible!important;contain:none!important}
@media(max-width:600px){.topbar{grid-template-columns:44px minmax(0,1fr) 44px 44px!important;gap:4px!important;padding-left:8px!important;padding-right:8px!important}.brand small{display:none!important}.searchbar{top:64px!important}}
`);

// While stabilising, the service worker performs no fetch interception at all.
write('sw.js',`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())await caches.delete(k);await self.clients.claim()})()));\n`);

// One-tap removal of any old service worker. Saved verses/notes in localStorage remain untouched.
write('recovery.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Repair Hobah</title><style>body{font-family:system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f2eb;color:#17251f}.card{max-width:420px;margin:24px;padding:28px;border:1px solid #d8d3c8;border-radius:22px;background:#fff;text-align:center}a{display:inline-block;padding:12px 18px;border-radius:999px;background:#123c31;color:#fff;text-decoration:none}</style></head><body><main class="card"><h1>Repairing Hobah</h1><p id="s">Removing old app code and cache…</p><a id="go" href="/?fresh=${V}#home" hidden>Open Hobah</a></main><script>(async()=>{try{if('serviceWorker'in navigator){const r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(x=>x.unregister()))}if('caches'in window){const k=await caches.keys();await Promise.all(k.map(x=>caches.delete(x)))}document.getElementById('s').textContent='Done. Opening the clean Bible…';setTimeout(()=>location.replace('/?fresh=${V}#home'),120)}catch(e){document.getElementById('s').textContent='Tap below to open Hobah.';document.getElementById('go').hidden=false}})()</script></body></html>`);

if(fs.existsSync(p('manifest.webmanifest'))){try{const m=JSON.parse(read('manifest.webmanifest'));m.name='Hobah';m.short_name='Hobah';m.theme_color='#f5f2eb';m.background_color='#f5f2eb';write('manifest.webmanifest',JSON.stringify(m))}catch{}}

execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('sw.js')],{stdio:'inherit'});
const finalHtml=read('index.html');
const scripts=[...finalHtml.matchAll(/<script\b[^>]*src=["']([^"']+)/gi)].map(x=>x[1]);
if(scripts.length!==1||!scripts[0].startsWith('/app.js'))throw new Error('Core boot must contain exactly one external script');
console.log('Hobah Release 57 standalone core built');
