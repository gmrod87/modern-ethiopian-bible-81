const fs=require('fs');

const release='34';
const styles='dist/styles.css';
if(fs.existsSync(styles)){
  fs.appendFileSync(styles,`\n/* Release ${release}: mobile polish + ornate presentation */\n:root{--r34-glass:rgba(255,255,255,.10);--r34-glass-line:rgba(255,255,255,.42)}\nhtml,body{overscroll-behavior-y:none}\nbutton,a,[role="button"]{touch-action:manipulation;-webkit-tap-highlight-color:transparent}\nimg,svg{max-width:100%}\n@media(max-width:900px){\n  html,body{background:#91aaa9!important}\n  .topbar{background:rgba(130,159,160,.82)!important;border-bottom:1px solid rgba(255,255,255,.22)!important;box-shadow:none!important;-webkit-backdrop-filter:blur(18px) saturate(1.08);backdrop-filter:blur(18px) saturate(1.08)}\n  .topbar #homeBtn{position:static!important;inset:auto!important;left:auto!important;top:auto!important;transform:none!important;z-index:auto!important;flex:0 0 auto!important;width:92px!important;min-width:92px!important;max-width:92px!important;height:42px!important;min-height:42px!important;margin:0!important;padding:0 11px!important;background:transparent!important;border:1px solid rgba(255,255,255,.46)!important;box-shadow:none!important;color:inherit!important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}\n  .topbar #homeBtn .mobileHomeText{color:inherit!important;font-size:10px!important}\n  .topbar #homeBtn .mobileHomeIcon{font-size:18px!important}\n  .topbar .round{background:transparent!important;border-color:rgba(255,255,255,.46)!important;box-shadow:none!important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}\n  .searchbar{background:rgba(239,241,232,.92)!important;-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}\n}\n/* Keep decorative artwork rich while avoiding costly full-screen animation/filters. */\n.bookHero,.bookArt,.the81Artwork,.bookArtwork,[class*="book-art"],[class*="bookArt"]{position:relative;isolation:isolate}\n.bookHero::after,.bookArt::after,.the81Artwork::after,.bookArtwork::after,[class*="book-art"]::after,[class*="bookArt"]::after{content:"";position:absolute;inset:10px;pointer-events:none;border:1px solid rgba(104,69,31,.42);border-radius:inherit;box-shadow:inset 0 0 0 4px rgba(244,225,190,.13),inset 0 0 34px rgba(53,34,18,.12);z-index:4}\n.bookHero svg,.bookArt svg,.the81Artwork svg,.bookArtwork svg,[class*="book-art"] svg,[class*="bookArt"] svg{filter:sepia(.22) contrast(1.08) saturate(.86);transform:translateZ(0)}\n.bookHero:before,.bookArt:before,.the81Artwork:before,.bookArtwork:before{background-image:radial-gradient(circle at 18% 15%,rgba(255,244,212,.22),transparent 24%),linear-gradient(135deg,rgba(81,49,23,.10),transparent 40%,rgba(255,241,205,.12))!important}\n/* Less main-thread paint work on long Bible chapters. */\n.verse{contain:layout style paint;content-visibility:auto;contain-intrinsic-size:1px 34px}\n@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}\n`);
}

const themeCss='dist/the81-fast.css';
if(fs.existsSync(themeCss)){
  fs.appendFileSync(themeCss,`\n/* Release ${release}: engraved-frame treatment */\n.the81Hero{overflow:hidden}\n.the81Hero:before{opacity:.92!important}\n@media(max-width:900px){.the81Hero{min-height:min(72svh,680px)!important}}\n`);
}

const htmlPath='dist/index.html';
if(fs.existsSync(htmlPath)){
  let html=fs.readFileSync(htmlPath,'utf8');
  html=html.replace(/<meta name="theme-color" content="[^"]*"\s*\/?\s*>/i,'<meta name="theme-color" content="#91aaa9" />');
  if(/<meta name="apple-mobile-web-app-status-bar-style"/i.test(html))html=html.replace(/<meta name="apple-mobile-web-app-status-bar-style" content="[^"]*"\s*\/?\s*>/i,'<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
  else html=html.replace('</head>','  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n</head>');
  html=html.replace(/\?v=33/g,`?v=${release}`);
  fs.writeFileSync(htmlPath,html);
}

const manifestPath='dist/manifest.webmanifest';
if(fs.existsSync(manifestPath)){
  try{const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));m.theme_color='#91aaa9';m.background_color='#91aaa9';fs.writeFileSync(manifestPath,JSON.stringify(m))}catch{}
}

const swPath='dist/sw.js';
if(fs.existsSync(swPath)){
  let sw=fs.readFileSync(swPath,'utf8');
  sw=sw.replace(/const V=['"][^'"]+['"]/,`const V='the81-v${release}-smooth-mobile'`);
  fs.writeFileSync(swPath,sw);
}
