const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','release97-ancient-library.css','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release110 missing '+f);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!lib.includes("const LIB_VERSION='109';"))throw new Error('Release110 expected Ancient Library v109');
if(!lib.includes('function chapterIndexHTML(work,current){'))throw new Error('Release110 chapter index function missing');

const chapterIndexRe=/function chapterIndexHTML\(work,current\)\{[\s\S]*?\n\}\nfunction buildCatalog\(m\)\{/;
if(!chapterIndexRe.test(lib))throw new Error('Release110 could not replace chapter index');
const chapterIndex=`function compactAncientChapterLabel(chapter,index){
  const full=clean(chapter?.label||('Chapter '+(index+1)));
  const structural=full.match(/\\b(Chapter|Section|Column|Book|Vision|Mandate|Similitude|Psalm)\\s+([IVXLCDM0-9]+)\\b/i);
  if(structural){
    const type=structural[1][0].toUpperCase()+structural[1].slice(1).toLowerCase();
    const token=structural[2].toUpperCase();
    if(type==='Chapter'||type==='Section')return token;
    return type+' '+token;
  }
  if(Number.isFinite(chapter?.chapterNumber))return String(chapter.chapterNumber);
  const first=full.split(/\\s+[—–-]\\s+/)[0].trim();
  if(first.length<=18)return first;
  return 'Text '+(index+1);
}
function chapterIndexHTML(work,current){
  if(!work||work.chapters.length<=1)return'';
  return '<section class="ancientChapterIndex" aria-label="All chapters"><div class="ancientChapterIndexHead"><b>Chapters</b><span>'+work.chapters.length+' chapters</span></div><div class="ancientChapterGrid">'+work.chapters.map((c,i)=>{
    const label=compactAncientChapterLabel(c,i),full=clean(c.label||('Chapter '+(i+1)));
    return '<button type="button" data-ancient-chapter-jump="'+i+'" class="'+(i===current?'active':'')+'" aria-current="'+(i===current?'page':'false')+'" aria-label="'+esc(full)+'" title="'+esc(full)+'"><span>'+esc(label)+'</span></button>';
  }).join('')+'</div></section>';
}
function buildCatalog(m){`;
lib=lib.replace(chapterIndexRe,chapterIndex);
lib=lib.replace("const LIB_VERSION='109';","const LIB_VERSION='110';");
fs.writeFileSync(p('release94-ancient-library.js'),lib);

const css=String.raw`
/* Hobah Release 110 — tidy Ancient Library navigation on iPhone and all screen sizes */
.ancientPageReader{min-width:0!important;overflow-x:hidden!important;padding-left:max(16px,env(safe-area-inset-left))!important;padding-right:max(16px,env(safe-area-inset-right))!important;}
.ancientPageHead,.ancientChapterText,.ancientReaderPager,.ancientChapterIndex{min-width:0!important;width:100%!important;box-sizing:border-box!important;}
.ancientPageHead h1,.ancientPageHead p,.ancientWorkMeta{overflow-wrap:anywhere!important;word-break:normal!important;}
.ancientPageHead p{max-width:780px!important;margin-left:auto!important;margin-right:auto!important;line-height:1.4!important;}

.ancientReaderPager{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important;margin:34px auto 0!important;padding:0!important;}
.ancientReaderPager button{width:100%!important;min-width:0!important;min-height:58px!important;height:auto!important;margin:0!important;padding:12px 14px!important;border-radius:16px!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;white-space:nowrap!important;font-size:16px!important;line-height:1.15!important;box-sizing:border-box!important;overflow:hidden!important;}
.ancientReaderPager button:disabled{opacity:.34!important;filter:none!important;pointer-events:none!important;}

.ancientChapterIndex{max-width:780px!important;margin:28px auto 112px!important;padding:20px!important;border-radius:22px!important;overflow:hidden!important;}
.ancientChapterIndexHead{display:flex!important;align-items:baseline!important;justify-content:space-between!important;gap:12px!important;margin-bottom:16px!important;min-width:0!important;}
.ancientChapterIndexHead b{font-size:18px!important;line-height:1.15!important;}
.ancientChapterIndexHead span{font-size:13px!important;line-height:1.2!important;white-space:nowrap!important;}
.ancientChapterGrid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;width:100%!important;min-width:0!important;}
.ancientChapterGrid button{width:100%!important;min-width:0!important;min-height:54px!important;height:54px!important;margin:0!important;padding:7px 6px!important;border-radius:13px!important;box-sizing:border-box!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;}
.ancientChapterGrid button span{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;font:750 14px/1.05 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;}
.ancientChapterGrid button.active{box-shadow:none!important;}

.ancientWorkCard{min-width:0!important;overflow:hidden!important;}
.ancientWorkCard>b,.ancientWorkCard>small,.ancientWorkCard .ancientCardTop em{max-width:100%!important;overflow-wrap:anywhere!important;word-break:normal!important;}
.ancientWorkCard>b{display:block!important;}

@media(max-width:620px){
  .ancientPageReader{padding-left:16px!important;padding-right:16px!important;}
  .ancientReaderPager{gap:10px!important;margin-top:30px!important;}
  .ancientReaderPager button{min-height:56px!important;padding:10px 9px!important;font-size:15px!important;border-radius:15px!important;}
  .ancientChapterIndex{margin:24px 0 108px!important;padding:17px 14px!important;border-radius:20px!important;}
  .ancientChapterGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;}
  .ancientChapterGrid button{height:52px!important;min-height:52px!important;border-radius:12px!important;padding:6px 4px!important;}
  .ancientChapterGrid button span{font-size:13px!important;line-height:1.05!important;}
}
@media(max-width:360px){
  .ancientChapterGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
  .ancientReaderPager button{font-size:14px!important;}
}
@media(min-width:900px){
  .ancientChapterGrid{grid-template-columns:repeat(6,minmax(0,1fr))!important;}
}
`;
fs.appendFileSync(p('release97-ancient-library.css'),'\n'+css+'\n');

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='109';"))throw new Error('Release110 expected app runtime v109');
app=app.replace("const V='109';","const V='110';");fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=109','v=110');fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=110#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const LIB_VERSION='110'",'compactAncientChapterLabel','repeat(3,minmax(0,1fr))','ancientReaderPager button:disabled']){
  if(!(lib+css).includes(required))throw new Error('Release110 integration missing '+required);
}
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 110: Ancient reader pager and chapter index are compact, responsive and legible across all Ancient Library works');
