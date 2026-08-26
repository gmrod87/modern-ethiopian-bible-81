import crypto from 'node:crypto';

const required=['APP_STORE_CONNECT_ISSUER_ID','APP_STORE_CONNECT_KEY_ID','APP_STORE_CONNECT_API_KEY_P8_BASE64','BUNDLE_ID','MARKETING_VERSION'];
for(const k of required) if(!process.env[k]) throw new Error(`Missing ${k}`);

const cfg={
  issuer:process.env.APP_STORE_CONNECT_ISSUER_ID,
  keyId:process.env.APP_STORE_CONNECT_KEY_ID,
  privateKey:Buffer.from(process.env.APP_STORE_CONNECT_API_KEY_P8_BASE64,'base64').toString('utf8'),
  bundleId:process.env.BUNDLE_ID,
  version:process.env.MARKETING_VERSION
};

const DESCRIPTION=`Hobah is a beautifully focused home for the 81-book Ethiopian canon, ancient writings, and intelligent Bible study.

Read across the Ethiopian canon in a clean, immersive interface. Explore a curated Ancient Library, listen hands-free with natural narration, save your place, and use Study AI to go deeper into passages, history, manuscripts, and context.

Built for serious study and everyday reading, Hobah brings Scripture, ancient literature, audio, and research tools together in one app.

Features:
• 81-book Ethiopian canon with fast book and chapter navigation
• Ancient Library with public-domain and rights-safe historical writings
• Fragmentary ancient works clearly presented as surviving fragments or sections
• Fast search across Scripture
• Saved verses, highlights, notes, and reading progress
• Natural Read Aloud with playback controls
• Study AI for explanations, historical context, manuscripts, and research
• Voice Commands for hands-free reading controls
• Offline access to bundled reading texts
• Privacy-focused local storage for saved reading data

An internet connection is required for Study AI and natural voice generation. Ancient works may be fragmentary or based on historical translations; Hobah identifies them accordingly rather than presenting missing material as complete.`;

const BASE='https://api.appstoreconnect.apple.com';
const b64url=v=>Buffer.from(v).toString('base64url');
function token(){
  const now=Math.floor(Date.now()/1000);
  const h=b64url(JSON.stringify({alg:'ES256',kid:cfg.keyId,typ:'JWT'}));
  const p=b64url(JSON.stringify({iss:cfg.issuer,iat:now-20,exp:now+900,aud:'appstoreconnect-v1'}));
  const input=`${h}.${p}`;
  const sig=crypto.sign('sha256',Buffer.from(input),{key:cfg.privateKey,dsaEncoding:'ieee-p1363'});
  return `${input}.${sig.toString('base64url')}`;
}
function params(obj){const q=new URLSearchParams();for(const [k,v] of Object.entries(obj))if(v!==undefined&&v!==null)q.set(k,String(v));return q.toString()}
function appleError(json,text){const es=Array.isArray(json?.errors)?json.errors:[];return es.length?es.map(e=>[e.status,e.code,e.title,e.detail].filter(Boolean).join(' | ')).join('\n'):(text||'Unknown Apple error')}
async function api(method,path,body=null){
  const r=await fetch(BASE+path,{method,headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const text=await r.text();let json=null;try{json=text?JSON.parse(text):null}catch{}
  if(!r.ok) throw new Error(`${method} ${path} -> ${r.status}\n${appleError(json,text)}`);
  return {json,text,status:r.status};
}

const apps=(await api('GET',`/v1/apps?${params({'filter[bundleId]':cfg.bundleId,'fields[apps]':'name,bundleId',limit:2})}`)).json?.data||[];
const app=apps[0];
if(!app) throw new Error(`No App Store Connect app found for ${cfg.bundleId}`);

const versions=(await api('GET',`/v1/apps/${app.id}/appStoreVersions?${params({'filter[platform]':'IOS','fields[appStoreVersions]':'versionString,appStoreState,appVersionState',limit:200})}`)).json?.data||[];
const version=versions.find(v=>v.attributes?.versionString===cfg.version);
if(!version) throw new Error(`App Store version ${cfg.version} not found.`);

const locs=(await api('GET',`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?${params({'fields[appStoreVersionLocalizations]':'locale,description',limit:50})}`)).json?.data||[];
const loc=locs.find(x=>x.attributes?.locale==='en-AU')||locs[0];
if(!loc) throw new Error('No App Store version localization found.');

if(loc.attributes?.description===DESCRIPTION){
  console.log(`[description] Premium App Store description is already live for ${loc.attributes?.locale||'primary locale'}.`);
  process.exit(0);
}

await api('PATCH',`/v1/appStoreVersionLocalizations/${loc.id}`,{data:{type:'appStoreVersionLocalizations',id:loc.id,attributes:{description:DESCRIPTION}}});
const check=(await api('GET',`/v1/appStoreVersionLocalizations/${loc.id}?fields%5BappStoreVersionLocalizations%5D=locale,description`)).json?.data;
if(check?.attributes?.description!==DESCRIPTION) throw new Error('Apple accepted the description update but readback did not match.');
console.log(`[description] Updated Hobah ${cfg.version} App Store description for ${check.attributes?.locale||'primary locale'}.`);
