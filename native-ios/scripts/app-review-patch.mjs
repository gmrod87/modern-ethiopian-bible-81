import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const appPath=path.join(root,'www','app.js');
let app=await readFile(appPath,'utf8');

if(!app.includes('HOBAH_AI_CONSENT_KEY')){
  const versionMatch=app.match(/const V='\d+';/);
  if(!versionMatch)throw new Error('App Review patch: runtime version marker not found');
  const helper=String.raw`
const HOBAH_AI_CONSENT_KEY='hobah:thirdPartyAIConsent:v1';
function hobahHasAIConsent(){try{return localStorage.getItem(HOBAH_AI_CONSENT_KEY)==='granted'}catch{return false}}
function hobahRevokeAIConsent(){try{localStorage.removeItem(HOBAH_AI_CONSENT_KEY)}catch{}}
function hobahRequireAIConsent(){
  if(hobahHasAIConsent())return Promise.resolve(true);
  return new Promise(resolve=>{
    const old=document.getElementById('hobahAiConsent');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='hobahAiConsent';wrap.className='hobahAiConsentBackdrop';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-labelledby','hobahAiConsentTitle');
    wrap.innerHTML='<section class="hobahAiConsentCard"><span class="eyebrow">PRIVACY CHOICE</span><h2 id="hobahAiConsentTitle">Allow optional Study AI?</h2><p>Hobah uses <strong>OpenAI</strong> for optional Study AI and related online AI features. If you allow this, your Study AI question, the relevant Scripture or Ancient Library passage, and study context may be sent through Hobah’s server to OpenAI so the feature can generate a response.</p><p>Core reading, search, bookmarks, notes, your Library, and on-device Read Aloud work without allowing this. Hobah does not use this information for advertising or cross-app tracking.</p><p><a href="/privacy.html" target="_blank" rel="noopener">Read the Privacy Policy</a></p><div class="hobahAiConsentActions"><button type="button" class="later" data-ai-later>Not now</button><button type="button" class="allow" data-ai-allow>Allow &amp; Continue</button></div></section>';
    const finish=allowed=>{if(allowed)try{localStorage.setItem(HOBAH_AI_CONSENT_KEY,'granted')}catch{};wrap.remove();resolve(allowed)};
    wrap.querySelector('[data-ai-later]').onclick=()=>finish(false);
    wrap.querySelector('[data-ai-allow]').onclick=()=>finish(true);
    document.body.appendChild(wrap);
    setTimeout(()=>wrap.querySelector('[data-ai-allow]')?.focus(),0);
  });
}
window.HobahAIPrivacy={hasConsent:hobahHasAIConsent,revokeConsent:hobahRevokeAIConsent,requestConsent:hobahRequireAIConsent};
`;
  app=app.replace(versionMatch[0],versionMatch[0]+helper);
}

const studySig="async function askStudy(question,{speak=false,body=null,autoResume=false,quick=false}={}){";
if(!app.includes(studySig))throw new Error('App Review patch: Study AI entrypoint not found');
if(!app.includes("Study AI was not enabled because third-party AI permission was not granted")){
  app=app.replace(studySig,studySig+"\n  if(window.HOBAH_NATIVE&&!hobahHasAIConsent()){const allowed=await hobahRequireAIConsent();if(!allowed){toast('Study AI was not enabled');return 'Study AI was not enabled because third-party AI permission was not granted.';}}");
}

const ttsSig='async function getSpeechBlob(text,mode=null){';
if(!app.includes(ttsSig))throw new Error('App Review patch: online TTS entrypoint not found');
if(!app.includes("Online AI voice was not enabled")){
  app=app.replace(ttsSig,ttsSig+"\n  if(window.HOBAH_NATIVE&&!hobahHasAIConsent()){const allowed=await hobahRequireAIConsent();if(!allowed)throw Error('Online AI voice was not enabled because third-party AI permission was not granted');}");
}

const realtimeSig='async function ensureStudyRealtime(){';
if(!app.includes(realtimeSig))throw new Error('App Review patch: realtime Study AI entrypoint not found');
if(!app.includes("Realtime Study AI was not enabled")){
  app=app.replace(realtimeSig,realtimeSig+"\n  if(window.HOBAH_NATIVE&&!hobahHasAIConsent()){const allowed=await hobahRequireAIConsent();if(!allowed)throw Error('Realtime Study AI was not enabled because third-party AI permission was not granted');}");
}

await writeFile(appPath,app);
console.log('Hobah App Review patch applied: explicit OpenAI permission gate added before third-party AI requests');
