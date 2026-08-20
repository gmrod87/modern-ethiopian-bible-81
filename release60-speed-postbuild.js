const fs=require('fs');
const {execFileSync}=require('child_process');
const D='dist',V='60';
const p=f=>`${D}/${f}`;
const read=f=>fs.readFileSync(p(f),'utf8');
const write=(f,s)=>fs.writeFileSync(p(f),s);

if(!fs.existsSync(D))throw new Error('Release60: dist missing');
if(!fs.existsSync('release60-study-loader.js'))throw new Error('Release60: lazy study loader missing');
fs.copyFileSync('release60-study-loader.js',p('release60-study-loader.js'));

// Make the native reader cache-friendly. The versioned URLs guarantee fresh content on releases.
let app=read('app.js');
app=app.replace("fetch('/books.json',{cache:'no-store'})","fetch('/books.json?v=60',{cache:'force-cache'})");
app=app.replace("fetch('/data/'+encodeURIComponent(slug)+'.json',{cache:'no-store'})","fetch('/data/'+encodeURIComponent(slug)+'.json?v=60',{cache:'force-cache'})");
app=app.replace(/navigator\.serviceWorker\.register\('\/sw\.js\?v=\d+'\)/g,`navigator.serviceWorker.register('/sw.js?v=${V}')`);
write('app.js',app);

// Share the already-loading book index with narration and load context data only when Context/Advanced is actually used.
let natural=read('natural-audio.js');
natural=natural.replace(
  "books=await fetch('/books.json').then(r=>r.json());",
  "books=window.MEB_BOOKS||(await (window.MEB_BOOKS_PROMISE||fetch('/books.json?v=60',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Bible index unavailable');return r.json()})));"
);
natural=natural.replace(
  "async function speak(text,start=0,ctx=null,includeContext=true){if(!enabled||busy)return;if(ctx)current=ctx;stopped=false;window.MEB_NATURAL_AUDIO_ACTIVE=true;const full=includeContext?narrationText(current,text):clean(text);",
  "async function speak(text,start=0,ctx=null,includeContext=true){if(!enabled||busy)return;if(ctx)current=ctx;stopped=false;window.MEB_NATURAL_AUDIO_ACTIVE=true;if(includeContext&&mode()!=='normal'&&window.MEB_LOAD_STUDY_DATA){try{await window.MEB_LOAD_STUDY_DATA()}catch(e){console.warn('Context data unavailable',e)}}const full=includeContext?narrationText(current,text):clean(text);"
);
write('natural-audio.js',natural);

let html=read('index.html');
// Heavy study datasets were blocking iPhone startup. Keep them in dist, but never load them during the first paint.
html=html.replace(/\s*<script[^>]+src=["']\/study-data-\d{2}\.js[^"']*["'][^>]*><\/script>/g,'');
html=html.replace(/\s*<script[^>]+src=["']\/release59-study-loader\.js[^"']*["'][^>]*><\/script>/g,'');
html=html.replace(/\s*<script[^>]+src=["']\/release60-study-loader\.js[^"']*["'][^>]*><\/script>/g,'');
html=html.replace(/\/app\.js\?v=\d+/g,`/app.js?v=${V}`);
html=html.replace(/\/hobah-core-ui\.css\?v=\d+/g,`/hobah-core-ui.css?v=${V}`);
html=html.replace(/\/study-hub\.css\?v=\d+/g,`/study-hub.css?v=${V}`);
html=html.replace(/\/natural-audio\.js\?v=\d+/g,`/natural-audio.js?v=${V}`);
html=html.replace(/\/release55-study-audio\.js\?v=\d+/g,`/release55-study-audio.js?v=${V}`);
html=html.replace(/\/release55-voice\.js\?v=\d+/g,`/release55-voice.js?v=${V}`);
if(!html.includes('rel="preload" href="/books.json?v=60"')){
  html=html.replace('</head>',`  <link rel="preload" href="/books.json?v=${V}" as="fetch" crossorigin="anonymous" />\n</head>`);
}
html=html.replace('<main id="app" class="app"></main>',`<main id="app" class="app"><section class="hero bootHero" aria-busy="true"><span class="eyebrow">HOBAH • THE ANCIENT CANON</span><h1 class="ancientCanonTitle"><span class="ancientLine1">The</span><span class="ancientLine2">Ancient</span><span class="ancientLine3">Canon</span></h1><p>Opening your Bible…</p></section></main>`);
const loaderTag=`  <script src="/release60-study-loader.js?v=${V}"></script>`;
const naturalTag=`<script src="/natural-audio.js?v=${V}"></script>`;
if(html.includes(naturalTag))html=html.replace(naturalTag,`${loaderTag}\n  ${naturalTag}`);
else html=html.replace('</body>',`${loaderTag}\n</body>`);
write('index.html',html);

let css=read('hobah-core-ui.css');
css+=`\n/* Hobah Release ${V}: instant startup shell */\n.bootHero{min-height:46vh;display:flex;flex-direction:column;justify-content:center}.bootHero p{opacity:.68}\n`;
write('hobah-core-ui.css',css);

// Fast repeat launches: cache the shell and every book/study asset after its first successful request.
const sw=`const CACHE='hobah-${V}';\nconst CORE=['/','/hobah-core-ui.css?v=${V}','/app.js?v=${V}','/books.json?v=${V}','/hobah-mark.svg?v=58','/study-hub.css?v=${V}','/release60-study-loader.js?v=${V}','/natural-audio.js?v=${V}','/release55-study-audio.js?v=${V}','/release55-voice.js?v=${V}'];\nself.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await Promise.all(CORE.map(u=>c.add(u).catch(()=>{})));await self.skipWaiting()})()));\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})()));\nself.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin||u.pathname.startsWith('/api/'))return;if(r.mode==='navigate'){e.respondWith(fetch(r).then(x=>{const y=x.clone();caches.open(CACHE).then(c=>c.put('/',y));return x}).catch(()=>caches.match('/')));return}e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(x=>{if(x.ok){const y=x.clone();caches.open(CACHE).then(c=>c.put(r,y))}return x}))) });\n`;
write('sw.js',sw);

for(const f of ['app.js','natural-audio.js','release55-study-audio.js','release55-voice.js','release60-study-loader.js','sw.js']){
  execFileSync(process.execPath,['--check',p(f)],{stdio:'inherit'});
}
const out=read('index.html');
if(/\/study-data-\d{2}\.js/.test(out))throw new Error('Release60: study data still blocks first paint');
if(!out.includes(`/release60-study-loader.js?v=${V}`))throw new Error('Release60: lazy loader missing');
if(!out.includes(`/app.js?v=${V}`)||!out.includes(`/natural-audio.js?v=${V}`))throw new Error('Release60: cache bust missing');
console.log(`Hobah Release ${V}: instant shell, lazy study data and offline-first cache enabled`);
