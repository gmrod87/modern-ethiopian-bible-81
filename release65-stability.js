const fs=require('fs');
const {execFileSync}=require('child_process');
const D='dist',V='65';
const p=f=>`${D}/${f}`;
const read=f=>fs.existsSync(p(f))?fs.readFileSync(p(f),'utf8'):'';
const write=(f,s)=>fs.writeFileSync(p(f),s);
if(!fs.existsSync(D))throw new Error('Release65: dist missing');

// Keep the restored Release 54/55/64 interface, but remove the fragile startup tricks.
// The shell should stay tiny and the Bible index should load from the normal JSON asset.
let app=read('app.js');
if(!app)throw new Error('Release65: app.js missing');

const oldUser="const user=()=>safeJSON('meb:user',{saved:[],notes:{}});";
const newUser=`function user(){\n  const raw=safeJSON('meb:user',{saved:[],notes:{},savedStudy:[]});\n  const d=raw&&typeof raw==='object'?raw:{};\n  return {...d,saved:Array.isArray(d.saved)?d.saved:[],notes:d.notes&&typeof d.notes==='object'&&!Array.isArray(d.notes)?d.notes:{},savedStudy:Array.isArray(d.savedStudy)?d.savedStudy:[]};\n}`;
if(app.includes(oldUser))app=app.replace(oldUser,newUser);
app=app.replace("function saveUser(d){localStorage.setItem('meb:user',JSON.stringify(d));updateSavedBadge()}","function saveUser(d){try{localStorage.setItem('meb:user',JSON.stringify(d))}catch{}updateSavedBadge()}");

const embeddedInit=`async function init(){\n  const embedded=document.getElementById('hobah-book-index');\n  if(!embedded)throw Error('Embedded Bible index missing');\n  books=JSON.parse(embedded.textContent);window.MEB_BOOKS=books;window.MEB_BOOKS_PROMISE=Promise.resolve(books);`;
const networkInit=`async function init(){\n  const loadIndex=async()=>{const r=await fetch('/books.json?v=${V}',{cache:'no-store'});if(!r.ok)throw Error('Bible index unavailable');return r.json()};\n  books=await loadIndex();window.MEB_BOOKS=books;window.MEB_BOOKS_PROMISE=Promise.resolve(books);`;
if(app.includes(embeddedInit))app=app.replace(embeddedInit,networkInit);
else if(!app.includes("fetch('/books.json?v=65'"))throw new Error('Release65: startup index patch target not found');
app=app.replace(/\/data\/'\+encodeURIComponent\(slug\)\+'\.json\?v=\d+'/g,"/data/'+encodeURIComponent(slug)+'.json?v=65'");
write('app.js',app);

// Version optional feature files consistently so iOS never mixes old and new JavaScript.
for(const f of ['feature-loader.js','natural-audio.js','read-aloud-v2.js','release55-voice.js','experience.js','ambient-audio.js','study-hub.js','study.js','research-suite.js']){
  if(!fs.existsSync(p(f)))continue;
  let s=read(f).replace(/\?v=64/g,'?v=65').replace(/const V='64';/g,"const V='65';");
  if(f==='natural-audio.js'||f==='study-hub.js')s=s.replace(/\/books\.json\?v=\d+/g,'/books.json?v=65');
  write(f,s);
}

let html=read('index.html');
if(!html)throw new Error('Release65: index missing');
// The embedded chapter index made the HTML shell unnecessarily huge on iPhone. Remove it.
html=html.replace(/\s*<script id=["']hobah-book-index["'] type=["']application\/json["']>[\s\S]*?<\/script>/,'');
html=html.replace(/\?v=64/g,'?v=65');

// Clear any legacy service worker/cache before the app code runs. This is deliberately tiny and non-blocking.
const cacheRepair=`<script id="hobah-cache-repair">(()=>{try{if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).catch(()=>{});if('caches' in window)caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).catch(()=>{})}catch{}})();</script>`;
if(!html.includes('hobah-cache-repair'))html=html.replace('</head>',`  ${cacheRepair}\n</head>`);
write('index.html',html);

// Do not let a stale service worker control this release. Home-screen mode still works online without one.
write('sw.js',`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())await caches.delete(k);await self.registration.unregister();await self.clients.claim()})()));\n`);

for(const f of ['app.js','feature-loader.js','natural-audio.js','read-aloud-v2.js','release55-voice.js','experience.js','ambient-audio.js','study-hub.js','sw.js'])if(fs.existsSync(p(f)))execFileSync(process.execPath,['--check',p(f)],{stdio:'inherit'});
const out=read('index.html');
if(out.includes('hobah-book-index'))throw new Error('Release65: embedded index still present');
if(!out.includes('/app.js?v=65'))throw new Error('Release65: app version missing');
if(!out.includes('/experience.js?v=65'))throw new Error('Release65: feeling guide missing');
if(!out.includes('/ambient-audio.js?v=65'))throw new Error('Release65: listen extras missing');
console.log('Hobah Release 65: stable small shell, cache repair, full restored interface');
