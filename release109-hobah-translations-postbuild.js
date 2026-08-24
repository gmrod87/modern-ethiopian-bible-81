const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
const sourceDir=path.join('ancient-library','hobah-translations');
const target=p('ancient-library.json');
if(!fs.existsSync(target))throw new Error('Release109 requires dist/ancient-library.json');
if(!fs.existsSync(sourceDir))throw new Error('Release109 missing ancient-library/hobah-translations');

const manifest=JSON.parse(fs.readFileSync(target,'utf8'));
if(!Array.isArray(manifest.sections))manifest.sections=[];
const originalSections=[...manifest.sections];
const files=fs.readdirSync(sourceDir).filter(f=>f.endsWith('.json')).sort();
if(files.length<17)throw new Error(`Release109 expected at least 17 Hobah translation files; found ${files.length}`);

function preserveCase(from,to){
  if(from===from.toUpperCase())return to.toUpperCase();
  if(from[0]===from[0].toUpperCase())return to[0].toUpperCase()+to.slice(1);
  return to;
}
function modernizeHistoricalEnglish(input){
  let s=String(input||'').replace(/\r/g,'');
  const words={
    thou:'you',thee:'you',thy:'your',thine:'yours',ye:'you',
    art:'are',hast:'have',hath:'has',dost:'do',doth:'does',
    shalt:'shall',wilt:'will',wouldst:'would',shouldst:'should',couldst:'could',
    canst:'can',mayst:'may',mightest:'might',
    saith:'says',sayest:'say',saidst:'said',spakest:'spoke',
    knowest:'know',knoweth:'knows',seest:'see',seeth:'sees',
    makest:'make',maketh:'makes',doest:'do',goest:'go',goeth:'goes',
    comest:'come',cometh:'comes',givest:'give',giveth:'gives',
    takest:'take',taketh:'takes',hastenedst:'hastened',
    didst:'did',wert:'were',wast:'were',beholdest:'behold',
    whosoever:'whoever',whatsoever:'whatever',wherefore:'therefore',
    unto:'to',amongst:'among',whilst:'while',towards:'toward'
  };
  const keys=Object.keys(words).sort((a,b)=>b.length-a.length);
  for(const k of keys){
    const re=new RegExp(`\\b${k.replace(/ /g,'\\s+')}\\b`,'gi');
    s=s.replace(re,m=>preserveCase(m,words[k]));
  }
  // Keep this deliberately conservative: it is a modernization of a PD witness,
  // not an attempt to reconstruct the ancient source through automated grammar edits.
  s=s.replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n');
  return s.trim();
}
function fetchRemoteText(url){
  const txt=execFileSync('curl',['-L','--fail','--retry','3','--retry-delay','1','--silent','--show-error',url],{encoding:'utf8',maxBuffer:80*1024*1024});
  return String(txt||'').replace(/\r/g,'');
}
function regexMatches(text,pattern,flags='i'){
  const safeFlags=flags.includes('g')?flags:flags+'g',re=new RegExp(pattern,safeFlags),out=[];let m;
  while((m=re.exec(text))){out.push(m);if(m[0]==='')re.lastIndex++}
  return out;
}
function sliceRemote(text,d){
  let out=text;
  if(d.start_regex){
    const matches=regexMatches(out,d.start_regex,d.flags||'i');
    if(!matches.length)throw new Error(`Release109 remote start marker not found: ${d.start_regex}`);
    const m=d.start_occurrence==='last'?matches[matches.length-1]:matches[Number(d.start_occurrence||0)]||matches[0];
    out=out.slice(m.index+(d.include_start===false?m[0].length:0));
  }
  if(d.end_regex){
    const re=new RegExp(d.end_regex,d.flags||'i'),m=re.exec(out);
    if(!m)throw new Error(`Release109 remote end marker not found: ${d.end_regex}`);
    out=out.slice(0,m.index+(d.include_end?m[0].length:0));
  }
  return out.trim();
}

const works=[];
for(const file of files){
  const work=JSON.parse(fs.readFileSync(path.join(sourceDir,file),'utf8'));
  if(!work||!work.id||!work.title)throw new Error(`Release109 invalid translation file: ${file}`);
  if(!work.translation||!work.translation.method||!work.translation.status)throw new Error(`Release109 missing translation provenance: ${file}`);
  if((!Array.isArray(work.chapters)||!work.chapters.length)&&!work.derive_from_manifest&&!work.derive_from_remote_public_domain)throw new Error(`Release109 ${file} needs chapters, derive_from_manifest, or derive_from_remote_public_domain`);
  works.push(work);
}

const ids=new Set(works.map(w=>w.id));
manifest.sections=manifest.sections.filter(s=>{
  const src=String(s.source||'');
  const m=src.match(/^hobah-translation:([^#]+)(?:#.*)?$/);
  return !m||!ids.has(m[1]);
});

let added=0,totalChars=0;
const produced=[];
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

  let chapters=Array.isArray(work.chapters)?work.chapters:[];
  if(work.derive_from_manifest){
    const d=work.derive_from_manifest,re=new RegExp(d.title_regex,d.flags||'i');
    const matches=originalSections.filter(s=>re.test(String(s.title||'')));
    if(!matches.length)throw new Error(`Release109 could not derive ${work.id}; no historical sections match ${d.title_regex}`);
    chapters=matches.map((s,i)=>({number:i+1,label:`Historical section ${i+1}`,text:modernizeHistoricalEnglish(s.text),derived_source:s.source||'',derived_title:s.title||''}));
  }
  if(work.derive_from_remote_public_domain){
    const d=work.derive_from_remote_public_domain;
    let remote=sliceRemote(fetchRemoteText(d.url),d);
    if(Number(d.min_chars||0)&&remote.length<Number(d.min_chars))throw new Error(`Release109 ${work.id} remote witness unexpectedly short: ${remote.length}`);
    remote=modernizeHistoricalEnglish(remote);
    chapters=[{number:1,label:'Complete historical witness — modernized',text:remote,derived_source:d.url,derived_title:d.source_title||work.title}];
  }

  chapters.forEach((c,i)=>{
    const n=c.number??(i+1),label=c.label||`Chapter ${n}`,text=String(c.text||'').trim();
    if(text.length<40)throw new Error(`Release109 ${work.id} ${label} is unexpectedly short`);
    manifest.sections.push({
      part,
      title:`${work.title} — Section ${i+1}`,
      text,
      source:`hobah-translation:${work.id}#${i+1}`,
      provenance:[sourceNote,c.derived_source?`Historical public-domain source section: ${c.derived_title}; ${c.derived_source}.`:''].filter(Boolean).join(' '),
      status:work.translation.status,
      notes:[`Hobah Research Translation. ${work.about||''}`,`Section label: ${label}.`,work.translation.notes||'',work.translation.confidence?`Translation confidence: ${work.translation.confidence}.`:''].filter(Boolean).join(' '),
      chars:text.length
    });
    added++;totalChars+=text.length;
  });
  produced.push({id:work.id,title:work.title,group:work.group||'ancient-writings',sections:chapters.length,status:work.translation.status,base_text:work.translation.base_text,method:work.translation.method,confidence:work.translation.confidence||'not stated'});
}

manifest.hobah_translation_edition={
  version:'109',works:produced,generated_at:new Date().toISOString(),
  editorial_policy:'Fresh Hobah modern-English research translations and clearly identified Hobah modern renderings are kept distinct from historical translations. A modern rendering derived from a public-domain English edition is never described as a direct source-language translation. Lacunae, restorations, recension choices and uncertain readings are preserved or disclosed; no modern copyrighted English translation is copied.'
};
manifest.section_count=manifest.sections.length;
manifest.total_characters=manifest.sections.reduce((n,s)=>n+Number(s.chars||String(s.text||'').length),0);
fs.writeFileSync(target,JSON.stringify(manifest));
console.log(`Hobah Release 109 translations: ${works.length} works / ${added} sections / ${totalChars.toLocaleString()} translated characters merged`);
