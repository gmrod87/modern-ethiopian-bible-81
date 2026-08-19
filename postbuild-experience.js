const {execFileSync}=require('child_process');
const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const release='33';

const copy=(f,out=f)=>{if(fs.existsSync(f))fs.copyFileSync(f,path.join('dist',out))};
for(const f of ['experience.js','experience.css','ambient-audio.js','the81-theme.css'])copy(f);
const inflateAsset=(src,out)=>{if(fs.existsSync(src))fs.writeFileSync(path.join('dist',out),zlib.gunzipSync(Buffer.from(fs.readFileSync(src,'utf8').trim(),'base64')))};
inflateAsset('the81-fast.js.gz.b64','the81-fast.js');
inflateAsset('the81-fast.css.gz.b64','the81-fast.css');
inflateAsset('feature-loader.js.gz.b64','feature-loader.js');

// Build individual book payloads once on the server. Reading a chapter should never decode an entire testament on the phone.
fs.mkdirSync('dist/data',{recursive:true});
for(const cat of ['ot','eth','nt']){
  const p=`dist/${cat}.b64`;
  if(!fs.existsSync(p))continue;
  const decoded=zlib.gunzipSync(Buffer.from(fs.readFileSync(p,'utf8').trim(),'base64')).toString('utf8');
  const corpus=JSON.parse(decoded);
  for(const [slug,book] of Object.entries(corpus))fs.writeFileSync(`dist/data/${slug}.json`,JSON.stringify(book));
}

// Keep Ambient Music safe from the old observer feedback loop.
if(fs.existsSync('dist/ambient-audio.js')){
  const p='dist/ambient-audio.js';let s=fs.readFileSync(p,'utf8');
  s=s.replace(/  function ensureControl\(\)\{[\s\S]*?\n  \}\n  function init\(\)\{/,
`  function ensureControl(){
    const modes=$('#audioModes'),ctr=$('.audioControls');
    let b=$('#audioAmbient');
    if(!b){if(!modes&&!ctr)return;b=document.createElement('button');b.id='audioAmbient';b.className='audioExtra audioAmbient';b.type='button'}
    b.onclick=toggleAmbient;
    if(modes){let row=$('#audioAmbientSetting');if(!row){row=document.createElement('div');row.id='audioAmbientSetting';row.className='audioAmbientSetting';row.innerHTML='<div class="audioAmbientCopy"><span>AMBIENT MUSIC</span><small>Quiet adaptive music behind Read Aloud</small></div>';modes.appendChild(row)}if(b.parentElement!==row)row.appendChild(b)}
    else if(ctr&&b.parentElement!==ctr){const sleep=$('#audioSleep'),close=$('#audioClose');ctr.insertBefore(b,sleep||close)}
    updateButton();
  }
  function init(){`);
  s=s.replace("    ensureControl();new MutationObserver(ensureControl).observe(document.body,{childList:true,subtree:true});","    ensureControl();let ambientObserver=null;if(!$('#audioModes')){ambientObserver=new MutationObserver(()=>{if($('#audioModes')){ambientObserver.disconnect();ambientObserver=null;ensureControl()}});ambientObserver.observe(document.body,{childList:true,subtree:true})}");
  fs.writeFileSync(p,s);
}

// Core speed patch: share books metadata and fetch only the requested book for reading.
{
  const p='dist/app.js';let s=fs.readFileSync(p,'utf8');
  s=s.replace("  books=await fetch('/books.json').then(r=>r.json());","  window.MEB_BOOKS_PROMISE=window.MEB_BOOKS_PROMISE||fetch('/books.json').then(r=>r.json());\n  books=await window.MEB_BOOKS_PROMISE;window.MEB_BOOKS=books;");
  s=s.replace(/async function fetchBook\(slug\)\{[\s\S]*?\n\}/,
`async function fetchBook(slug){
  if(currentBook?.slug===slug && currentBook.chapters?.[0]?.verses)return currentBook;
  const m=bookMap.get(slug);if(!m)throw Error('Unknown book');
  const b=await fetch('/data/'+encodeURIComponent(slug)+'.json').then(r=>{if(!r.ok)throw Error('Book unavailable');return r.json()});
  currentBook=b;return b;
}`);
  fs.writeFileSync(p,s);
}

// Avoid repeated books.json requests in deferred feature modules.
for(const file of ['natural-audio.js','study.js','study-hub.js','chronology.js']){
  const p=`dist/${file}`;if(!fs.existsSync(p))continue;let s=fs.readFileSync(p,'utf8');
  s=s.replace(/books=await fetch\('\/books\.json'\)\.then\(r=>r\.json\(\)\)/g,"books=window.MEB_BOOKS||await(window.MEB_BOOKS_PROMISE||fetch('/books.json').then(r=>r.json()))");
  s=s.replace(/\[annotations,books\]=await Promise\.all\(\[fetch\('\/annotations\.json'\)\.then\(r=>r\.json\(\)\),fetch\('\/books\.json'\)\.then\(r=>r\.json\(\)\)\]\)/g,"[annotations,books]=await Promise.all([fetch('/annotations.json').then(r=>r.json()),window.MEB_BOOKS||window.MEB_BOOKS_PROMISE||fetch('/books.json').then(r=>r.json())])");
  fs.writeFileSync(p,s);
}

let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/\?v=\d+/g,`?v=${release}`);
html=html.replace(/<meta name="theme-color" content="[^"]*"\s*\/>/,'<meta name="theme-color" content="#9fb6b5" />');
html=html.replace(/<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/>/,'<meta name="apple-mobile-web-app-title" content="The 81" />');
html=html.replace(/<meta name="description" content="[^"]*"\s*\/>/,'<meta name="description" content="The 81 — read, listen, search and study the complete 81-book Ethiopian Bible edition." />');
html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>The 81</title>');
html=html.replace(/src=["']\/app\.js(?:\?v=\d+)?["']/,`src="/app.js?v=${release}"`);

// Strip expensive enhancement scripts from the critical path. feature-loader.js brings them in during idle time.
const heavy=[...Array.from({length:10},(_,i)=>`study-data-${String(i).padStart(2,'0')}.js`),'curated-notes.js','study.js','study-hub.js','research-data.js','research-texts.js','research-suite.js','chronology.js','experience.js','ambient-audio.js','the81-theme.js'];
for(const name of heavy){const re=new RegExp(`\\s*<script[^>]+src=["']/${name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(?:\\?v=[^"']*)?["'][^>]*><\\/script>`,'g');html=html.replace(re,'')}

if(!html.includes('/experience.css'))html=html.replace('</head>',`  <link rel="stylesheet" href="/experience.css?v=${release}" />\n</head>`);
if(fs.existsSync('dist/the81-theme.css')&&!html.includes('/the81-theme.css'))html=html.replace('</head>',`  <link rel="stylesheet" href="/the81-theme.css?v=${release}" />\n</head>`);
if(!html.includes('/the81-fast.css'))html=html.replace('</head>',`  <link rel="stylesheet" href="/the81-fast.css?v=${release}" />\n</head>`);

// Keep natural voice available immediately; defer everything else.
if(!html.includes('/natural-audio.js'))html=html.replace('</body>',`  <script src="/natural-audio.js?v=${release}"></script>\n</body>`);
html=html.replace('</body>',`  <script src="/the81-fast.js?v=${release}"></script>\n  <script src="/feature-loader.js?v=${release}"></script>\n</body>`);

html=html.replace(/MODERN ETHIOPIAN BIBLE/g,'THE 81').replace(/Modern Ethiopian Bible/g,'The 81').replace(/Beautified Research Edition/g,'The Complete 81 Books');
html=html.replace(/<main id="app" class="app">[\s\S]*?<\/main>/,`<main id="app" class="app"><section class="hero the81Hero" id="bootFallback"><span class="eyebrow">THE COMPLETE 81 BOOKS</span><h1><span class="theWord">The</span><span class="theNumber">81</span></h1><p>The Word. The Story. The Way.</p><div class="heroActions"><a class="primary" href="/recovery.html?v=${release}">Repair app</a></div></section></main>`);
fs.writeFileSync('dist/index.html',html);

// Rename the installed PWA too, and remove the old red browser chrome.
const manifestPath='dist/manifest.webmanifest';
if(fs.existsSync(manifestPath)){
  try{const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));m.name='The 81';m.short_name='The 81';m.theme_color='#9fb6b5';m.background_color='#809fa4';fs.writeFileSync(manifestPath,JSON.stringify(m))}catch{}
}

// Recovery stays network-first and does not touch user notes/localStorage.
fs.writeFileSync('dist/recovery.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#9fb6b5"><title>Refreshing The 81</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(145deg,#78979d,#c6d1c8 55%,#d6b58c);color:#15242a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}.card{width:min(92vw,520px);background:rgba(255,255,255,.64);border:1px solid rgba(255,255,255,.7);border-radius:28px;padding:30px;box-shadow:0 24px 75px rgba(24,37,41,.18);text-align:center;backdrop-filter:blur(24px)}.mark{font-size:48px}.spin{width:32px;height:32px;border:3px solid rgba(21,36,42,.18);border-top-color:#15242a;border-radius:50%;margin:20px auto;animation:s .8s linear infinite}@keyframes s{to{transform:rotate(360deg)}}h1{font-size:34px;margin:8px 0 10px}p{line-height:1.55;color:#536368}.go{display:inline-block;margin-top:10px;background:#15242a;color:#fff;text-decoration:none;border-radius:999px;padding:12px 18px}</style></head><body><main class="card"><div class="mark">81</div><h1>Refreshing The 81</h1><div class="spin"></div><p id="status">Clearing the old app cache…</p><a class="go" id="go" href="/?fresh=${release}#home" hidden>Open The 81</a></main><script>(async()=>{const s=document.getElementById('status'),g=document.getElementById('go');try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}s.textContent='Ready. Opening the faster edition…';setTimeout(()=>location.replace('/?fresh=${release}#home'),250)}catch(e){s.textContent='Tap below to continue.';g.hidden=false}})();</script></body></html>`);

fs.writeFileSync('dist/sw.js',`const V='the81-v${release}-fast-network-first';\nself.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/index.html'))))});\n`);

for(const f of ['dist/app.js','dist/natural-audio.js','dist/the81-fast.js','dist/feature-loader.js'])if(fs.existsSync(f))execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
console.log('The 81 performance release '+release+' applied');
