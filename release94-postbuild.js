const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist';
if(!fs.existsSync(path.join(D,'index.html')))throw new Error('Release 94 requires an existing Hobah dist build');
for(const f of ['release94-ancient-library.js','release94-ancient-library.css'])fs.copyFileSync(f,path.join(D,f));

const manifest=path.join('ancient-library','output','ancient_library_complete_manifest.json');
const target=path.join(D,'ancient-library.json');
const signedCI=process.env.GITHUB_ACTIONS==='true';

// The App Store/TestFlight build already runs in GitHub Actions. Generate the
// source-controlled historical corpus there so the native bundle contains the
// complete full text offline, without changing any Study AI or Listen code.
if(signedCI&&!fs.existsSync(manifest)){
  console.log('Release 94: generating full Ancient Library corpus for native build…');
  execFileSync('python3',['-m','pip','install','--disable-pip-version-check','--user','requests','beautifulsoup4','lxml'],{stdio:'inherit'});
  execFileSync('python3',[path.join('ancient-library','build_app_manifest.py')],{stdio:'inherit'});
}

if(fs.existsSync(manifest)){
  const parsed=JSON.parse(fs.readFileSync(manifest,'utf8'));
  const count=Array.isArray(parsed.sections)?parsed.sections.length:0;
  const chars=Number(parsed.total_characters||parsed.sections?.reduce((n,s)=>n+Number(s.chars||0),0)||0);
  if(count<25)throw new Error(`Release 94 Ancient Library manifest is unexpectedly small: ${count} sections`);
  if(signedCI&&(count<180||chars<10000000))throw new Error(`Refusing App Store build with incomplete Ancient Library: ${count} sections / ${chars} characters`);
  fs.copyFileSync(manifest,target);
  console.log(`Release 94: verified and bundled ${count} Ancient Library texts/sections (${chars.toLocaleString()} characters)`);
}else{
  // Local/web builds remain usable without downloading the research corpus.
  // Signed App Store CI never reaches this branch because generation above is mandatory.
  fs.writeFileSync(target,JSON.stringify({title:'The Ancient Canon - Ancient Library',edition:'local build fallback',section_count:0,sections:[]}));
  console.warn('Release 94: Ancient Library corpus not generated in this local build.');
}

let html=fs.readFileSync(path.join(D,'index.html'),'utf8');
if(!html.includes('release94-ancient-library.css'))html=html.replace('</head>','<link rel="stylesheet" href="/release94-ancient-library.css?v=94">\n</head>');
if(!html.includes('release94-ancient-library.js'))html=html.replace('</body>','<script src="/release94-ancient-library.js?v=94" defer></script>\n</body>');
fs.writeFileSync(path.join(D,'index.html'),html);
execFileSync(process.execPath,['--check',path.join(D,'release94-ancient-library.js')],{stdio:'inherit'});
console.log('Hobah Release 94: Books hub and Ancient Library layer applied');
