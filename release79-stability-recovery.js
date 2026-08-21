const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='79',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release79: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release79 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='77';","const V='79';",'runtime version');

const oldVoice=`function handleVoice(text,final){
  if(state.audio.suppressRecognition)return;
  const now=Date.now(),raw=clean(text).toLowerCase().replace(/[^a-z\\s']/g,'').replace(/\\s+/g,' ').trim();
  const t=raw.replace(/^(?:hey\\s+)?(?:hobah|hoba|ho bah|oba)\\s+/i,'').replace(/^please\\s+/i,'').replace(/\\s+please$/i,'').trim();
  if(now-lastVoiceAt<420&&(t===lastVoice||t.startsWith(lastVoice)||lastVoice.startsWith(t)))return;
  const explain=/^(explain that|explain this|explain that more|explain this more|explain that in more detail|explain this in more detail|what does that mean|tell me more|go deeper)$/i.test(t);
  const save=/^(save that|save this|save it|save that to my notes|save this to my notes|save to my notes|save this in my notes|save that in my notes|save this explanation|save that explanation)$/i.test(t);
  const pause=/^(stop|pause|stop reading|pause reading|hold on)$/i.test(t);
  const play=/^(continue|resume|play|keep reading|continue reading|carry on)$/i.test(t);
  const next=/^(next|next verse|next section|go next)$/i.test(t);
  const prev=/^(previous|previous verse|go back|back|go previous)$/i.test(t);
  if(!(explain||save||pause||play||next||prev)){if(final)setAudioStatus('Listening • say explain that, save that, stop, or play');return}
  lastVoice=t;lastVoiceAt=now;
  if(explain){explainCurrent();return}
  if(save){saveStudyExplanation();return}
  if(state.audio.studyBusy)return;
  if(pause){pauseNarration();return}
  if(play){resumeNarration();return}
  if(next){jumpNarration(1);return}
  if(prev){jumpNarration(-1);return}
}`;
const newVoice=`const stableVoicePhrases=[
  ['explain','explain that in more detail'],['explain','explain this in more detail'],['explain','what does that mean'],['explain','explain that more'],['explain','explain this more'],['explain','explain that'],['explain','explain this'],['explain','tell me more'],['explain','go deeper'],
  ['save','save that to my notes'],['save','save this to my notes'],['save','save this in my notes'],['save','save that in my notes'],['save','save this explanation'],['save','save that explanation'],['save','save to my notes'],['save','save that'],['save','save this'],['save','save it'],
  ['pause','stop reading'],['pause','pause reading'],['pause','hold on'],['pause','stop'],['pause','pause'],
  ['play','keep reading'],['play','continue reading'],['play','carry on'],['play','continue'],['play','resume'],['play','play'],
  ['next','next verse'],['next','next section'],['next','go next'],['next','next'],
  ['prev','previous verse'],['prev','go previous'],['prev','go back'],['prev','previous'],['prev','back']
];
function handleVoice(text,final){
  if(state.audio.suppressRecognition)return;
  const now=Date.now(),raw=clean(text).toLowerCase().replace(/[^a-z\\s']/g,' ').replace(/\\s+/g,' ').trim();
  let t=raw.replace(/^(?:hey\\s+)?(?:hobah|hoba|ho bah|oba)\\s+/i,'').replace(/^please\\s+/i,'').replace(/\\s+please$/i,'').trim();
  const found=stableVoicePhrases.find(([,phrase])=>t===phrase||t.endsWith(' '+phrase));
  if(!found){if(final)setAudioStatus('Listening • say explain that, save that, stop, or play');return}
  const [kind,phrase]=found;
  if(now-lastVoiceAt<500&&phrase===lastVoice)return;
  lastVoice=phrase;lastVoiceAt=now;setAudioStatus('Heard “'+phrase+'”');
  if(kind==='explain'){explainCurrent();return}
  if(kind==='save'){saveStudyExplanation();return}
  if(state.audio.studyBusy)return;
  if(kind==='pause'){pauseNarration();return}
  if(kind==='play'){resumeNarration();return}
  if(kind==='next'){jumpNarration(1);return}
  if(kind==='prev'){jumpNarration(-1);return}
}`;
swap(oldVoice,newVoice,'safe transcript-tail command parser');

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=77','/styles.css?v=79').replace('/app.js?v=77','/app.js?v=79').replace('/manifest.webmanifest?v=77','/manifest.webmanifest?v=79');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=79#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 79: stable Release 77 native engine + safe transcript-tail commands');
