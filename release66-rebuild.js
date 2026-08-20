const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='66';
if(!fs.existsSync(D))throw new Error('Run build.js before release66-rebuild.js');

fs.copyFileSync('release66-app.js',path.join(D,'app.js'));
fs.copyFileSync('release66.css',path.join(D,'styles.css'));

const html=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f3efe5">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Hobah">
<meta name="description" content="Hobah — read, listen, search and study the complete 81-book Ethiopian Bible edition.">
<link rel="manifest" href="/manifest.webmanifest?v=${V}">
<link rel="apple-touch-icon" href="/hobah-icon-180-v52.png">
<link rel="icon" href="/hobah-mark.svg?v=52" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css?v=${V}">
<title>Hobah</title>
<script>(()=>{try{if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister())));if('caches'in window)caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k))))}catch{}})()</script>
</head>
<body>
<header class="topbar">
<button class="round" id="menuBtn" aria-label="Open books">☰</button>
<a class="brand" id="homeBtn" href="#home" aria-label="Hobah home">H</a>
<button id="studyAiHeaderBtn" class="studyAiHeaderBtn" type="button">Study AI</button>
<button class="round" id="savedBtn" aria-label="Saved">♡</button>
</header>
<div class="searchbar"><form id="searchForm"><span>⌕</span><input id="searchInput" autocomplete="off" placeholder="Search…"><button>Search</button></form></div>
<aside id="drawer" class="drawer" aria-hidden="true">
<div class="drawerHead"><div><span class="eyebrow">HOBAH LIBRARY</span><h2>81 Books</h2></div><button class="round" id="closeDrawer">×</button></div>
<div id="drawerFilters" class="drawerFilters"><button class="active" data-filter="all">All</button><button data-filter="ot">Old Testament</button><button data-filter="eth">Ethiopian</button><button data-filter="nt">New Testament</button></div>
<div id="drawerBooks" class="drawerBooks"></div>
</aside>
<div id="backdrop" class="backdrop"></div>

<main id="app" class="app">
<section class="homeHero glass"><span class="eyebrow">THE ETHIOPIAN CANON • 81 BOOKS</span><h1>Hobah</h1><p>Read. Listen. Search. Study.</p></section>
</main>

<dialog id="sheet" class="sheet"><div class="sheetWrap"><section class="sheetCard"><header class="sheetHead"><h2 id="sheetTitle"></h2><button id="sheetClose" class="sheetClose">×</button></header><div id="sheetBody"></div></section></div></dialog>

<section class="audioDock hidden">
<div class="audioTop"><div class="audioMeta"><b id="audioRef">Read aloud</b><small id="audioState">Ready</small></div><div class="audioTransport"><button id="audioPrev">‹</button><button id="audioPlay">▶</button><button id="audioNext">›</button></div><button id="audioClose">×</button></div>
<div class="audioModes"><span>CONTEXT</span><button data-audio-mode="normal">None</button><button data-audio-mode="context">Context</button><button data-audio-mode="advanced">Advanced</button><select id="audioRate"><option value=".8">0.8×</option><option value="1">1×</option><option value="1.15">1.15×</option><option value="1.3">1.3×</option></select><button id="audioAmbient">♫ Ambient</button><button id="audioVoiceToggle">◉ Voice commands</button></div>
</section>

<nav class="bottomNav" aria-label="Main navigation">
<button id="bottomHome"><i>⌂</i><span>Home</span></button>
<button id="bottomBooks"><i>☰</i><span>Books</span></button>
<button id="bottomStudy"><i>✦</i><span>Study</span></button>
<button id="bottomLibrary"><i>♡</i><span>Library</span><em id="bottomLibraryCount" class="navBadge" hidden></em></button>
</nav>
<div id="toast" class="toast"></div>
<script src="/app.js?v=${V}" defer></script>
</body></html>`;
fs.writeFileSync(path.join(D,'index.html'),html);

const manifest={
  name:'Hobah — The Ancient Canon',short_name:'Hobah',start_url:'/?v=66#home',display:'standalone',
  background_color:'#f3efe5',theme_color:'#f3efe5',
  icons:[
    {src:'/hobah-icon-180-v52.png',sizes:'180x180',type:'image/png'},
    {src:'/hobah-favicon-v52.png',sizes:'64x64',type:'image/png'}
  ]
};
fs.writeFileSync(path.join(D,'manifest.webmanifest'),JSON.stringify(manifest));

if(fs.existsSync(path.join(D,'sw.js')))fs.rmSync(path.join(D,'sw.js'));
execFileSync(process.execPath,['--check',path.join(D,'app.js')],{stdio:'inherit'});
console.log('Hobah Release 66: clean single-runtime rebuild complete');
