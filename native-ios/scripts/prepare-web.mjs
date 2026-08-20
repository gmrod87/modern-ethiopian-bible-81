import { cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const nativeRoot=path.resolve(here,'..');
const repoRoot=path.resolve(nativeRoot,'..');
const dist=path.join(repoRoot,'dist');
const www=path.join(nativeRoot,'www');
if(!existsSync(path.join(dist,'index.html'))||!existsSync(path.join(dist,'app.js')))throw new Error('Build Hobah first: run npm run build from the repository root.');

await rm(www,{recursive:true,force:true});
await mkdir(www,{recursive:true});
await cp(dist,www,{recursive:true});
await cp(path.join(nativeRoot,'src','native.css'),path.join(www,'native.css'));

// Expand the bundled whole-Bible search corpora at build time. The iPhone/iPad
// never has to base64-decode or gunzip them in its WebView.
await mkdir(path.join(www,'search'),{recursive:true});
for(const cat of ['ot','eth','nt']){
  const encoded=(await readFile(path.join(www,`${cat}.b64`),'utf8')).trim();
  const json=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
  JSON.parse(json); // validate before shipping the bundle
  await writeFile(path.join(www,'search',`${cat}.json`),json);
}

let html=await readFile(path.join(www,'index.html'),'utf8');
html=html.replace('<body>','<body class="nativeCapacitor">');
if(!html.includes('/native.css'))html=html.replace('</head>','<link rel="stylesheet" href="/native.css?v=1">\n</head>');
if(!html.includes('id="bottomAbout"'))html=html.replace('</nav>','<button id="bottomAbout"><i>ⓘ</i><span>About</span></button>\n</nav>');
const appTag=html.match(/<script[^>]+src=["']\/app\.js[^"']*["'][^>]*><\/script>/i)?.[0];
if(!appTag)throw new Error('Native prep: app.js script tag not found');
html=html.replace(appTag,`<script src="/native-bridge.js?v=1" defer></script>\n${appTag}`);
await writeFile(path.join(www,'index.html'),html);

let app=await readFile(path.join(www,'app.js'),'utf8');
const vm=app.match(/const V='(\d+)';/);
if(!vm)throw new Error('Native prep: runtime version not found');
if(!app.includes('const apiURL='))app=app.replace(vm[0],`${vm[0]}\nconst apiURL=p=>window.HOBAH_API_BASE?window.HOBAH_API_BASE.replace(/\\/$/,'')+p:p;`);
for(const endpoint of ['/api/tts','/api/study-chat','/api/realtime-study']){
  app=app.replaceAll(`fetch('${endpoint}'`,`fetch(apiURL('${endpoint}')`);
}

// Native search uses already-expanded local JSON instead of DecompressionStream.
const searchStart='async function loadCorpus(cat){';
const searchEnd='\nasync function renderSearch(q){';
const si=app.indexOf(searchStart),se=app.indexOf(searchEnd,si);
if(si<0||se<0)throw new Error('Native prep: search loader not found');
const nativeSearch=`async function loadCorpus(cat){\n  if(state.corpora[cat])return state.corpora[cat];\n  const r=await fetch('/search/'+cat+'.json',{cache:'force-cache'});\n  if(!r.ok)throw Error('Offline search corpus unavailable');\n  state.corpora[cat]=await r.json();return state.corpora[cat];\n}`;
app=app.slice(0,si)+nativeSearch+app.slice(se);

const oldShare="if(navigator.share)await navigator.share({title:ref,text,url:location.href});else await navigator.clipboard.writeText(text)";
const nativeShare="if(window.HobahNative?.share)await window.HobahNative.share({title:ref,text,url:location.hash});else if(navigator.share)await navigator.share({title:ref,text,url:location.href});else await navigator.clipboard.writeText(text)";
if(app.includes(oldShare))app=app.replace(oldShare,nativeShare);
if(app.includes('bindAudio();\nbootstrap();'))app=app.replace('bindAudio();\nbootstrap();','bindAudio();\nPromise.resolve(window.HobahNativeReady).catch(()=>{}).finally(()=>bootstrap());');
else if(!app.includes('HobahNativeReady'))throw new Error('Native prep: bootstrap handoff not found');
const relativeAPI=[...app.matchAll(/fetch\(['"](\/api\/[^'"]+)/g)].map(m=>m[1]);
if(relativeAPI.length)throw new Error('Native prep left relative API calls: '+relativeAPI.join(', '));
if(app.includes('DecompressionStream'))throw new Error('Native prep left WebView decompression code');
await writeFile(path.join(www,'app.js'),app);

const books=JSON.parse(await readFile(path.join(www,'books.json'),'utf8'));
for(const book of books){if(!existsSync(path.join(www,'data',`${book.slug}.json`)))throw new Error(`Native prep missing offline book: ${book.slug}`)}
console.log(`Hobah native web bundle prepared: ${books.length} books + pre-expanded offline search`);
