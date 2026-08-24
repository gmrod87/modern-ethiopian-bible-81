const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','ancient-library.json','ancient-works','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release109 missing '+f);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!lib.includes("const LIB_VERSION='108';"))throw new Error('Release109 expected Ancient Library v108');
if(!lib.includes('PREBUILT_ANCIENT_SHELF'))throw new Error('Release109 expected prebuilt Ancient shelf');

const cfgDir=path.join('ancient-library','hobah-translations');
const cfgFiles=fs.readdirSync(cfgDir).filter(f=>/^\d+-.+\.json$/i.test(f)).sort();
if(cfgFiles.length!==17)throw new Error(`Release109 expected 17 Hobah translation configs, found ${cfgFiles.length}`);
const configs=cfgFiles.map(f=>JSON.parse(fs.readFileSync(path.join(cfgDir,f),'utf8')));
const workDir=p('ancient-works');
const baseWorks=fs.readdirSync(workDir).filter(f=>/^w\d+\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(workDir,f),'utf8')));

const metaById={
  'life-of-adam-and-eve':['Anonymous','c. AD 100–400 (form and dating disputed)'],
  'apocalypse-of-abraham':['Anonymous','c. AD 70–150'],
  'testament-of-abraham':['Anonymous','c. AD 100–200'],
  'testaments-twelve-patriarchs':['Anonymous / composite','c. 150 BCE–AD 200'],
  'joseph-and-aseneth':['Anonymous','c. 100 BCE–AD 200'],
  'psalms-of-solomon':['Anonymous','c. 50 BCE'],
  'biblical-antiquities-pseudo-philo':['Anonymous (Pseudo-Philo)','c. AD 50–100'],
  '2-baruch':['Anonymous','c. AD 70–120'],
  'ascension-of-isaiah':['Anonymous / composite','c. AD 100–200'],
  'community-rule-1qs':['Anonymous / Qumran community','c. 100–75 BCE manuscript'],
  'war-scroll-1qm':['Anonymous / Qumran community','c. 100 BCE–AD 50'],
  'damascus-document':['Anonymous / composite','c. 2nd–1st century BCE (development disputed)'],
  'thanksgiving-hymns-1qha':['Anonymous / Qumran community','c. 1st century BCE–1st century AD'],
  'temple-scroll-11q19':['Anonymous / composite','c. 2nd–1st century BCE; manuscript late 1st BCE–early 1st AD'],
  'genesis-apocryphon-1q20':['Anonymous','c. 1st century BCE manuscript'],
  'songs-sabbath-sacrifice':['Anonymous','c. 100 BCE'],
  'rule-congregation-1qsa':['Anonymous / Qumran community','c. 100–50 BCE manuscript']
};

function cleanText(s){return String(s||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim()}
function preserveCase(from,to){return from[0]===from[0].toUpperCase()?to[0].toUpperCase()+to.slice(1):to}
function modernize(s){
  let t=cleanText(s);
  const words={thou:'you',thee:'you',thy:'your',thine:'yours',ye:'you',hath:'has',doth:'does',shalt:'shall',wilt:'will',art:'are',wert:'were',didst:'did',canst:'can',mayest:'may',shouldst:'should',wouldst:'would',couldst:'could',hast:'have',hadst:'had'};
  for(const [a,b] of Object.entries(words))t=t.replace(new RegExp(`\\b${a}\\b`,'gi'),m=>preserveCase(m,b));
  const verbs={saith:'says',sayeth:'says',cometh:'comes',goeth:'goes',maketh:'makes',giveth:'gives',taketh:'takes',knoweth:'knows',doeth:'does',dwelleth:'dwells',standeth:'stands',sitteth:'sits',speaketh:'speaks',walketh:'walks',loveth:'loves',hateth:'hates',liveth:'lives'};
  for(const [a,b] of Object.entries(verbs))t=t.replace(new RegExp(`\\b${a}\\b`,'gi'),m=>preserveCase(m,b));
  return t.replace(/\s+([,.;:!?])/g,'$1').replace(/\n{3,}/g,'\n\n').trim();
}
function romanToNumber(r){if(/^\d+$/.test(r))return+r;const v={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let n=0,prev=0;for(let i=r.length-1;i>=0;i--){const x=v[r[i].toUpperCase()]||0;n+=x<prev?-x:x;prev=Math.max(prev,x)}return n||null}
function sourceNoise(line){
  const x=line.trim();if(!x)return false;
  return /^(?:digitized by|generated at|internet archive|google|public domain|copyright|all rights reserved|scan|ocr)\b/i.test(x)||/^\f?$/.test(x)||/^\d{1,4}$/.test(x);
}
function cleanRemote(s){return String(s||'').replace(/\r/g,'').split('\n').filter(x=>!sourceNoise(x)).join('\n').replace(/[ \t]+$/gm,'').replace(/\n{4,}/g,'\n\n').trim()}
function rxFrom(spec,global=false){const flags=String(spec.flags||'i').replace(/g/g,'')+(global?'g':'');return new RegExp(spec.pattern||spec,flags)}
function locateMatches(text,re){const out=[];let m;const g=new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g');while((m=g.exec(text))){out.push(m);if(m[0]==='')g.lastIndex++}return out}
function trimRemote(raw,spec){
  let text=cleanRemote(raw),start=0;
  if(spec.start_regex){const re=new RegExp(spec.start_regex,(spec.flags||'i').replace(/g/g,''));const ms=locateMatches(text,re);if(ms.length){const m=spec.start_occurrence==='last'?ms[ms.length-1]:ms[0];start=m.index;}}
  else{
    const re=/^\s*CHAPTER\s+(?:I|1)\b[^\n]*$/gmi,ms=locateMatches(text,re);if(ms.length)start=(ms.length>1?ms[ms.length-1]:ms[0]).index;
  }
  text=text.slice(start);
  if(spec.end_regex){const re=new RegExp(spec.end_regex,(spec.flags||'i').replace(/g/g,''));const m=re.exec(text);if(m&&m.index>1000)text=text.slice(0,m.index)}
  else{
    const after=Math.floor(text.length*.55),tail=text.slice(after),m=/\n\s*(?:APPENDIX|GENERAL INDEX|INDEX OF|NOTES ON THE TEXT)\b/im.exec(tail);if(m)text=text.slice(0,after+m.index);
  }
  return cleanRemote(text);
}
function splitRemoteChapters(text){
  const re=/^\s*CHAPTER\s+([IVXLCDM]+|\d+)\.?\s*([^\n]*)$/gmi,marks=[];let m;
  while((m=re.exec(text)))marks.push({at:m.index,end:re.lastIndex,num:romanToNumber(m[1]),heading:cleanText(m[2])});
  if(marks.length<2)return[{label:'Complete reading text',text:modernize(text),chapterNumber:1}];
  const out=[];
  for(let i=0;i<marks.length;i++){
    const a=marks[i],b=marks[i+1]?.at??text.length,body=modernize(text.slice(a.end,b));if(body.length<120)continue;
    out.push({label:`Chapter ${a.num||i+1}${a.heading?' — '+a.heading:''}`,text:body,chapterNumber:a.num||i+1});
  }
  return out.length?out:[{label:'Complete reading text',text:modernize(text),chapterNumber:1}];
}
async function fetchText(url){
  let last;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const r=await fetch(url,{headers:{'user-agent':'HobahAncientLibrary/1.0'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.text();
    }catch(e){last=e;if(attempt<3)await new Promise(r=>setTimeout(r,800*attempt));}
  }
  throw last;
}
function deriveFromExisting(cfg){
  const spec=cfg.derive_from_manifest,re=new RegExp(spec.title_regex,(spec.flags||'i').replace(/g/g,''));
  const matches=baseWorks.filter(w=>{re.lastIndex=0;return re.test(`${w.title}\n${(w.chapters||[]).map(c=>c.label||'').join('\n')}`)});
  if(!matches.length)throw new Error(`Release109 could not find existing source work for ${cfg.id}`);
  const chapters=[];
  for(const w of matches){
    const many=matches.length>1;
    for(const c of w.chapters||[]){
      const text=modernize(c.text);if(text.length<80)continue;
      const label=many?`${w.title}${c.label?' — '+c.label:''}`:(c.label||w.title);
      chapters.push({label,text,chapterNumber:chapters.length+1});
    }
  }
  if(!chapters.length)throw new Error(`Release109 derived empty text for ${cfg.id}`);
  return chapters;
}
async function buildWork(cfg){
  let chapters=[];
  if(Array.isArray(cfg.chapters)&&cfg.chapters.length){chapters=cfg.chapters.map((c,i)=>({label:String(c.label||`Chapter ${i+1}`),text:cleanText(c.text),chapterNumber:Number(c.number)||i+1})).filter(c=>c.text.length>70)}
  else if(cfg.derive_from_manifest)chapters=deriveFromExisting(cfg);
  else if(cfg.derive_from_remote_public_domain){
    const spec=cfg.derive_from_remote_public_domain,raw=await fetchText(spec.url);if(raw.length<Number(spec.min_chars||5000))throw new Error(`Release109 remote source too small for ${cfg.id}: ${raw.length}`);
    const body=trimRemote(raw,spec);if(body.length<4000)throw new Error(`Release109 extracted source too small for ${cfg.id}: ${body.length}`);chapters=splitRemoteChapters(body);
  }else throw new Error(`Release109 config ${cfg.id} has no text source`);
  if(!chapters.length)throw new Error(`Release109 work ${cfg.id} has no chapters`);
  const [author,date]=metaById[cfg.id]||['Anonymous','Date uncertain'];
  return {id:'hobah-'+cfg.id,title:String(cfg.title||cfg.id),collection:'ancient',meta:{author,date},about:String(cfg.about||''),translation:cfg.translation||{},chapters};
}
function readShelf(runtime){
  const marker='const PREBUILT_ANCIENT_SHELF=',start=runtime.indexOf(marker);if(start<0)throw new Error('Release109 shelf marker missing');let i=start+marker.length;
  while(/\s/.test(runtime[i]))i++;if(runtime[i]!=='[')throw new Error('Release109 shelf JSON does not begin with [');const jsonStart=i;let depth=0,inStr=false,esc=false;
  for(;i<runtime.length;i++){
    const ch=runtime[i];if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue}if(ch==='"'){inStr=true;continue}if(ch==='['||ch==='{')depth++;else if(ch===']'||ch==='}'){depth--;if(depth===0)return {start:jsonStart,end:i+1,value:JSON.parse(runtime.slice(jsonStart,i+1))}}
  }
  throw new Error('Release109 could not find end of shelf JSON');
}

(async()=>{
  const works=[];
  for(const cfg of configs){const work=await buildWork(cfg);works.push(work);fs.writeFileSync(path.join(workDir,work.id+'.json'),JSON.stringify(work));}
  if(works.length!==17)throw new Error(`Release109 built ${works.length} works, expected 17`);
  const shelfInfo=readShelf(lib),oldShelf=shelfInfo.value,ids=new Set(works.map(w=>w.id));
  const additions=works.map(w=>({id:w.id,title:w.title,collection:'ancient',meta:w.meta,chapterCount:w.chapters.length}));
  const shelf=[...additions,...oldShelf.filter(w=>!ids.has(w.id))];
  lib=lib.slice(0,shelfInfo.start)+JSON.stringify(shelf)+lib.slice(shelfInfo.end);
  lib=lib.replace("const LIB_VERSION='108';","const LIB_VERSION='109';");
  fs.writeFileSync(p('release94-ancient-library.js'),lib);

  let app=fs.readFileSync(p('app.js'),'utf8');if(!app.includes("const V='108';"))throw new Error('Release109 expected app runtime v108');app=app.replace("const V='108';","const V='109';");fs.writeFileSync(p('app.js'),app);
  let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=108','v=109');fs.writeFileSync(p('index.html'),html);
  if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=109#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

  for(const w of works){if(!fs.existsSync(path.join(workDir,w.id+'.json')))throw new Error('Release109 missing direct work '+w.id);if(!shelf.some(s=>s.id===w.id))throw new Error('Release109 missing shelf entry '+w.id)}
  if(!lib.includes("const LIB_VERSION='109';"))throw new Error('Release109 cache version missing');
  execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
  console.log(`Hobah Release 109: added ${works.length} Hobah Ancient translations (${works.reduce((n,w)=>n+w.chapters.length,0)} chapters/sections); Ancient shelf now ${shelf.length} works`);
})().catch(e=>{console.error(e);process.exit(1)});
