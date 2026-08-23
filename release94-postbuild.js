const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist';
if(!fs.existsSync(path.join(D,'index.html')))throw new Error('Release 94 requires an existing Hobah dist build');
for(const f of ['release94-ancient-library.js','release94-ancient-library.css'])fs.copyFileSync(f,path.join(D,f));
const manifest=path.join('ancient-library','output','ancient_library_complete_manifest.json');
const target=path.join(D,'ancient-library.json');
if(fs.existsSync(manifest)){
  fs.copyFileSync(manifest,target);
  const parsed=JSON.parse(fs.readFileSync(target,'utf8'));
  if(!Array.isArray(parsed.sections)||parsed.sections.length<25)throw new Error('Release 94 Ancient Library manifest is unexpectedly small');
  console.log(`Release 94: bundled ${parsed.sections.length} Ancient Library texts/sections`);
}else{
  fs.writeFileSync(target,JSON.stringify({title:'The Ancient Canon - Ancient Library',edition:'build-time fallback',section_count:0,sections:[]}));
  console.warn('Release 94: source manifest not present; wrote empty fallback. App Store workflow generates the complete corpus before build.');
}
let html=fs.readFileSync(path.join(D,'index.html'),'utf8');
if(!html.includes('release94-ancient-library.css'))html=html.replace('</head>','<link rel="stylesheet" href="/release94-ancient-library.css?v=94">\n</head>');
if(!html.includes('release94-ancient-library.js'))html=html.replace('</body>','<script src="/release94-ancient-library.js?v=94" defer></script>\n</body>');
fs.writeFileSync(path.join(D,'index.html'),html);
execFileSync(process.execPath,['--check',path.join(D,'release94-ancient-library.js')],{stdio:'inherit'});
console.log('Hobah Release 94: Books hub and Ancient Library layer applied');
