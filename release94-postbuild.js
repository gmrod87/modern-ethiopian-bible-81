const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='95';
if(!fs.existsSync(path.join(D,'index.html')))throw new Error('Release 95 requires an existing Hobah dist build');
for(const f of ['release94-ancient-library.js','release94-ancient-library.css'])fs.copyFileSync(f,path.join(D,f));

const manifest=path.join('ancient-library','output','ancient_library_complete_manifest.json');
const target=path.join(D,'ancient-library.json');
const signedCI=process.env.GITHUB_ACTIONS==='true';
const PINNED_MANIFEST_URL='https://raw.githubusercontent.com/gmrod87/modern-ethiopian-bible-81/268a94b7c3a1197b7574415106fcd88107d5bc7c/ancient-library/output/ancient_library_complete_manifest.json';

if(signedCI&&!fs.existsSync(manifest)){
  fs.mkdirSync(path.dirname(manifest),{recursive:true});
  console.log('Release 95: downloading frozen audited Ancient Library corpus…');
  execFileSync('curl',['-L','--fail','--retry','3','--silent','--show-error',PINNED_MANIFEST_URL,'-o',manifest],{stdio:'inherit'});
}

if(fs.existsSync(manifest)){
  const parsed=JSON.parse(fs.readFileSync(manifest,'utf8'));
  const sections=Array.isArray(parsed.sections)?parsed.sections:[];
  const count=sections.length;
  const chars=Number(parsed.total_characters||parsed.total_chars||sections.reduce((n,s)=>n+Number(s.chars||String(s.text||'').length),0));
  if(count<25)throw new Error(`Release 95 Ancient Library manifest is unexpectedly small: ${count} sections`);
  if(signedCI&&(count<180||chars<10000000))throw new Error(`Refusing App Store build with incomplete Ancient Library: ${count} sections / ${chars} characters`);
  fs.copyFileSync(manifest,target);
  console.log(`Release 95: verified and bundled ${count} Ancient Library texts/sections (${chars.toLocaleString()} characters)`);
}else{
  fs.writeFileSync(target,JSON.stringify({title:'The Ancient Canon - Ancient Library',edition:'local build fallback',section_count:0,sections:[]}));
  console.warn('Release 95: Ancient Library corpus not bundled in this local preview build.');
}

let html=fs.readFileSync(path.join(D,'index.html'),'utf8');
html=html.replace(/release94-ancient-library\.css\?v=\d+/g,`release94-ancient-library.css?v=${V}`);
html=html.replace(/release94-ancient-library\.js\?v=\d+/g,`release94-ancient-library.js?v=${V}`);
if(!html.includes('release94-ancient-library.css'))html=html.replace('</head>',`<link rel="stylesheet" href="/release94-ancient-library.css?v=${V}">\n</head>`);
if(!html.includes('release94-ancient-library.js'))html=html.replace('</body>',`<script src="/release94-ancient-library.js?v=${V}" defer></script>\n</body>`);
fs.writeFileSync(path.join(D,'index.html'),html);
execFileSync(process.execPath,['--check',path.join(D,'release94-ancient-library.js')],{stdio:'inherit'});
console.log('Hobah Release 95: fixed Books sidebar and clean Ancient Library reader applied');