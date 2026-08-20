const fs=require('fs');
const {execFileSync}=require('child_process');
const D='dist',V='64';
const p=f=>`${D}/${f}`;
const read=f=>fs.existsSync(p(f))?fs.readFileSync(p(f),'utf8'):'';
const write=(f,s)=>{fs.mkdirSync(require('path').dirname(p(f)),{recursive:true});fs.writeFileSync(p(f),s)};
if(!fs.existsSync(D))throw new Error('Release64: dist missing');

// 1) Keep the Release 54/55 visual system and listen panel exactly as designed.
// Collapse study context into one lazy file so Study AI/Research no longer fan out to ten requests.
const studyFiles=Array.from({length:10},(_,i)=>`study-data-${String(i).padStart(2,'0')}.js`);
for(const f of studyFiles)if(!fs.existsSync(p(f)))throw new Error(`Release64: ${f} missing`);
write('study-data-all.js',studyFiles.map(f=>read(f)).join('\n'));

// 2) Restore the full lazy feature loader: Study, Research Desk, chronology and extras.
let loader=fs.readFileSync('release56-feature-loader.js','utf8')
  .replace("const V='56';",`const V='${V}';`)
  .replace("const study=[...Array.from({length:10},(_,i)=>`study-data-${String(i).padStart(2,'0')}.js`),'curated-notes.js','study.js','study-hub.js'];","const study=['study-data-all.js','curated-notes.js','study.js','study-hub.js'];")
  .replace("const extras=['chronology.js','experience.js','ambient-audio.js'];","const extras=['chronology.js'];")
  .replace("#studyHubBtn,#studyAiFloat,.studyToggle,[data-study]","#studyHubBtn,#studyAiHeaderBtn,#studyAiFloat,.studyToggle,[data-study]");
write('feature-loader.js',loader);

// 3) Eliminate the only startup metadata request by embedding the 81-book index.
const books=JSON.parse(read('books.json'));
let app=read('app.js');
const startupIndex=/  window\.MEB_BOOKS_PROMISE=[^\n]+\n  books=await window\.MEB_BOOKS_PROMISE;window\.MEB_BOOKS=books;\n/;
if(startupIndex.test(app)){
  app=app.replace(startupIndex,"  const embedded=document.getElementById('hobah-book-index');\n  if(!embedded)throw Error('Embedded Bible index missing');\n  books=JSON.parse(embedded.textContent);window.MEB_BOOKS=books;window.MEB_BOOKS_PROMISE=Promise.resolve(books);\n");
}
// Never let an old iOS service worker trap a stale shell again.
app=app.replace(/if\('serviceWorker' in navigator\)[^\n]+/g,"if('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).catch(()=>{});");
app=app.replace(/fetch\('\/data\/'\+encodeURIComponent\(slug\)\+'\.json(?:\?v=\d+)?'[^)]*\)/g,"fetch('/data/'+encodeURIComponent(slug)+'.json?v=64',{cache:'force-cache'})");
write('app.js',app);

// 4) Restore natural narration labels while preserving the older, better listening UI.
let natural=read('natural-audio.js');
natural=natural.replace(/\/books\.json(?:\?v=\d+)?/g,'/books.json?v=64');
natural=natural.replace(/>READ MODE</g,'>CONTEXT<').replace(/>Normal</g,'>None<').replace(/>Context Added</g,'>Context<');
natural=natural.replace(/const r=await fetch\('\/api\/tts\?health=1',[^;]+;enabled=r\.ok;if\(enabled\)\{/g,'enabled=true;if(enabled){');
write('natural-audio.js',natural);

// 5) Use the proven Release 55 Study-AI narration bridge and fastest voice-command loop.
fs.copyFileSync('release55-study-audio.js',p('read-aloud-v2.js'));
let voice=fs.readFileSync('release55-voice.js','utf8');
voice=voice.replace(/restartTimer=setTimeout\(\(\)=>\{restarting=false;startListening\(false\)\},\d+\)/,'restartTimer=setTimeout(()=>{restarting=false;startListening(false)},25)');
voice=voice.replace(/now-lastCommandAt<\d+/,'now-lastCommandAt<300');
voice=voice.replace('Say “stop”, “play”, or “explain that”. “Stop” holds your place so Study AI can explain and resume.','Say “stop”, “play”, “continue”, or “explain that”.');
write('release55-voice.js',voice);

// 6) Restore the small always-visible features that should never have been removed.
// release55-postbuild already strips the duplicate old voice controller from experience.js
// and the duplicate Study-AI audio bridge from ambient-audio.js.
for(const f of ['experience.js','ambient-audio.js'])if(!fs.existsSync(p(f)))throw new Error(`Release64: ${f} missing`);

let html=read('index.html');
if(!html)throw new Error('Release64: index missing');
// Remove optional heavy modules from startup; loader brings them in only when tapped.
const heavy=[...studyFiles,'curated-notes.js','study.js','study-hub.js','research-data.js','research-texts.js','research-suite.js','chronology.js'];
for(const name of heavy){const re=new RegExp(`\\s*<script[^>]+src=["']/${name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(?:\\?v=[^"']*)?["'][^>]*><\\/script>`,'g');html=html.replace(re,'')}
// Normalize core script tags, then insert exactly one copy in a safe order.
for(const name of ['app.js','feature-loader.js','natural-audio.js','read-aloud-v2.js','release55-voice.js','experience.js','ambient-audio.js']){
  const re=new RegExp(`\\s*<script[^>]+src=["']/${name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(?:\\?v=[^"']*)?["'][^>]*><\\/script>`,'g');html=html.replace(re,'');
}
const indexJson=JSON.stringify(books).replace(/</g,'\\u003c');
const scripts=`\n  <script id="hobah-book-index" type="application/json">${indexJson}</script>\n  <script defer src="/app.js?v=${V}"></script>\n  <script defer src="/natural-audio.js?v=${V}"></script>\n  <script defer src="/read-aloud-v2.js?v=${V}"></script>\n  <script defer src="/release55-voice.js?v=${V}"></script>\n  <script defer src="/experience.js?v=${V}"></script>\n  <script defer src="/ambient-audio.js?v=${V}"></script>\n  <script defer src="/feature-loader.js?v=${V}"></script>\n`;
html=html.replace('</body>',scripts+'</body>');
// Version the visual bundle without changing the Release 54 look.
html=html.replace(/\/hobah-v54\.css(?:\?v=\d+)?/g,`/hobah-v54.css?v=${V}`);
html=html.replace(/\/release56-performance\.css(?:\?v=\d+)?/g,`/release56-performance.css?v=${V}`);

// Make Study AI directly reachable from the header but keep the existing header layout/classes.
if(!html.includes('id="studyAiHeaderBtn"')){
  html=html.replace('<button class="round" id="savedBtn"','<button id="studyAiHeaderBtn" class="studyAiHeaderBtn" data-study type="button" aria-label="Open Study AI">Study AI</button>\n    <button class="round" id="savedBtn"');
}
write('index.html',html);

// Header compatibility: support the restored Study AI pill without changing the visual language.
let css=read('hobah-v54.css');
if(!css.includes('Release 64 header compatibility'))css+=`\n/* Release 64 header compatibility — same Hobah visual language */\n.studyAiHeaderBtn{grid-column:3!important;grid-row:1!important;justify-self:end!important;min-height:38px!important;height:38px!important;padding:0 12px!important;border:1px solid rgba(154,116,64,.42)!important;border-radius:999px!important;background:rgba(255,253,248,.78)!important;color:var(--ui-green)!important;font-size:11px!important;font-weight:850!important;white-space:nowrap!important;z-index:5!important}.topbar #savedBtn{grid-column:4!important}.topbar{grid-template-columns:44px minmax(0,1fr) auto 44px!important}@media(max-width:430px){.studyAiHeaderBtn{padding:0 9px!important;font-size:10px!important}.topbar{grid-template-columns:40px minmax(0,1fr) auto 40px!important}}\n`;
write('hobah-v54.css',css);

// Direct header Study AI loader/open bridge.
const bridge=`<script>document.addEventListener('click',async e=>{const b=e.target.closest&&e.target.closest('#studyAiHeaderBtn');if(!b)return;e.preventDefault();b.disabled=true;const old=b.textContent;b.textContent='Opening…';try{await window.THE81_FEATURES?.study?.();const d=document.getElementById('studyAiDialog');if(d&&!d.open){document.getElementById('studyAiFloat')?.click();if(!d.open)d.showModal?.()}}finally{b.disabled=false;b.textContent=old}},true)</script>`;
html=read('index.html').replace('</body>',bridge+'\n</body>');write('index.html',html);

// No request interception: versioned assets + normal browser cache are more reliable on iOS.
write('sw.js',`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())await caches.delete(k);await self.registration.unregister();await self.clients.claim()})()));\n`);

for(const f of ['app.js','feature-loader.js','natural-audio.js','read-aloud-v2.js','release55-voice.js','experience.js','ambient-audio.js','sw.js'])execFileSync(process.execPath,['--check',p(f)],{stdio:'inherit'});
const out=read('index.html');
if(!out.includes('hobah-book-index'))throw new Error('Release64 embedded index missing');
if(!out.includes('/experience.js?v=64'))throw new Error('Release64 feeling guide missing');
if(!out.includes('/ambient-audio.js?v=64'))throw new Error('Release64 ambient listen UI missing');
if(!out.includes('/read-aloud-v2.js?v=64'))throw new Error('Release64 Study AI narration bridge missing');
console.log('Hobah Release 64: full pre-63 UI/features restored with stable embedded startup');
