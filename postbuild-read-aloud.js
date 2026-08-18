const {execFileSync}=require('child_process');
const fs=require('fs');
const release='29';
for(const f of ['read-aloud-v2.js','read-aloud-v2.css'])fs.copyFileSync(f,'dist/'+f);
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/\?v=\d+/g,`?v=${release}`);
if(!html.includes('/read-aloud-v2.css'))html=html.replace('</head>',`  <link rel="stylesheet" href="/read-aloud-v2.css?v=${release}" />\n</head>`);
if(!html.includes('/read-aloud-v2.js')){
  if(html.includes('/ambient-audio.js'))html=html.replace(/(<script src="\/ambient-audio\.js\?v=\d+"><\/script>)/,`$1\n  <script src="/read-aloud-v2.js?v=${release}"></script>`);
  else html=html.replace('</body>',`  <script src="/read-aloud-v2.js?v=${release}"></script>\n</body>`);
}
fs.writeFileSync('dist/index.html',html);
execFileSync(process.execPath,['--check','dist/read-aloud-v2.js'],{stdio:'inherit'});
fs.writeFileSync('dist/sw.js',`const V='meb-v${release}-network-first';\nself.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/index.html'))))});\n`);
console.log('Read Aloud release '+release+' applied');
