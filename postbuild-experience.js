const {execFileSync}=require('child_process');
const fs=require('fs');
const release='25';
for(const f of ['experience.js','experience.css','ambient-audio.js'])fs.copyFileSync(f,'dist/'+f);
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/\?v=\d+/g,`?v=${release}`);
if(!html.includes('/experience.css'))html=html.replace('</head>',`  <link rel="stylesheet" href="/experience.css?v=${release}" />\n</head>`);
if(!html.includes('/experience.js')){
  const chrono=html.match(/\s*<script src="\/chronology\.js\?v=\d+"><\/script>/);
  const scripts=`\n  <script src="/experience.js?v=${release}"></script>\n  <script src="/ambient-audio.js?v=${release}"></script>`;
  if(chrono)html=html.replace(chrono[0],scripts+chrono[0]);else html=html.replace('</body>',scripts+'\n</body>');
}
fs.writeFileSync('dist/index.html',html);
for(const f of ['dist/experience.js','dist/ambient-audio.js'])execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
const swPath='dist/sw.js';
if(fs.existsSync(swPath)){
  let sw=fs.readFileSync(swPath,'utf8');
  sw=sw.replace(/const V=['"][^'"]+['"]/,`const V='meb-native-v${release}-feelings-ambient'`);
  if(!sw.includes("'/experience.js'"))sw=sw.replace("'/manifest.webmanifest'","'/manifest.webmanifest','/experience.js','/experience.css','/ambient-audio.js'");
  fs.writeFileSync(swPath,sw);
}
console.log('Modern Ethiopian Bible experience release '+release+' applied');
