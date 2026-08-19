const fs=require('fs');
const {execFileSync}=require('child_process');
const D='dist';
const read=f=>fs.existsSync(`${D}/${f}`)?fs.readFileSync(`${D}/${f}`,'utf8'):'';
const write=(f,s)=>fs.writeFileSync(`${D}/${f}`,s);

const base=read('hobah-v52.css');
if(!base)throw new Error('Release53: dist/hobah-v52.css missing');
const polish=fs.readFileSync('release53-reader-contrast.css','utf8');
write('hobah-v53.css',`${base}\n\n/* release53-reader-contrast.css */\n${polish}\n`);

let html=read('index.html');
if(!html)throw new Error('Release53: dist/index.html missing');
html=html.replace(/\/hobah-v52\.css(?:\?v=\d+)?/g,'/hobah-v53.css?v=53');
write('index.html',html);

let sw=read('sw.js');
if(sw){
  sw=sw
    .replace(/hobah-v52-fast/g,'hobah-v53-reader-polish')
    .replace(/hobah-core-v52/g,'hobah-core-v53')
    .replace(/hobah-data-v52/g,'hobah-data-v53')
    .replace(/\/hobah-v52\.css/g,'/hobah-v53.css?v=53');
  write('sw.js',sw);
}

for(const f of ['dist/app.js','dist/feature-loader.js','dist/sw.js']){
  if(fs.existsSync(f))execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
}
console.log('Hobah Release 53 reader contrast and header polish applied');
