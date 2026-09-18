import crypto from 'node:crypto';

const required=['APP_STORE_CONNECT_ISSUER_ID','APP_STORE_CONNECT_KEY_ID','APP_STORE_CONNECT_API_KEY_P8_BASE64','BUNDLE_ID','MARKETING_VERSION','BUILD_NUMBER'];
for(const k of required)if(!process.env[k])throw new Error(`Missing ${k}`);
const cfg={issuer:process.env.APP_STORE_CONNECT_ISSUER_ID,keyId:process.env.APP_STORE_CONNECT_KEY_ID,privateKey:Buffer.from(process.env.APP_STORE_CONNECT_API_KEY_P8_BASE64,'base64').toString('utf8'),bundleId:process.env.BUNDLE_ID,version:process.env.MARKETING_VERSION,build:String(process.env.BUILD_NUMBER)};
const BASE='https://api.appstoreconnect.apple.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b64url=v=>Buffer.from(v).toString('base64url');
function jwt(){const now=Math.floor(Date.now()/1000);const h=b64url(JSON.stringify({alg:'ES256',kid:cfg.keyId,typ:'JWT'}));const p=b64url(JSON.stringify({iss:cfg.issuer,iat:now-20,exp:now+900,aud:'appstoreconnect-v1'}));const input=`${h}.${p}`;const sig=crypto.sign('sha256',Buffer.from(input),{key:cfg.privateKey,dsaEncoding:'ieee-p1363'});return `${input}.${sig.toString('base64url')}`}
function params(o){const q=new URLSearchParams();for(const [k,v] of Object.entries(o))if(v!==undefined&&v!==null)q.set(k,String(v));return q.toString()}
function err(j,t){return (j?.errors||[]).map(e=>[e.status,e.code,e.title,e.detail].filter(Boolean).join(' | ')).join('\n')||t||'Unknown Apple error'}
async function api(method,path,body=null,{allow=[]}={}){const r=await fetch(BASE+path,{method,headers:{Authorization:`Bearer ${jwt()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const text=await r.text();let json=null;try{json=text?JSON.parse(text):null}catch{}if(!r.ok&&!allow.includes(r.status))throw new Error(`${method} ${path} -> ${r.status}\n${err(json,text)}`);return{status:r.status,json,text}}
const log=s=>console.log(`[resubmit] ${s}`);

const apps=(await api('GET',`/v1/apps?${params({'filter[bundleId]':cfg.bundleId,'fields[apps]':'name,bundleId',limit:2})}`)).json?.data||[];
const app=apps[0];if(!app)throw new Error(`No app found for ${cfg.bundleId}`);log(`Found ${app.attributes?.name||'Hobah'}.`);
const versions=(await api('GET',`/v1/apps/${app.id}/appStoreVersions?${params({'filter[platform]':'IOS','fields[appStoreVersions]':'platform,versionString,appStoreState,appVersionState,releaseType,build',limit:200})}`)).json?.data||[];
const version=versions.find(v=>v.attributes?.versionString===cfg.version);if(!version)throw new Error(`Version ${cfg.version} not found`);log(`Version ${cfg.version} state: ${version.attributes?.appStoreState||version.attributes?.appVersionState||'unknown'}.`);

let build=null;
for(let i=0;i<46;i++){
  const builds=(await api('GET',`/v1/builds?${params({'filter[app]':app.id,'filter[version]':cfg.build,'fields[builds]':'version,processingState,usesNonExemptEncryption,uploadedDate',limit:20})}`)).json?.data||[];
  build=builds.find(b=>String(b.attributes?.version)===cfg.build)||null;
  if(build?.attributes?.processingState==='VALID')break;
  if(['FAILED','INVALID'].includes(build?.attributes?.processingState))throw new Error(`Apple marked build ${cfg.build} ${build.attributes.processingState}`);
  log(`Waiting for Apple to process build ${cfg.build}${build?` (${build.attributes?.processingState||'processing'})`:''}…`);
  if(i===45)throw new Error(`Build ${cfg.build} did not become VALID in time`);
  await sleep(20000);
}
log(`Build ${cfg.build} is VALID.`);
if(build.attributes?.usesNonExemptEncryption!==false){await api('PATCH',`/v1/builds/${build.id}`,{data:{type:'builds',id:build.id,attributes:{usesNonExemptEncryption:false}}});log('Confirmed no non-exempt encryption.');}

const attached=await api('GET',`/v1/appStoreVersions/${version.id}/build?fields%5Bbuilds%5D=version,processingState`,null,{allow:[404]});
if(attached.status!==200||attached.json?.data?.id!==build.id){await api('PATCH',`/v1/appStoreVersions/${version.id}/relationships/build`,{data:{type:'builds',id:build.id}});log(`Attached correction build ${cfg.build} to version ${cfg.version}.`)}else log(`Correction build ${cfg.build} is already attached.`);
if(version.attributes?.releaseType!=='AFTER_APPROVAL'){await api('PATCH',`/v1/appStoreVersions/${version.id}`,{data:{type:'appStoreVersions',id:version.id,attributes:{releaseType:'AFTER_APPROVAL'}}});log('Release mode set to automatic after approval.');}

const review=await api('GET',`/v1/appStoreVersions/${version.id}/appStoreReviewDetail?fields%5BappStoreReviewDetails%5D=contactFirstName,contactLastName,contactPhone,contactEmail,demoAccountRequired,notes`,null,{allow:[404]});
if(review.status===200&&review.json?.data){
  const notes=`App Review correction build ${cfg.build}.\n\nWe addressed all issues from the previous review:\n\n• Guideline 2.1 App Completeness — Scripture Read Aloud now uses the device speech system and no longer depends on remote natural-voice generation, eliminating the “Natural voice unavailable” failure shown in the reviewer screenshot.\n\n• Guideline 2.5.4 Software Requirements — removed UIBackgroundModes/background-audio execution declarations. Hobah 1.0 uses foreground-only audio.\n\n• Guideline 4.0 Design — rebuilt the iPad reader toolbar as a responsive multi-row/grid layout with full-size touch targets so Find, Books and the other reader controls are no longer clipped or crowded in landscape.\n\n• Guideline 5.1.2 Privacy — before any optional Study AI or related online AI request is sent to OpenAI, Hobah now presents an explicit permission screen that names OpenAI and explains that the user’s question, relevant Scripture/Ancient Library passage and study context may be shared through Hobah’s server. Users can choose Not now and continue using core reading, search, bookmarks, notes, Library and on-device Read Aloud. The privacy policy and App Store description were updated to match.\n\nPlease review build ${cfg.build}.`;
  await api('PATCH',`/v1/appStoreReviewDetails/${review.json.data.id}`,{data:{type:'appStoreReviewDetails',id:review.json.data.id,attributes:{notes}}});log('Updated App Review notes with the four fixes.');
}

const submissions=(await api('GET',`/v1/apps/${app.id}/reviewSubmissions?${params({'fields[reviewSubmissions]':'platform,submittedDate,state,items,appStoreVersionForReview',include:'items',limit:50,'limit[items]':50,'fields[reviewSubmissionItems]':'state,appStoreVersion'})}`)).json?.data||[];
let sub=submissions.find(s=>s.attributes?.state==='UNRESOLVED_ISSUES')||submissions.find(s=>s.attributes?.state==='READY_FOR_REVIEW');
if(!sub)throw new Error('No unresolved or ready App Review submission found to update.');
log(`Review submission state: ${sub.attributes?.state}.`);
async function listItems(){return (await api('GET',`/v1/reviewSubmissions/${sub.id}/items?include=appStoreVersion&fields%5BreviewSubmissionItems%5D=state,appStoreVersion&fields%5BappStoreVersions%5D=versionString,appStoreState,appVersionState&limit=50`)).json||{}}
let itemResp=await listItems();
let included=itemResp.included||[];
let item=(itemResp.data||[]).find(i=>i.relationships?.appStoreVersion?.data?.id===version.id)||
  (itemResp.data||[]).find(i=>{const id=i.relationships?.appStoreVersion?.data?.id;const v=included.find(x=>x.type==='appStoreVersions'&&x.id===id);return v?.attributes?.versionString===cfg.version});
if(!item)throw new Error(`Could not find version ${cfg.version} in the unresolved review submission.`);
log(`Review item state: ${item.attributes?.state||'unknown'}.`);

// Apple's unresolved-issues flow is two distinct actions: first resolve/edit the
// rejected item until it is Ready for Review, then resubmit the parent submission.
// The item resource intentionally has no GET-instance operation, so readiness is
// re-read through the supported reviewSubmissions/{id}/items list endpoint.
if(item.attributes?.state==='REJECTED'){
  const resolved=await api('PATCH',`/v1/reviewSubmissionItems/${item.id}`,{data:{type:'reviewSubmissionItems',id:item.id,attributes:{resolved:true}}},{allow:[400,409,422]});
  if(resolved.status>=400)throw new Error(`Apple did not accept the Update Review action for the rejected item (${resolved.status}).\n${err(resolved.json,resolved.text)}`);
  item=resolved.json?.data||item;
  log(`Updated rejected item; Apple now reports item state ${item.attributes?.state||'processing'}.`);
}

for(let i=0;item.attributes?.state!=='READY_FOR_REVIEW'&&i<20;i++){
  itemResp=await listItems();
  const current=(itemResp.data||[]).find(x=>x.id===item.id);
  if(current)item=current;
  const state=item.attributes?.state||'';
  if(state==='READY_FOR_REVIEW')break;
  log(`Waiting for review item readiness: ${state||'processing'}…`);
  if(i===19)throw new Error(`Review item did not become READY_FOR_REVIEW after Update Review; current state: ${state||'unknown'}`);
  await sleep(1500);
}
if(item.attributes?.state!=='READY_FOR_REVIEW')throw new Error(`Correction item is not Ready for Review: ${item.attributes?.state||'unknown'}`);
log('Correction item is Ready for Review.');

const freshSub=await api('GET',`/v1/reviewSubmissions/${sub.id}?fields%5BreviewSubmissions%5D=platform,submittedDate,state`);
sub=freshSub.json?.data||sub;
if(['UNRESOLVED_ISSUES','READY_FOR_REVIEW'].includes(sub.attributes?.state)){
  const sent=await api('PATCH',`/v1/reviewSubmissions/${sub.id}`,{data:{type:'reviewSubmissions',id:sub.id,attributes:{submitted:true}}});
  sub=sent.json?.data||sub;
  log(`Resubmission request accepted; Apple state: ${sub.attributes?.state||'processing'}.`);
}

for(let i=0;i<20;i++){
  const r=await api('GET',`/v1/reviewSubmissions/${sub.id}?fields%5BreviewSubmissions%5D=platform,submittedDate,state`);sub=r.json?.data||sub;const state=sub.attributes?.state||'';
  if(['WAITING_FOR_REVIEW','IN_REVIEW','COMPLETE'].includes(state)){log(`Apple review state: ${state}.`);process.exit(0)}
  if(state==='UNRESOLVED_ISSUES'&&i>2)throw new Error('Submission returned to UNRESOLVED_ISSUES after resubmission.');
  log(`Waiting for App Review submission state: ${state||'processing'}…`);
  await sleep(2500);
}
throw new Error(`App Review resubmission was not confirmed; final state: ${sub.attributes?.state||'unknown'}`);
