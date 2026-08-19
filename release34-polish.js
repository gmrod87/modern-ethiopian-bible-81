const fs=require('fs');

const release='35';
const styles='dist/styles.css';
if(fs.existsSync(styles)){
  fs.appendFileSync(styles,`
/* Release ${release}: stripped-back cream + red-brown frosted UI */
:root{
  --cream:#f3ead8;
  --cream-2:#fbf5e9;
  --brown:#3b261c;
  --red-brown:#7b3024;
  --red-brown-soft:#985044;
  --glass:rgba(255,248,236,.72);
  --glass-strong:rgba(255,248,236,.88);
  --glass-line:rgba(83,48,35,.16);
  --line:rgba(83,48,35,.16)!important;
  --paper:#fbf5e9!important;
  --ink:#3b261c!important;
}
html,body{background:var(--cream)!important;color:var(--brown)!important;overscroll-behavior-y:none}
body{background-image:none!important}
button,a,[role="button"]{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
img,svg{max-width:100%}

/* Remove ornamental artwork and decorative frame layers. */
.the81Artwork,.bookArtwork,[class*="book-art"],[class*="bookArt"]{display:none!important}
.bookHero img,.bookHero svg,.the81Hero img,.the81Hero svg{display:none!important}
.bookHero::before,.bookHero::after,.bookArt::before,.bookArt::after,.the81Hero::before,.the81Hero::after,.the81Artwork::before,.the81Artwork::after,.bookArtwork::before,.bookArtwork::after,[class*="book-art"]::before,[class*="book-art"]::after,[class*="bookArt"]::before,[class*="bookArt"]::after{content:none!important;display:none!important}
.bookHero,.bookArt,.the81Hero{background:transparent!important;background-image:none!important;box-shadow:none!important;border-image:none!important;filter:none!important}

/* Frosted surfaces, deliberately flat and quiet. */
.topbar,.searchbar,.drawer,.readerTools,.audioBar,.modal,.sheet,.panel,.card,.feelingCard,.studyAvailable{
  background:var(--glass)!important;
  border-color:var(--glass-line)!important;
  box-shadow:0 8px 28px rgba(59,38,28,.07)!important;
  -webkit-backdrop-filter:blur(18px) saturate(1.05);
  backdrop-filter:blur(18px) saturate(1.05);
}
.topbar{border-bottom:1px solid var(--glass-line)!important}
.searchbar{border-bottom:1px solid var(--glass-line)!important}
.drawer{background:var(--glass-strong)!important}

/* Keep the palette cream, brown and restrained red-brown only. */
a,.link,.vnum,.chapterNo,.bookNo{color:var(--red-brown)!important}
button,.round,.chip,.pill,.readerTools button,.searchbar button{color:var(--brown)!important}
button.active,.chip.active,.pill.active,[aria-pressed="true"]{color:#fff8ec!important;background:var(--red-brown)!important;border-color:var(--red-brown)!important}
input,select,textarea{background:rgba(255,250,241,.78)!important;color:var(--brown)!important;border-color:var(--glass-line)!important;box-shadow:none!important}

/* Clean typography and reduced decoration. */
*{text-shadow:none!important}
h1,h2,h3,h4,.brand b{color:var(--brown)!important}
hr{border-color:var(--glass-line)!important}
.verse{contain:layout style paint;content-visibility:auto;contain-intrinsic-size:1px 34px}

/* Header/home: same frosted language as every other control. */
#homeBtn,.topbar #homeBtn,.topbar .round{
  background:rgba(255,248,236,.48)!important;
  color:var(--brown)!important;
  border:1px solid var(--glass-line)!important;
  box-shadow:none!important;
  -webkit-backdrop-filter:blur(14px)!important;
  backdrop-filter:blur(14px)!important;
}
#homeBtn:hover,.topbar .round:hover{background:rgba(255,248,236,.72)!important}

@media(max-width:900px){
  html,body{background:var(--cream)!important}
  .topbar{background:rgba(243,234,216,.78)!important;box-shadow:none!important}
  .searchbar{background:rgba(243,234,216,.82)!important}
  .topbar #homeBtn{position:static!important;inset:auto!important;left:auto!important;top:auto!important;transform:none!important;z-index:auto!important;flex:0 0 auto!important;width:88px!important;min-width:88px!important;max-width:88px!important;height:42px!important;min-height:42px!important;margin:0!important;padding:0 10px!important}
  .topbar #homeBtn .mobileHomeText{color:var(--brown)!important;font-size:10px!important}
  .topbar #homeBtn .mobileHomeIcon{font-size:18px!important}
  .topbar .round{background:rgba(255,248,236,.34)!important}
}

@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
`);
}

/* Neutralise the old ornate theme stylesheet without deleting functional selectors. */
const themeCss='dist/the81-fast.css';
if(fs.existsSync(themeCss)){
  fs.appendFileSync(themeCss,`
/* Release ${release}: artwork removed */
.the81Artwork,.bookArtwork,[class*="book-art"],[class*="bookArt"]{display:none!important}
.the81Hero{background:transparent!important;background-image:none!important;min-height:0!important;box-shadow:none!important}
.the81Hero::before,.the81Hero::after{content:none!important;display:none!important}
`);
}

const htmlPath='dist/index.html';
if(fs.existsSync(htmlPath)){
  let html=fs.readFileSync(htmlPath,'utf8');
  html=html.replace(/<meta name="theme-color" content="[^"]*"\s*\/?\s*>/i,'<meta name="theme-color" content="#f3ead8" />');
  if(/<meta name="apple-mobile-web-app-status-bar-style"/i.test(html)) html=html.replace(/<meta name="apple-mobile-web-app-status-bar-style" content="[^"]*"\s*\/?\s*>/i,'<meta name="apple-mobile-web-app-status-bar-style" content="default" />');
  else html=html.replace('</head>','  <meta name="apple-mobile-web-app-status-bar-style" content="default" />\n</head>');
  html=html.replace(/\?v=\d+/g,`?v=${release}`);
  fs.writeFileSync(htmlPath,html);
}

const manifestPath='dist/manifest.webmanifest';
if(fs.existsSync(manifestPath)){
  try{const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));m.theme_color='#f3ead8';m.background_color='#f3ead8';fs.writeFileSync(manifestPath,JSON.stringify(m))}catch{}
}

const swPath='dist/sw.js';
if(fs.existsSync(swPath)){
  let sw=fs.readFileSync(swPath,'utf8');
  sw=sw.replace(/const V=['"][^'"]+['"]/,`const V='the81-v${release}-cream-frosted'`);
  fs.writeFileSync(swPath,sw);
}
