const fs=require('fs');
const {execFileSync}=require('child_process');
const D='dist';
const read=f=>fs.existsSync(`${D}/${f}`)?fs.readFileSync(`${D}/${f}`,'utf8'):'';
const write=(f,s)=>fs.writeFileSync(`${D}/${f}`,s);

/*
  Release 54 deliberately rebuilds the production stylesheet from the functional
  component styles plus ONE unified visual system. Old release skins (47–53)
  are not included in the linked production CSS, so they can no longer fight
  over color, spacing, controls, header geometry or contrast.
*/
const functional=[
  'styles.css',
  'study.css',
  'study-hub.css',
  'research-suite.css',
  'chronology.css',
  'experience.css',
  'read-aloud-v2.css'
];
for(const f of functional){if(!fs.existsSync(`${D}/${f}`))throw new Error(`Release54: dist/${f} missing`)}
const unified=fs.readFileSync('release54-unified-ui.css','utf8');
const bundle=[
  '/* Hobah Release 54 production bundle — functional CSS + unified UI only */',
  ...functional.map(f=>`\n/* functional: ${f} */\n${read(f)}`),
  `\n/* unified visual system */\n${unified}`
].join('\n');
write('hobah-v54.css',bundle);

let html=read('index.html');
if(!html)throw new Error('Release54: dist/index.html missing');
html=html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/g,'');
html=html.replace('</head>','  <link rel="stylesheet" href="/hobah-v54.css?v=54" />\n</head>');
html=html.replace(/<meta name=["']theme-color["'] content=["'][^"']*["']\s*\/>/,'<meta name="theme-color" content="#F5F2EB" />');
write('index.html',html);

let sw=read('sw.js');
if(sw){
  sw=sw
    .replace(/hobah-v\d+(?:-[a-z0-9-]+)?/gi,'hobah-v54-unified-ui')
    .replace(/hobah-core-v\d+/gi,'hobah-core-v54')
    .replace(/hobah-data-v\d+/gi,'hobah-data-v54')
    .replace(/\/hobah-v\d+\.css(?:\?v=\d+)?/g,'/hobah-v54.css?v=54');
  if(!sw.includes('/hobah-v54.css?v=54')){
    sw=sw.replace("'/index.html'","'/index.html','/hobah-v54.css?v=54'");
  }
  write('sw.js',sw);
}

for(const f of ['dist/app.js','dist/feature-loader.js','dist/sw.js']){
  if(fs.existsSync(f))execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
}

console.log('Hobah Release 54 unified UI bundle applied; legacy visual skins excluded from production CSS');
