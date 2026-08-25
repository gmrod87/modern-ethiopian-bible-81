const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f),VERSION='114';
const SOURCE=path.join('ancient-library','book-of-giants-public-domain.json');
const WORK_ID='hobah-book-of-giants';
for(const f of ['release94-ancient-library.js','ancient-works','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release114 missing '+f);
if(!fs.existsSync(SOURCE))throw new Error('Release114 missing Book of Giants source');

function locateShelf(runtime){
  const marker='const PREBUILT_ANCIENT_SHELF=';
  const markerAt=runtime.indexOf(marker);if(markerAt<0)throw new Error('Release114 Ancient shelf marker missing');
  let i=markerAt+marker.length;while(/\s/.test(runtime[i]||''))i++;
  if(runtime[i]!=='[')throw new Error('Release114 Ancient shelf does not begin with JSON array');
  const start=i;let depth=0,inStr=false,escaped=false;
  for(;i<runtime.length;i++){
    const ch=runtime[i];
    if(inStr){if(escaped){escaped=false;continue}if(ch==='\\'){escaped=true;continue}if(ch==='"')inStr=false;continue}
    if(ch==='"'){inStr=true;continue}
    if(ch==='['||ch==='{')depth++;
    else if(ch===']'||ch==='}'){depth--;if(depth===0)return{start,end:i+1,value:JSON.parse(runtime.slice(start,i+1))};}
  }
  throw new Error('Release114 Ancient shelf JSON did not terminate');
}

const work=JSON.parse(fs.readFileSync(SOURCE,'utf8'));
if(work.id!==WORK_ID)throw new Error('Release114 unexpected Book of Giants id '+work.id);
if(work.collection!=='ancient')throw new Error('Release114 Book of Giants must be Ancient Library content');
if(!Array.isArray(work.chapters)||work.chapters.length<10)throw new Error('Release114 Book of Giants fragment edition is unexpectedly short');
if(!/public domain|CC0/i.test(String(work.translation?.license_note||'')))throw new Error('Release114 Book of Giants lacks explicit public-domain/CC0 provenance');
if(/complete ancient copy survives|continuous complete text|canonical scripture/i.test(String(work.about||'')))throw new Error('Release114 Book of Giants metadata overstates the fragmentary witness');

const workDir=p('ancient-works');
fs.writeFileSync(path.join(workDir,WORK_ID+'.json'),JSON.stringify(work));

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
const loc=locateShelf(lib),oldShelf=loc.value;
const item={id:work.id,title:work.title,collection:'ancient',meta:work.meta,chapterCount:work.chapters.length};
const shelf=[item,...oldShelf.filter(x=>String(x.id)!==WORK_ID)];
const shelfJson=JSON.stringify(shelf).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
lib=lib.slice(0,loc.start)+shelfJson+lib.slice(loc.end);
lib=lib.replace(/const LIB_VERSION='\d+';/,`const LIB_VERSION='${VERSION}';`);
fs.writeFileSync(p('release94-ancient-library.js'),lib);

let app=fs.readFileSync(p('app.js'),'utf8');
app=app.replace(/const V='\d+';/,`const V='${VERSION}';`);
fs.writeFileSync(p('app.js'),app);

let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace(/\?v=113\b/g,'?v=114');
fs.writeFileSync(p('index.html'),html);

if(fs.existsSync(p('manifest.webmanifest'))){
  const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));
  m.start_url='/?v=114#home';
  fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m));
}

if(fs.existsSync(p('rights-audit.json'))){
  const audit=JSON.parse(fs.readFileSync(p('rights-audit.json'),'utf8'));
  audit.release=114;
  audit.ancient_library=audit.ancient_library||{};
  audit.ancient_library.book_of_giants={
    id:WORK_ID,
    status:'newly-prepared-public-domain-direct-translation',
    license:'CC0 1.0 public-domain dedication',
    source_language:'Aramaic',
    fragmentary:true,
    chapters_or_fragment_sections:work.chapters.length,
    note:'No complete Book of Giants manuscript survives; production text preserves fragment boundaries and marks losses.'
  };
  fs.writeFileSync(p('rights-audit.json'),JSON.stringify(audit,null,2));
}
fs.writeFileSync(p('BOOK_OF_GIANTS_PROVENANCE.txt'),`Book of Giants — Hobah Release 114\n\nCollection: Ancient Library (not the Ethiopian 81-book canon)\nSource language: Aramaic\nWitness status: fragmentary Dead Sea Scroll manuscripts; no complete ancient copy survives\nEnglish edition: newly prepared Hobah direct fragment translation\nRights: ancient source is public domain; new English wording is dedicated to the public domain under CC0 1.0\nEditorial rule: lacunae remain marked and missing narrative is not silently reconstructed\n`);

if(!fs.existsSync(path.join(workDir,WORK_ID+'.json')))throw new Error('Release114 work file was not written');
if(!shelf.some(x=>String(x.id)===WORK_ID))throw new Error('Release114 shelf entry missing');
if(!lib.includes("const LIB_VERSION='114';"))throw new Error('Release114 Ancient Library cache version missing');
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log(`Hobah Release 114: Book of Giants added to Ancient Library as ${work.chapters.length} direct Aramaic fragment sections; canon remains unchanged`);
