const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const sharp=require('sharp');
const D='dist',p=f=>path.join(D,f);
const WEB_URL='https://raw.githubusercontent.com/Freely-Given-org/seven1m--open-bibles/master/eng-web.usfx.xml';
const HCF_URL='https://github.com/HistoricalChristianFaith/Writings-Database';
const VERSION='113';
const GREEN='#173A2C';
const GOLD='#D9A23B';
for(const f of ['books.json','app.js','index.html','release94-ancient-library.js','ancient-library.json'])if(!fs.existsSync(p(f)))throw new Error('Release113 missing '+f);

const decode=s=>String(s||'').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const cleanXmlText=s=>decode(String(s||'')
  .replace(/<f\b[^>]*>[\s\S]*?<\/f>/gi,' ')
  .replace(/<x\b[^>]*>[\s\S]*?<\/x>/gi,' ')
  .replace(/<fig\b[^>]*>[\s\S]*?<\/fig>/gi,' ')
  .replace(/<note\b[^>]*>[\s\S]*?<\/note>/gi,' ')
  .replace(/<[^>]+>/g,' '))
  .replace(/\s+/g,' ').trim();
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function parseWebBook(xml,code){
  const m=xml.match(new RegExp(`<book id="${escRe(code)}">([\\s\\S]*?)<\\/book>`,'i'));
  if(!m)return null;
  const body=m[1], marks=[]; let cm;
  const cre=/<c id="(\d+)"[^>]*\/>/gi;
  while((cm=cre.exec(body)))marks.push({n:+cm[1],start:cm.index,end:cre.lastIndex});
  if(!marks.length)return null;
  const chapters=[];
  for(let i=0;i<marks.length;i++){
    const mark=marks[i],seg=body.slice(mark.end,i+1<marks.length?marks[i+1].start:body.length);
    const map=new Map();let vm;
    const vre=/<v id="([^"]+)"[^>]*\/>([\s\S]*?)<ve\s*\/>/gi;
    while((vm=vre.exec(seg))){
      const n=parseInt(vm[1],10);if(!Number.isFinite(n))continue;
      const t=cleanXmlText(vm[2]);if(!t)continue;
      map.set(n,map.has(n)?(map.get(n)+' '+t):t);
    }
    const verses=[...map.entries()].sort((a,b)=>a[0]-b[0]).map(([v,t])=>({v,t}));
    if(verses.length)chapters.push({n:mark.n,label:`Chapter ${mark.n}`,verses,note:''});
  }
  return chapters.length?chapters:null;
}
function cloneChapters(chs,title,renumber=null){
  return chs.map((c,i)=>({n:renumber?renumber(c.n,i):c.n,label:`${title} ${renumber?renumber(c.n,i):c.n}`,verses:c.verses.map(v=>({v:v.v,t:v.t})),note:''}));
}
function writeBook(book,chapters,rights){
  const out={title:book.title,slug:book.slug,category:book.category,rights,chapters};
  fs.writeFileSync(p(`data/${book.slug}.json`),JSON.stringify(out));
  book.chapters=chapters.map(c=>({n:c.n,label:c.label,verses:c.verses.length}));
}
function withheldBook(book,reason){
  const t=`This work remains listed in Hobah's 81-book Ethiopian canon. The previous English rendering is temporarily withheld while Hobah verifies a source text and English edition with clear distribution rights. This notice will be replaced only by a documented public-domain, licensed, or newly prepared Hobah edition.`;
  const chapters=[{n:1,label:`${book.title} — source verification`,verses:[{v:1,t}],note:''}];
  writeBook(book,chapters,{status:'withheld-pending-source-verification',reason});
}
function locatePrebuiltShelf(runtime){
  const marker='const PREBUILT_ANCIENT_SHELF=';
  const start=runtime.indexOf(marker);if(start<0)throw new Error('Release113 Ancient shelf marker missing');
  let i=start+marker.length;while(/\s/.test(runtime[i]||''))i++;
  if(runtime[i]!=='[')throw new Error('Release113 Ancient shelf does not begin with JSON array');
  const jsonStart=i;let depth=0,inStr=false,escaped=false;
  for(;i<runtime.length;i++){
    const ch=runtime[i];
    if(inStr){if(escaped){escaped=false;continue}if(ch==='\\'){escaped=true;continue}if(ch==='"')inStr=false;continue}
    if(ch==='"'){inStr=true;continue}
    if(ch==='[')depth++;
    else if(ch===']'){depth--;if(depth===0)return{start,jsonStart,jsonEnd:i+1};}
  }
  throw new Error('Release113 Ancient shelf JSON did not terminate');
}
async function main(){
  const res=await fetch(WEB_URL,{headers:{'user-agent':'Hobah-Release113-rights-audit'}});if(!res.ok)throw new Error('Release113 WEB source download failed '+res.status);
  const xml=await res.text();
  if(!/World English Bible is in the Public Domain/i.test(xml))throw new Error('Release113 could not verify WEB public-domain statement in source file');
  const books=JSON.parse(fs.readFileSync(p('books.json'),'utf8'));if(!Array.isArray(books)||books.length!==81)throw new Error('Release113 expected exactly 81 canon entries');
  const standard={
    'genesis':'GEN','exodus':'EXO','leviticus':'LEV','numbers':'NUM','deuteronomy':'DEU','joshua':'JOS','judges':'JDG','ruth':'RUT','1-samuel':'1SA','2-samuel':'2SA','1-kings':'1KI','2-kings':'2KI','1-chronicles':'1CH','2-chronicles':'2CH','ezra':'EZR','nehemiah':'NEH','esther':'EST','job':'JOB','psalms':'PSA','proverbs':'PRO','ecclesiastes':'ECC','song-of-songs':'SNG','isaiah':'ISA','jeremiah':'JER','lamentations':'LAM','ezekiel':'EZK','daniel':'DAN','hosea':'HOS','joel':'JOL','amos':'AMO','obadiah':'OBA','jonah':'JON','micah':'MIC','nahum':'NAM','habakkuk':'HAB','zephaniah':'ZEP','haggai':'HAG','zechariah':'ZEC','malachi':'MAL','matthew':'MAT','mark':'MRK','luke':'LUK','john':'JHN','acts':'ACT','romans':'ROM','1-corinthians':'1CO','2-corinthians':'2CO','galatians':'GAL','ephesians':'EPH','philippians':'PHP','colossians':'COL','1-thessalonians':'1TH','2-thessalonians':'2TH','1-timothy':'1TI','2-timothy':'2TI','titus':'TIT','philemon':'PHM','hebrews':'HEB','james':'JAS','1-peter':'1PE','2-peter':'2PE','1-john':'1JN','2-john':'2JN','3-john':'3JN','jude':'JUD','revelation':'REV'};
  const extra={'tobit':'TOB','judith':'JDT','wisdom-of-solomon':'WIS','sirach-ecclesiasticus':'SIR','prayer-of-manasseh':'MAN','2-ezra-1-esdras':'1ES'};
  let webCount=0,charlesCount=0;const withheld=[];const sourceFailures=[];
  for(const book of books){
    let chapters=null,sourceCode=null;
    if(standard[book.slug])sourceCode=standard[book.slug];
    else if(extra[book.slug])sourceCode=extra[book.slug];
    if(sourceCode){chapters=parseWebBook(xml,sourceCode);if(!chapters)sourceFailures.push(`${book.title} (${sourceCode})`);}
    if(book.slug==='ezra-sutuel-4-ezra-apocalyptic-core'){
      const all=parseWebBook(xml,'2ES');if(all){const core=all.filter(c=>c.n>=3&&c.n<=14);chapters=cloneChapters(core,book.title,(n)=>n-2);}else sourceFailures.push(`${book.title} (2ES)`);
    }
    if(book.slug==='baruch-and-letter-of-jeremiah'){
      const bar=parseWebBook(xml,'BAR')||[];const lje=parseWebBook(xml,'LJE')||[];
      if(bar.length){const base=bar.filter(c=>c.n<=5);const letter=(lje[0]||bar.find(c=>c.n===6));chapters=cloneChapters(base,book.title);if(letter)chapters.push({n:6,label:`${book.title} 6`,verses:letter.verses.map(v=>({v:v.v,t:v.t})),note:''});}
      if(!chapters?.length)sourceFailures.push(`${book.title} (BAR/LJE)`);
    }
    if(book.slug==='daniel-greek-additions'){
      const s3y=parseWebBook(xml,'S3Y'),sus=parseWebBook(xml,'SUS'),bel=parseWebBook(xml,'BEL');
      if(s3y&&sus&&bel)chapters=[{n:3,label:`${book.title} 3`,verses:s3y.flatMap(c=>c.verses).map(v=>({v:v.v,t:v.t})),note:''},{n:13,label:`${book.title} 13`,verses:sus.flatMap(c=>c.verses).map(v=>({v:v.v,t:v.t})),note:''},{n:14,label:`${book.title} 14`,verses:bel.flatMap(c=>c.verses).map(v=>({v:v.v,t:v.t})),note:''}];
      else sourceFailures.push(`${book.title} (S3Y/SUS/BEL)`);
    }
    if(chapters?.length){
      chapters=cloneChapters(chapters,book.title);
      writeBook(book,chapters,{status:'public-domain',edition:'World English Bible Classic',source:WEB_URL,note:'WEB source wording is shipped without Hobah wording substitutions so the edition name is reserved for a faithful copy.'});webCount++;continue;
    }
    if(book.slug==='1-enoch'||book.slug==='jubilees'){
      const old=JSON.parse(fs.readFileSync(p(`data/${book.slug}.json`),'utf8'));
      old.rights={status:'public-domain-historical',translator:'R. H. Charles',note:'Historical English translation by R. H. Charles; translator died 1931. Retained as an expired-copyright/public-domain historical English witness.'};
      fs.writeFileSync(p(`data/${book.slug}.json`),JSON.stringify(old));
      book.chapters=old.chapters.map(c=>({n:c.n,label:c.label,verses:(c.verses||[]).length}));charlesCount++;continue;
    }
    withheld.push(book.title);withheldBook(book,'No sufficiently documented English distribution-rights trail was found in the project repository during the Release 113 audit.');
  }
  if(sourceFailures.filter(x=>/\((?:GEN|EXO|LEV|NUM|DEU|JOS|JDG|RUT|1SA|2SA|1KI|2KI|1CH|2CH|EZR|NEH|EST|JOB|PSA|PRO|ECC|SNG|ISA|JER|LAM|EZK|DAN|HOS|JOEL|AMOS|OBA|JON|MIC|NAM|HAB|ZEP|HAG|ZEC|MAL|MAT|MRK|LUK|JHN|ACT|ROM|1CO|2CO|GAL|EPH|PHP|COL|1TH|2TH|1TI|2TI|TIT|PHM|HEB|JAS|1PE|2PE|1JN|2JN|3JN|JUD|REV)\)/.test(x)).length)throw new Error('Release113 failed to replace one or more standard canon books: '+sourceFailures.join(', '));
  fs.writeFileSync(p('books.json'),JSON.stringify(books));

  // Remove the linked 1926 Platt/Sacred-Texts branch from the production Ancient Library.
  // The ancient works themselves are old, but the project did not establish a globally safe
  // rights trail for every English editorial/translation contribution in that 1926 compilation.
  const fbeRe=/(?:first|second) book of adam and eve|secrets? of enoch|psalms? of solomon|odes? of solomon|letter of aristeas|(?:fourth|4th|4) book of maccabees|story of (?:ahikar|ahiqar)|testament of (?:reuben|simeon|levi|judah|issachar|zebulun|dan|naphtali|gad|asher|joseph|benjamin)/i;
  const bannedRe=/new american bible|\bNABRE\b|USCCB|all rights reserved|copyright\s*[©(]/i;
  const workDir=p('ancient-works');const retainedIds=new Set(),removedAncient=[],retainedAncient=[];
  if(!fs.existsSync(workDir))throw new Error('Release113 Ancient work directory missing');
  for(const file of fs.readdirSync(workDir).filter(f=>f.endsWith('.json'))){
    const fp=path.join(workDir,file),work=JSON.parse(fs.readFileSync(fp,'utf8')),serialized=JSON.stringify(work);
    let keep=true,why='';
    if(file.startsWith('hobah-')){
      const ln=String(work.translation?.license_note||'');
      keep=/public[- ]domain|newly prepared|fresh modern-English|fresh modern English/i.test(ln)&&!bannedRe.test(serialized);
      if(!keep)why='Hobah work lacked a clear public-domain/newly-prepared license note';
    }else{
      if(fbeRe.test(String(work.title||''))){keep=false;why='Platt/Sacred-Texts duplicate removed in conservative global-rights pass';}
      if(keep&&bannedRe.test(serialized)){keep=false;why='copyright/rights marker found in work text';}
    }
    if(keep){retainedIds.add(String(work.id));retainedAncient.push(work.title||file)}else{removedAncient.push({id:String(work.id||file),title:String(work.title||file),reason:why});fs.rmSync(fp,{force:true});}
  }
  if(retainedIds.size<100)throw new Error('Release113 Ancient rights gate removed unexpectedly many works: retained '+retainedIds.size);

  let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
  const shelfLoc=locatePrebuiltShelf(lib);
  const shelf=JSON.parse(lib.slice(shelfLoc.jsonStart,shelfLoc.jsonEnd)),filtered=shelf.filter(w=>retainedIds.has(String(w.id)));
  if(filtered.length!==retainedIds.size)throw new Error(`Release113 shelf/file mismatch: shelf ${filtered.length}, files ${retainedIds.size}`);
  const filteredJson=JSON.stringify(filtered).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  lib=lib.slice(0,shelfLoc.start)+`const PREBUILT_ANCIENT_SHELF=${filteredJson}`+lib.slice(shelfLoc.jsonEnd);
  lib=lib.replace(/const LIB_VERSION='\d+';/,`const LIB_VERSION='${VERSION}';`);
  fs.writeFileSync(p('release94-ancient-library.js'),lib);

  const manifest=JSON.parse(fs.readFileSync(p('ancient-library.json'),'utf8'));
  const beforeSections=Array.isArray(manifest.sections)?manifest.sections.length:0;
  manifest.sections=(manifest.sections||[]).filter(s=>!/(sacred[- ]texts|forgotten books of eden|rutherford h\.? platt|alpha house)/i.test(`${s.source_url||''} ${s.part||''} ${s.title||''} ${s.text||''}`));
  manifest.rights_audit={release:113,policy:'Only public-domain, clearly licensed, or newly prepared Hobah English production text remains. Platt/Sacred-Texts production sections were removed conservatively.',hcf_source:HCF_URL};
  fs.writeFileSync(p('ancient-library.json'),JSON.stringify(manifest));

  // Approved brand reference: darker forest green, broad gold cross, no tiny CSS glow.
  const iconSvg=fs.readFileSync('native-ios/assets/hobah-icon.svg');
  const crossSvg=fs.readFileSync('native-ios/assets/hobah-cross-mark.svg');
  fs.writeFileSync(p('hobah-cross.svg'),crossSvg);
  await sharp(iconSvg).resize(180,180).flatten({background:GREEN}).removeAlpha().png({palette:false}).toFile(p('hobah-icon-180-v113.png'));
  await sharp(iconSvg).resize(64,64).flatten({background:GREEN}).removeAlpha().png({palette:false}).toFile(p('hobah-favicon-v113.png'));
  const brandCss=`\n/* Hobah Release 113 — approved bold cross proportions */\n.brand{width:66px!important;height:66px!important;overflow:visible!important;background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important;}\n.brand img{display:block!important;width:66px!important;height:66px!important;object-fit:contain!important;filter:none!important;transform:none!important;}\n@media(max-width:720px){.brand{width:62px!important;height:62px!important}.brand img{width:62px!important;height:62px!important}}\n`;
  fs.appendFileSync(p('styles.css'),brandCss);
  let html=fs.readFileSync(p('index.html'),'utf8');
  html=html.replace(/hobah-icon-180-v\d+\.png/g,'hobah-icon-180-v113.png').replace(/hobah-(?:cross|mark)\.svg\?v=\d+/g,'hobah-cross.svg?v=113').replaceAll('v=112','v=113');
  fs.writeFileSync(p('index.html'),html);
  if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=113#home';m.background_color=GREEN;m.theme_color=GREEN;m.icons=[{src:'/hobah-icon-180-v113.png',sizes:'180x180',type:'image/png'},{src:'/hobah-favicon-v113.png',sizes:'64x64',type:'image/png'}];fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m));}
  let app=fs.readFileSync(p('app.js'),'utf8').replace(/const V='\d+';/,`const V='${VERSION}';`);fs.writeFileSync(p('app.js'),app);

  // Corpus-wide final scan: every shipped canon data file + every retained Ancient direct file.
  const forbidden=[/When the men of the place asked questions about his wife/i,/New American Bible Revised Edition/i,/\bNABRE\b/i,/USCCB/i];
  const violations=[];
  for(const b of books){const txt=fs.readFileSync(p(`data/${b.slug}.json`),'utf8');for(const re of forbidden)if(re.test(txt))violations.push(`${b.slug}: ${re}`);}
  for(const f of fs.readdirSync(workDir).filter(f=>f.endsWith('.json'))){const txt=fs.readFileSync(path.join(workDir,f),'utf8');for(const re of forbidden)if(re.test(txt))violations.push(`${f}: ${re}`);}
  if(violations.length)throw new Error('Release113 final rights scan failed: '+violations.join('; '));
  const gen=JSON.parse(fs.readFileSync(p('data/genesis.json'),'utf8'));if(gen.rights?.edition!=='World English Bible Classic')throw new Error('Release113 Genesis did not switch to WEB');
  if(!/In the beginning, God/.test(gen.chapters?.[0]?.verses?.[0]?.t||''))throw new Error('Release113 WEB Genesis smoke test failed');
  if(webCount<75)console.warn('Release113 warning: only '+webCount+' canon entries were replaced from WEB; source failures: '+sourceFailures.join(', '));
  const audit={release:113,generated_at:new Date().toISOString(),scope:'production corpus source/provenance and automated phrase audit',not_legal_advice:true,canon:{entries:books.length,world_english_bible_public_domain:webCount,rh_charles_public_domain_historical:charlesCount,withheld_pending_source_verification:withheld,source_failures:sourceFailures},ancient_library:{retained_work_files:retainedIds.size,removed_work_files:removedAncient,manifest_sections_before:beforeSections,manifest_sections_after:manifest.sections.length,public_domain_collection:HCF_URL,hobah_policy:'Retain newly prepared Hobah readings only where the work carries an explicit public-domain/newly-prepared license note.'},known_contamination_removed:'Prior modern-English Bible wording that tracked NABRE was overwritten in all standard/deuterocanonical books by documented public-domain WEB text.',final_forbidden_phrase_violations:violations};
  fs.writeFileSync(p('rights-audit.json'),JSON.stringify(audit,null,2));
  fs.writeFileSync(p('RIGHTS_PROVENANCE.txt'),`Hobah Release 113 production rights/provenance note\n\nStandard canon and supported deuterocanonical books: World English Bible Classic source, public domain.\n1 Enoch and Jubilees: retained as public-domain historical R. H. Charles English witnesses.\nEthiopian-only works without a verified English distribution-rights trail: text withheld pending a documented rights-safe edition.\nAncient Library: HistoricalChristianFaith/Writings-Database public-domain collection plus Hobah works carrying explicit newly-prepared/public-domain license notes. The linked Platt/Sacred-Texts branch is excluded from production in this conservative pass.\n\nThis is a source/provenance and production-content audit, not a legal opinion or an exhaustive similarity search against every copyrighted publication.\n`);
  execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
  console.log(`Hobah Release 113: ${webCount} WEB canon entries, ${charlesCount} Charles works, ${withheld.length} rights-withheld entries; Ancient Library ${retainedIds.size} retained / ${removedAncient.length} removed; approved bold cross applied`);
}
main().catch(e=>{console.error(e);process.exit(1)});
