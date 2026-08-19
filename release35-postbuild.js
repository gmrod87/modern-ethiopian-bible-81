const fs=require('fs');
const release='35';
for(const f of ['release35.css','release35-runtime.js'])if(fs.existsSync(f))fs.copyFileSync(f,'dist/'+f);
const htmlPath='dist/index.html';
if(fs.existsSync(htmlPath)){
  let html=fs.readFileSync(htmlPath,'utf8');
  html=html.replace(/\?v=33/g,`?v=${release}`);
  html=html.replace(/<meta name="theme-color" content="[^"]*"\s*\/?\s*>/i,'<meta name="theme-color" content="#718e93" />');
  if(!html.includes('/release35.css'))html=html.replace('</head>',`  <link rel="stylesheet" href="/release35.css?v=${release}" />\n</head>`);
  if(!html.includes('/release35-runtime.js'))html=html.replace('</body>',`  <script src="/release35-runtime.js?v=${release}"></script>\n</body>`);
  fs.writeFileSync(htmlPath,html);
}
const manifest='dist/manifest.webmanifest';
if(fs.existsSync(manifest))try{const m=JSON.parse(fs.readFileSync(manifest,'utf8'));m.theme_color='#718e93';m.background_color='#718e93';fs.writeFileSync(manifest,JSON.stringify(m))}catch{}
const sw='dist/sw.js';
if(fs.existsSync(sw)){let s=fs.readFileSync(sw,'utf8');s=s.replace(/const V=['"][^'"]+['"]/,"const V='the81-v35-ornate-header-fixed'");fs.writeFileSync(sw,s)}
for(const f of ['dist/release35-runtime.js'])require('child_process').execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
console.log('The 81 Release 35 applied: final mobile Home fix + illuminated book art');
