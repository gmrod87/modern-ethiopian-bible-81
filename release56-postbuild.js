const fs=require('fs');
const {execFileSync}=require('child_process');
const D='dist',V='56';
const p=f=>`${D}/${f}`;
const read=f=>fs.existsSync(p(f))?fs.readFileSync(p(f),'utf8'):'';
const write=(f,s)=>fs.writeFileSync(p(f),s);

if(!fs.existsSync('release56-feature-loader.js'))throw new Error('Release56 feature loader missing');
if(!fs.existsSync('release56-performance.css'))throw new Error('Release56 performance CSS missing');
fs.copyFileSync('release56-feature-loader.js',p('feature-loader.js'));
fs.copyFileSync('release56-performance.css',p('release56-performance.css'));

/* Keep core startup lean: do not enumerate browser voices or probe TTS until audio is actually used. */
let app=read('app.js');
if(app){
  app=app.replace('renderDrawer(); updateSavedBadge(); populateVoices();','renderDrawer(); updateSavedBadge();');
  write('app.js',app);
}
let natural=read('natural-audio.js');
if(natural){
  natural=natural.replace("const r=await fetch('/api/tts?health=1',{cache:'no-store'});enabled=r.ok;if(enabled){","enabled=true;if(enabled){");
  write('natural-audio.js',natural);
}

/* Voice commands should consume no microphone/recognition work while Read Aloud is closed. */
let voice=read('release55-voice.js');
if(voice){
  voice=voice.replace(
    "function startListening(showMessage=true){if(!enabled()||!SR)return;",
    "function startListening(showMessage=true){if(!enabled()||!SR||$('#audioBar')?.classList.contains('hidden'))return;"
  );
  voice=voice.replace(
    "restartTimer=setTimeout(()=>{restarting=false;startListening(false)},70)",
    "restartTimer=setTimeout(()=>{restarting=false;startListening(false)},350)"
  );
  voice=voice.replace(
    "if(enabled()){syncControl();startListening(false)}",
    "if(enabled()){syncControl();if(!$('#audioBar')?.classList.contains('hidden'))startListening(false)}"
  );
  voice=voice.replace(
    "document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&enabled()&&!listening)startListening(false)})",
    "document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&enabled()&&!listening&&!$('#audioBar')?.classList.contains('hidden'))startListening(false)})"
  );
  voice=voice.replace(
    "const obs=new MutationObserver(()=>ensureControl());obs.observe($('#audioBar')||document.body,{childList:true,subtree:true});",
    "const bar=$('#audioBar');const obs=new MutationObserver(()=>ensureControl());if(bar)obs.observe(bar,{childList:true,subtree:true});if(bar){const vis=new MutationObserver(()=>{if(!enabled())return;if(bar.classList.contains('hidden'))stopListening();else if(!listening)startListening(false)});vis.observe(bar,{attributes:true,attributeFilter:['class']})}"
  );
  write('release55-voice.js',voice);
}

/* Fresh service worker: no blind precache paths, no stale script pinning. */
const sw=`const V='hobah-v56-smooth';\nconst STATIC='hobah-static-v56';\nconst DATA='hobah-data-v56';\nself.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==STATIC&&k!==DATA)await caches.delete(k);await self.clients.claim()})()));\nasync function networkFirst(req,cacheName,fallback){const c=await caches.open(cacheName);try{const r=await fetch(req,{cache:'no-store'});if(r&&r.ok)c.put(req,r.clone());return r}catch{const hit=await c.match(req)||fallback&&await c.match(fallback);return hit||Response.error()}}\nasync function cacheFirst(req,cacheName){const c=await caches.open(cacheName),hit=await c.match(req);if(hit)return hit;const r=await fetch(req);if(r&&r.ok)c.put(req,r.clone());return r}\nself.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const u=new URL(req.url);if(u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(req.mode==='navigate'){e.respondWith(networkFirst(req,STATIC,'/index.html'));return}const data=u.pathname.startsWith('/data/')||/\\.(?:json|b64)$/.test(u.pathname);const image=/\\.(?:png|jpg|jpeg|webp|svg|avif)$/.test(u.pathname);e.respondWith(data||image?cacheFirst(req,data?DATA:STATIC):networkFirst(req,STATIC))});\n`;
write('sw.js',sw);

let html=read('index.html');
if(!html)throw new Error('Release56: dist/index.html missing');
html=html.replace(/\s*<link[^>]+href=["']\/release56-performance\.css[^"']*["'][^>]*>/g,'');
html=html.replace('</head>',`  <link rel="stylesheet" href="/release56-performance.css?v=${V}" />\n</head>`);
html=html.replace(/\/app\.js\?v=\d+/g,`/app.js?v=${V}`);
html=html.replace(/\/feature-loader\.js\?v=\d+/g,`/feature-loader.js?v=${V}`);
html=html.replace(/\/natural-audio\.js\?v=\d+/g,`/natural-audio.js?v=${V}`);
html=html.replace(/\/release55-voice\.js\?v=\d+/g,`/release55-voice.js?v=${V}`);
write('index.html',html);

const recovery=p('recovery.html');
if(fs.existsSync(recovery)){
  let r=fs.readFileSync(recovery,'utf8');
  r=r.replace(/fresh=\d+/g,`fresh=${V}`).replace(/v=\d+/g,`v=${V}`);
  fs.writeFileSync(recovery,r);
}

for(const f of ['app.js','feature-loader.js','natural-audio.js','read-aloud-v2.js','release55-voice.js','sw.js']){
  if(fs.existsSync(p(f)))execFileSync(process.execPath,['--check',p(f)],{stdio:'inherit'});
}
console.log('Hobah Release 56 smooth-core pass applied');
