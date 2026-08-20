const fs=require('fs');
const {execFileSync}=require('child_process');
const D='dist',V='61';
const p=f=>`${D}/${f}`;
const read=f=>fs.readFileSync(p(f),'utf8');
const write=(f,s)=>fs.writeFileSync(p(f),s);

if(!fs.existsSync(D))throw new Error('Release61: dist missing');
if(!fs.existsSync('release61-study-loader.js'))throw new Error('Release61: study loader missing');
fs.copyFileSync('release61-study-loader.js',p('release61-study-loader.js'));

// Collapse the ten study-data requests into one lazy request. It stays completely off the startup path.
const studyFiles=Array.from({length:10},(_,i)=>`study-data-${String(i).padStart(2,'0')}.js`);
for(const f of studyFiles)if(!fs.existsSync(p(f)))throw new Error(`Release61: ${f} missing`);
write('study-data-all.js',studyFiles.map(f=>read(f)).join('\n'));

// Eliminate the only startup network dependency: embed the 81-book index in the page.
const bookIndex=JSON.parse(read('books.json'));
let app=read('app.js');
const startupIndex=/  window\.MEB_BOOKS_PROMISE=[^\n]+\n  books=await window\.MEB_BOOKS_PROMISE;window\.MEB_BOOKS=books;\n/;
if(!startupIndex.test(app))throw new Error('Release61: startup book-index fetch not found');
app=app.replace(startupIndex,"  const embedded=document.getElementById('hobah-book-index');\n  if(!embedded)throw Error('Embedded Bible index missing');\n  books=JSON.parse(embedded.textContent);window.MEB_BOOKS=books;window.MEB_BOOKS_PROMISE=Promise.resolve(books);\n");
app=app.replace(/if\('serviceWorker' in navigator\) navigator\.serviceWorker\.register\('\/sw\.js\?v=\d+'\)\.catch\(\(\)=>\{\}\);/,"if('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).catch(()=>{});");
app=app.replace(/fetch\('\/data\/'\+encodeURIComponent\(slug\)\+'\.json\?v=\d+',\{cache:'force-cache'\}\)/,"fetch('/data/'+encodeURIComponent(slug)+'.json?v=61',{cache:'force-cache'})");
app=app.replace('  router();\n}','  router();\n  document.documentElement.dataset.hobahReady=\'1\';\n}');
write('app.js',app);

// Version and harden the natural narrator without changing its behaviour.
let natural=read('natural-audio.js');
natural=natural.replace(/\/books\.json\?v=\d+/g,'/books.json?v=61');
write('natural-audio.js',natural);

// Make voice recognition restart as quickly as WebKit permits and keep the requested command wording.
let voice=read('release55-voice.js');
voice=voice.replace(/restartTimer=setTimeout\(\(\)=>\{restarting=false;startListening\(false\)\},\d+\)/,'restartTimer=setTimeout(()=>{restarting=false;startListening(false)},25)');
voice=voice.replace(/now-lastCommandAt<\d+/,'now-lastCommandAt<300');
voice=voice.replace('Say “stop”, “play”, or “explain that”. “Stop” holds your place so Study AI can explain and resume.','Say “stop”, “play”, “continue”, or “explain that”.');
write('release55-voice.js',voice);

let html=read('index.html');
html=html.replace(/\s*<link rel="preload" href="\/books\.json[^>]+>/g,'');
html=html.replace(/\/hobah-core-ui\.css\?v=\d+/g,`/hobah-core-ui.css?v=${V}`);
html=html.replace(/\/study-hub\.css\?v=\d+/g,`/study-hub.css?v=${V}`);
html=html.replace(/\/app\.js\?v=\d+/g,`/app.js?v=${V}`);
html=html.replace(/\/natural-audio\.js\?v=\d+/g,`/natural-audio.js?v=${V}`);
html=html.replace(/\/release55-study-audio\.js\?v=\d+/g,`/release55-study-audio.js?v=${V}`);
html=html.replace(/\/release55-voice\.js\?v=\d+/g,`/release55-voice.js?v=${V}`);
html=html.replace(/\s*<script[^>]+src=["']\/release60-study-loader\.js[^"']*["'][^>]*><\/script>/g,'');
html=html.replace(/\s*<script[^>]+src=["']\/release61-study-loader\.js[^"']*["'][^>]*><\/script>/g,'');
html=html.replace(/<script type="module" src="\/app\.js\?v=61"><\/script>/,'<script defer src="/app.js?v=61"></script>');
html=html.replace(/<script src="\/natural-audio\.js\?v=61"><\/script>/,'<script defer src="/natural-audio.js?v=61"></script>');
html=html.replace(/<script src="\/release55-study-audio\.js\?v=61"><\/script>/,'<script defer src="/release55-study-audio.js?v=61"></script>');
html=html.replace(/<script src="\/release55-voice\.js\?v=61"><\/script>/,'<script defer src="/release55-voice.js?v=61"></script>');

const indexJson=JSON.stringify(bookIndex).replace(/</g,'\\u003c');
const indexTag=`  <script id="hobah-book-index" type="application/json">${indexJson}</script>`;
const appTag='<script defer src="/app.js?v=61"></script>';
if(!html.includes(appTag))throw new Error('Release61: app script tag not found');
html=html.replace(`  ${appTag}`,`${indexTag}\n  ${appTag}\n  <script defer src="/release61-study-loader.js?v=61"></script>`);

// Restore a direct curved Study AI header button while keeping the Hobah mark centred.
if(!html.includes('id="studyAiHeaderBtn"'))html=html.replace('<button class="round" id="savedBtn"','<button id="studyAiHeaderBtn" class="studyAiHeaderBtn" type="button" aria-label="Open Study AI">Study AI</button>\n    <button class="round" id="savedBtn"');

// If any old iOS service worker leaves the shell stranded, self-heal once instead of hanging forever.
const watchdog=`<script>setTimeout(async()=>{if(document.documentElement.dataset.hobahReady==='1')return;let retried=false;try{retried=sessionStorage.getItem('hobah61retry')==='1'}catch{}if(!retried){try{sessionStorage.setItem('hobah61retry','1')}catch{}try{if('serviceWorker'in navigator){const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()))}if('caches'in window){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}}catch{}location.replace('/?fresh=61#home');return}const a=document.getElementById('app');if(a)a.innerHTML='<section class="hero"><span class="eyebrow">HOBAH</span><h1>Reload Hobah</h1><p>The app did not finish starting.</p><p><a class="primary" href="/recovery.html?v=61">Refresh app</a></p></section>'},4500)</script>`;
html=html.replace('</body>',`${watchdog}\n</body>`);
write('index.html',html);

let css=read('hobah-core-ui.css');
css+=`\n/* Hobah Release ${V}: fixed iPhone startup + direct Study AI */\n.topbar{position:relative!important}.topbar .brand{position:absolute!important;left:50%!important;transform:translateX(-50%)!important;z-index:2}.studyAiHeaderBtn{position:absolute;right:66px;top:50%;transform:translateY(-50%);z-index:3;min-height:38px;padding:8px 13px;border:1px solid rgba(27,81,70,.34);border-radius:999px;background:rgba(255,253,248,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#163d35;font:inherit;font-size:12px;font-weight:850;letter-spacing:.01em;box-shadow:0 4px 14px rgba(41,35,28,.06)}.studyAiHeaderBtn:active{transform:translateY(-50%) scale(.97)}.studyAiHeaderBtn:disabled{opacity:.65}.topbar #savedBtn{margin-left:auto}@media(max-width:390px){.studyAiHeaderBtn{right:60px;padding:7px 10px;font-size:11px}}\n`;
write('hobah-core-ui.css',css);

// Do not intercept requests on iOS. Versioned URLs + normal HTTP caching are safer than a stale app-shell cache.
write('sw.js',`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())await caches.delete(k);await self.clients.claim()})()));\n`);

// Recovery now clears every worker/cache and opens the guaranteed embedded-index build.
write('recovery.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Refresh Hobah</title><style>body{font-family:system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f2eb;color:#142e28}.card{max-width:420px;margin:24px;padding:30px;border:1px solid #d9d2c7;border-radius:24px;background:#fffdf8;text-align:center}h1{font-family:Georgia,serif}a{display:inline-block;padding:12px 18px;border-radius:999px;background:#1b5146;color:#fff;text-decoration:none}</style></head><body><main class="card"><h1>Refreshing Hobah</h1><p id="s">Removing the old app version…</p><a id="go" href="/?fresh=61#home" hidden>Open Hobah</a></main><script>(async()=>{try{try{sessionStorage.removeItem('hobah61retry')}catch{}if('serviceWorker'in navigator){const r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(x=>x.unregister()))}if('caches'in window){const k=await caches.keys();await Promise.all(k.map(x=>caches.delete(x)))}document.getElementById('s').textContent='Done. Opening Hobah…';setTimeout(()=>location.replace('/?fresh=61#home'),120)}catch(e){document.getElementById('s').textContent='Tap below to open Hobah.';document.getElementById('go').hidden=false}})()</script></body></html>`);

for(const f of ['app.js','natural-audio.js','release55-study-audio.js','release55-voice.js','release61-study-loader.js','study-data-all.js','sw.js'])execFileSync(process.execPath,['--check',p(f)],{stdio:'inherit'});
const out=read('index.html');
if(!out.includes('id="hobah-book-index"'))throw new Error('Release61: embedded book index missing');
if(!out.includes('<script defer src="/app.js?v=61"></script>'))throw new Error('Release61: core app is not defer-first');
if(!out.includes('/release61-study-loader.js?v=61'))throw new Error('Release61: Study AI loader missing');
if(/\/study-data-\d{2}\.js/.test(out))throw new Error('Release61: blocking study data returned');
if(!out.includes('id="studyAiHeaderBtn"'))throw new Error('Release61: Study AI header control missing');
console.log('Hobah Release 61: embedded startup index, defer-first core, self-healing iOS boot, natural narration and Study AI preserved');
