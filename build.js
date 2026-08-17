const {execFileSync}=require('child_process');
const fs=require('fs');
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
execFileSync('tar',['-xzf','native-bible-app.tar.gz','-C','dist'],{stdio:'inherit'});

fs.copyFileSync('study-v2.js','dist/study.js');
fs.copyFileSync('study.css','dist/study.css');
const dataFiles=fs.readdirSync('.').filter(x=>/^study-data-\d+\.js$/.test(x)).sort();
for(const f of dataFiles) fs.copyFileSync(f,`dist/${f}`);

let html=fs.readFileSync('dist/index.html','utf8');
if(!html.includes('/study.css')) html=html.replace('</head>','  <link rel="stylesheet" href="/study.css" />\n</head>');
if(!html.includes('/study.js')){
  const scripts=dataFiles.map(f=>`  <script src="/${f}"></script>`).join('\n')+'\n  <script src="/study.js"></script>\n';
  html=html.replace('</body>',scripts+'</body>');
}
fs.writeFileSync('dist/index.html',html);

const swPath='dist/sw.js';
if(fs.existsSync(swPath)){
  let sw=fs.readFileSync(swPath,'utf8');
  sw=sw.replace(/const V=['"][^'"]+['"]/,"const V='meb-native-v4-study'");
  const add=['/study.js','/study.css',...dataFiles.map(f=>'/'+f)];
  sw=sw.replace("'/manifest.webmanifest'",`'/manifest.webmanifest',${add.map(x=>`'${x}'`).join(',')}`);
  fs.writeFileSync(swPath,sw);
}
console.log(`Native 81-book Bible app + historical study layer built (${dataFiles.length} study data parts)`);
