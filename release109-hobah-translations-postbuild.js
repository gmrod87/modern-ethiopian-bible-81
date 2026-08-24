const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
const sourceDir=path.join('ancient-library','hobah-translations');
const target=p('ancient-library.json');
if(!fs.existsSync(target))throw new Error('Release109 requires dist/ancient-library.json');
if(!fs.existsSync(sourceDir))throw new Error('Release109 missing ancient-library/hobah-translations');

const manifest=JSON.parse(fs.readFileSync(target,'utf8'));
if(!Array.isArray(manifest.sections))manifest.sections=[];
const files=fs.readdirSync(sourceDir).filter(f=>f.endsWith('.json')).sort();
if(files.length<17)throw new Error(`Release109 expected at least 17 Hobah translation files; found ${files.length}`);

const works=[];
for(const file of files){
  const work=JSON.parse(fs.readFileSync(path.join(sourceDir,file),'utf8'));
  if(!work||!work.id||!work.title||!Array.isArray(work.chapters)||!work.chapters.length)throw new Error(`Release109 invalid translation file: ${file}`);
  if(!work.translation||!work.translation.method||!work.translation.status)throw new Error(`Release109 missing translation provenance: ${file}`);
  works.push(work);
}

const ids=new Set(works.map(w=>w.id));
manifest.sections=manifest.sections.filter(s=>{
  const src=String(s.source||'');
  const m=src.match(/^hobah-translation:([^#]+)(?:#.*)?$/);
  return !m||!ids.has(m[1]);
});

let added=0,totalChars=0;
for(const work of works){
  const group=work.group==='dead-sea-scrolls'?'Dead Sea Scrolls':'Ancient writings';
  const part=`I. Forgotten Ancient Writings — ${group} — Hobah Translation`;
  const sourceNote=[
    `Hobah Translation: ${work.title}.`,
    `Base witness / edition: ${work.translation.base_text}.`,
    `Method: ${work.translation.method}.`,
    `Status: ${work.translation.status}.`,
    work.translation.license_note||''
  ].filter(Boolean).join(' ');
  work.chapters.forEach((c,i)=>{
    const n=c.number??(i+1);
    const label=c.label||`Chapter ${n}`;
    const text=String(c.text||'').trim();
    if(text.length<40)throw new Error(`Release109 ${work.id} ${label} is unexpectedly short`);
    manifest.sections.push({
      part,
      title:`${work.title} — Section ${i+1}`,
      text,
      source:`hobah-translation:${work.id}#${i+1}`,
      provenance:sourceNote,
      status:work.translation.status,
      notes:[
        `Hobah Research Translation. ${work.about||''}`,
        `Section label: ${label}.`,
        work.translation.notes||'',
        work.translation.confidence?`Translation confidence: ${work.translation.confidence}.`:''
      ].filter(Boolean).join(' '),
      chars:text.length
    });
    added++;totalChars+=text.length;
  });
}

manifest.hobah_translation_edition={
  version:'109',
  works:works.map(w=>({id:w.id,title:w.title,group:w.group||'ancient-writings',sections:w.chapters.length,status:w.translation.status,base_text:w.translation.base_text,method:w.translation.method,confidence:w.translation.confidence||'not stated'})),
  generated_at:new Date().toISOString(),
  editorial_policy:'Fresh Hobah modern-English research translations/renderings are kept distinct from historical translations. Lacunae, restorations, recension choices and uncertain readings are preserved or disclosed in work metadata; no modern copyrighted English translation is copied.'
};
manifest.section_count=manifest.sections.length;
manifest.total_characters=manifest.sections.reduce((n,s)=>n+Number(s.chars||String(s.text||'').length),0);
fs.writeFileSync(target,JSON.stringify(manifest));
console.log(`Hobah Release 109 translations: ${works.length} works / ${added} sections / ${totalChars.toLocaleString()} translated characters merged`);
