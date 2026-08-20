const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='62';
const p=f=>path.join(D,f),read=f=>fs.readFileSync(p(f),'utf8'),write=(f,s)=>{fs.mkdirSync(path.dirname(p(f)),{recursive:true});fs.writeFileSync(p(f),s)};
if(!fs.existsSync(D))throw Error('Release62: dist missing');
fs.copyFileSync('release62-static-reader.js',p('release62-static-reader.js'));
const books=JSON.parse(read('books.json'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const homeBooks=books.map((b,i)=>`<a class="bookTile" href="/read/${encodeURIComponent(b.slug)}/${b.chapters?.[0]?.n||1}/"><span>${String(i+1).padStart(2,'0')} • ${b.category==='nt'?'NEW TESTAMENT':b.category==='eth'?'ETHIOPIAN CANON':'OLD TESTAMENT'}</span><b>${esc(b.title)}</b><small>${b.chapters.length} chapters</small></a>`).join('');
const staticHome=`<section class="hero"><span class="eyebrow">HOBAH • THE ANCIENT CANON</span><h1 class="ancientCanonTitle"><span class="ancientLine1">The</span><span class="ancientLine2">Ancient</span><span class="ancientLine3">Canon</span></h1><p>Read, search and listen across the complete 81-book Ethiopian canon.</p><div class="heroActions"><a class="primary" href="/read/genesis/1/">Begin with Genesis</a><a class="pill" href="#allBooks">Browse all 81 books</a></div></section><section class="section" id="allBooks"><div class="sectionHead"><div><span class="eyebrow">COMPLETE EDITION</span><h2>All 81 books</h2></div></div><div class="featuredBooks">${homeBooks}</div></section>`;
let html=read('index.html');
html=html.replace(/<main id="app" class="app">[\s\S]*?<\/main>/,`<main id="app" class="app">${staticHome}</main>`);
html=html.replace(/\s*<script id="hobah-book-index" type="application\/json">[\s\S]*?<\/script>/,'');
html=html.replace(/<script>setTimeout\(async\(\)=>\{[\s\S]*?<\/script>/,'');
html=html.replace(/\/hobah-core-ui\.css\?v=\d+/g,`/hobah-core-ui.css?v=${V}`);
html=html.replace(/\/study-hub\.css\?v=\d+/g,`/study-hub.css?v=${V}`);
html=html.replace(/\/app\.js\?v=\d+/g,`/app.js?v=${V}`);
html=html.replace(/\/release61-study-loader\.js\?v=\d+/g,`/release61-study-loader.js?v=${V}`);
html=html.replace(/\/natural-audio\.js\?v=\d+/g,`/natural-audio.js?v=${V}`);
html=html.replace(/\/release55-study-audio\.js\?v=\d+/g,`/release55-study-audio.js?v=${V}`);
html=html.replace(/\/release55-voice\.js\?v=\d+/g,`/release55-voice.js?v=${V}`);
write('index.html',html);

let app=read('app.js');
app=app.replace(/const embedded=document\.getElementById\('hobah-book-index'\);\s*if\(!embedded\)throw Error\('Embedded Bible index missing'\);\s*books=JSON\.parse\(embedded\.textContent\);window\.MEB_BOOKS=books;window\.MEB_BOOKS_PROMISE=Promise\.resolve\(books\);/,`books=window.MEB_BOOKS||(await fetch('/books.json?v=${V}',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Bible index unavailable');return r.json()}));window.MEB_BOOKS=books;window.MEB_BOOKS_PROMISE=Promise.resolve(books);`);
app=app.replace(/\/data\/'\+encodeURIComponent\(slug\)\+'\.json\?v=\d+/g,`/data/'+encodeURIComponent(slug)+'.json?v=${V}`);
app=app.replace(/navigator\.serviceWorker\.getRegistrations\(\)\.then\([\s\S]*?\.catch\(\(\)=>\{\}\);/,'');
write('app.js',app);

let css=read('hobah-core-ui.css');
css+=`\n/* Release 62 progressive static reader */\n.staticReader{max-width:820px;margin:0 auto;padding:28px 18px 110px}.staticReader .readerHead{margin-bottom:18px}.staticReader .chapterText{font-size:var(--reader,20px);line-height:1.82}.staticReader .verse{margin:0 0 13px}.staticReader .vnum{display:inline-block;min-width:30px;font-weight:800;font-size:.7em;opacity:.7}.staticAudio{position:sticky;bottom:12px;z-index:20;margin:18px 0;padding:14px;border:1px solid var(--line);border-radius:22px;background:rgba(247,244,237,.94);backdrop-filter:blur(18px);box-shadow:0 10px 30px rgba(35,30,20,.12)}.staticAudioTop{display:flex;align-items:center;justify-content:space-between;gap:10px}.staticAudioButtons,.staticModes{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.staticAudio button,.staticModes button{border:1px solid var(--line);border-radius:999px;padding:9px 13px;background:var(--paper);font-weight:800}.staticModes button.active,#voiceToggle.active{background:#155e4f;color:#fff;border-color:#155e4f}.voiceRow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;padding-top:11px;border-top:1px solid var(--line)}#voiceToggle{min-width:74px}.studyAiHeaderBtn{border:1px solid rgba(120,92,42,.35)!important;border-radius:999px!important;padding:9px 13px!important;background:rgba(255,255,255,.55)!important;font-weight:800!important}.staticPager{display:flex;justify-content:space-between;gap:10px;margin:24px 0}.staticPager a{padding:10px 12px;border:1px solid var(--line);border-radius:14px}.studyAiCardStatic{width:min(720px,calc(100vw - 24px));max-height:88vh;overflow:auto;padding:20px;border:0;border-radius:24px;background:var(--paper)}.studyMsg{padding:12px 0;border-bottom:1px solid var(--line)}.studyMsg p{white-space:pre-wrap}.studyFormStatic{display:flex;gap:8px;margin-top:14px}.studyFormStatic textarea{flex:1;min-height:70px;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--paper)}.studyFormStatic button{border:0;border-radius:14px;padding:0 18px;background:#155e4f;color:#fff;font-weight:800}@media(max-width:640px){.staticReader{padding:20px 14px 120px}.staticAudio{bottom:8px}.studyAiHeaderBtn{font-size:12px;padding:8px 10px!important}}\n`;
write('hobah-core-ui.css',css);

function shell(title,body,scripts='') {return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#F5F2EB"><title>${esc(title)} — Hobah</title><link rel="stylesheet" href="/hobah-core-ui.css?v=${V}"></head><body><header class="topbar"><a class="round" href="/" aria-label="Home">⌂</a><a class="brand" href="/"><span class="brandCross"><img class="hobahHeaderMark" src="/hobah-mark.svg?v=58" alt="Hobah" width="44" height="44"></span></a><a class="studyAiHeaderBtn" href="#studyAiDialog" id="studyAiBtn">Study AI</a><a class="round" href="/">⌕</a></header>${body}${scripts}</body></html>`}

let pages=0;
for(const meta of books){
  const f=p(`data/${meta.slug}.json`);if(!fs.existsSync(f))continue;
  let book;try{book=JSON.parse(fs.readFileSync(f,'utf8'))}catch{continue}
  const chs=book.chapters||[];
  for(let i=0;i<chs.length;i++){
    const c=chs[i],prev=chs[i-1],next=chs[i+1],vs=Array.isArray(c.verses)?c.verses:[];
    const verseHTML=vs.length?vs.map(v=>`<p class="verse"><span class="vnum">${v.v}</span>${esc(v.t).replace(/\b(YHWH|Jesus)\b/g,'<span class="divine">$1</span>')}</p>`).join(''):`<p>${esc(c.note||'No parsed verse text is available for this chapter.')}</p>`;
    const chapters=chs.map(x=>`<a class="${x.n===c.n?'current':''}" href="/read/${meta.slug}/${x.n}/">${x.n}</a>`).join('');
    const body=`<main class="staticReader"><div class="readerHead"><span class="eyebrow">${meta.category==='nt'?'NEW TESTAMENT':meta.category==='eth'?'ETHIOPIAN CANON':'OLD TESTAMENT'}</span><h1>${esc(book.title)}</h1><p>${book.title==='Psalms'?'Psalm':'Chapter'} ${c.n}</p></div><div class="staticAudio"><div class="staticAudioTop"><div><b>Read aloud</b><small id="audioStatus">Natural voice ready</small></div><button id="studyAiBtn" type="button">Study AI</button></div><div class="staticAudioButtons"><button id="readPlay" type="button">▶ Play / Pause</button><button id="readRestart" type="button">↺ Restart</button></div><div class="staticModes"><span class="eyebrow">CONTEXT</span><button data-audio-mode="normal" type="button">None</button><button data-audio-mode="context" type="button">Context</button><button data-audio-mode="advanced" type="button">Advanced</button></div><div class="voiceRow"><div><b>Voice Commands</b><small id="voiceStatus">Off</small></div><button id="voiceToggle" type="button" role="switch">On / Off</button></div></div><article class="chapterText" id="chapterText">${verseHTML}</article><div class="staticPager">${prev?`<a href="/read/${meta.slug}/${prev.n}/">← ${prev.n}</a>`:'<span></span>'}<a href="/">Home</a>${next?`<a href="/read/${meta.slug}/${next.n}/">${next.n} →</a>`:'<span></span>'}</div><div class="chapterGrid">${chapters}</div></main><dialog id="studyAiDialog"><div class="studyAiCardStatic"><button id="studyAiClose" class="dialogClose" type="button">×</button><span class="eyebrow">STUDY AI</span><h2>Ask the text</h2><div id="studyAiMessages"><p>Ask about this chapter, or say “explain that” while Read Aloud is running.</p></div><form id="studyAiForm" class="studyFormStatic"><textarea id="studyAiInput" placeholder="Ask about ${esc(book.title)} ${c.n}…"></textarea><button id="studyAiAsk" type="submit">Ask</button></form></div></dialog>`;
    const pageData=JSON.stringify({title:book.title,slug:meta.slug,chapter:c.n,verses:vs}).replace(/</g,'\\u003c');
    const scripts=`<script>window.HOBAH_PAGE=${pageData}</script><script defer src="/study-data-all.js?v=${V}"></script><script defer src="/release62-static-reader.js?v=${V}"></script>`;
    write(`read/${meta.slug}/${c.n}/index.html`,shell(`${book.title} ${c.n}`,body,scripts));pages++;
  }
}
write('sw.js',`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())await caches.delete(k);await self.registration.unregister();await self.clients.claim()})()));`);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});execFileSync(process.execPath,['--check',p('release62-static-reader.js')],{stdio:'inherit'});
console.log(`Hobah Release ${V}: static-first home plus ${pages} no-blank chapter pages built`);