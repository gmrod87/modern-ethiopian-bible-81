import crypto from 'node:crypto';
import fs from 'node:fs';

const required=['APP_STORE_CONNECT_ISSUER_ID','APP_STORE_CONNECT_KEY_ID','APP_STORE_CONNECT_API_KEY_P8_BASE64','BUNDLE_ID','MARKETING_VERSION','BUILD_NUMBER'];
for(const k of required)if(!process.env[k])throw new Error(`Missing required environment variable: ${k}`);

const cfg={
  issuer:process.env.APP_STORE_CONNECT_ISSUER_ID,
  keyId:process.env.APP_STORE_CONNECT_KEY_ID,
  privateKey:Buffer.from(process.env.APP_STORE_CONNECT_API_KEY_P8_BASE64,'base64').toString('utf8'),
  bundleId:process.env.BUNDLE_ID,
  version:process.env.MARKETING_VERSION,
  build:String(process.env.BUILD_NUMBER),
  report:process.env.APPSTORE_REPORT_PATH||''
};
const BASE='https://api.appstoreconnect.apple.com';
const SUPPORT_URL='https://modern-ethiopian-bible-81.vercel.app/support.html';
const MARKETING_URL='https://modern-ethiopian-bible-81.vercel.app/';
const DEFAULT_DESCRIPTION=`Hobah brings the 81-book Ethiopian canon and a curated Ancient Library into one focused reading and study app.

Read searchable Scripture, continue where you left off, save passages and notes, listen with natural Read Aloud, and explore ancient writings alongside the biblical text.

Features:
• 81-book Ethiopian canon with fast book and chapter navigation
• Ancient Library with public-domain and rights-safe historical writings
• Fragmentary ancient works presented transparently as surviving fragments or sections
• Search across Scripture
• Saved verses, highlights, notes and reading progress
• Natural Read Aloud with playback controls
• Study AI for explanations, historical context, manuscripts and research
• Voice Commands for hands-free reading controls
• Offline access to bundled reading texts; an internet connection is required for Study AI and natural voice generation
• Privacy-focused local storage for saved reading data

Hobah is designed for readers who want broad access to biblical and ancient literature in a clean interface. Ancient works may be fragmentary or based on historical translations; Hobah identifies them accordingly rather than presenting missing material as complete.`;
const DEFAULT_KEYWORDS='bible,ethiopian,enoch,jubilees,scripture,ancient,study,read aloud,apocrypha';
const notes=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b64url=v=>Buffer.from(v).toString('base64url');
const stateOf=v=>v?.attributes?.appStoreState||v?.attributes?.appVersionState||'';
function note(s){notes.push(s);console.log(s)}
function token(){
  const now=Math.floor(Date.now()/1000);
  const h=b64url(JSON.stringify({alg:'ES256',kid:cfg.keyId,typ:'JWT'}));
  const p=b64url(JSON.stringify({iss:cfg.issuer,iat:now-20,exp:now+900,aud:'appstoreconnect-v1'}));
  const input=`${h}.${p}`;
  const sig=crypto.sign('sha256',Buffer.from(input),{key:cfg.privateKey,dsaEncoding:'ieee-p1363'});
  return `${input}.${sig.toString('base64url')}`;
}
function params(obj){const q=new URLSearchParams();for(const [k,v] of Object.entries(obj))if(v!==undefined&&v!==null)q.set(k,String(v));return q.toString()}
function appleError(json,text){
  const es=Array.isArray(json?.errors)?json.errors:[];
  if(es.length)return es.map(e=>[e.status,e.code,e.title,e.detail].filter(Boolean).join(' | ')).join('\n');
  return text||'Unknown App Store Connect error';
}
async function api(method,path,body=null,{allow=[]}={}){
  const r=await fetch(BASE+path,{method,headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const text=await r.text();let json=null;try{json=text?JSON.parse(text):null}catch{}
  if(!r.ok&&!allow.includes(r.status))throw new Error(`${method} ${path} -> ${r.status}\n${appleError(json,text)}`);
  return {status:r.status,json,text};
}
function report(status,extra={}){
  const lines=['# Hobah App Store Release Status','',`- status: ${status}`,`- bundle_id: ${cfg.bundleId}`,`- marketing_version: ${cfg.version}`,`- build_number: ${cfg.build}`,`- checked_at_utc: ${new Date().toISOString()}`];
  for(const [k,v] of Object.entries(extra))lines.push(`- ${k}: ${String(v)}`);
  lines.push('','## Checks and actions','',...notes.map(x=>`- ${x}`),'');
  const out=lines.join('\n');console.log('\n'+out);if(cfg.report)fs.writeFileSync(cfg.report,out);
}
async function findApp(){
  const q=params({'filter[bundleId]':cfg.bundleId,limit:2});
  const {json}=await api('GET',`/v1/apps?${q}`);const app=json?.data?.[0];if(!app)throw new Error(`No App Store Connect app found for ${cfg.bundleId}`);return app;
}
async function findVersion(appId){
  const q=params({'filter[app]':appId,'filter[platform]':'IOS','filter[versionString]':cfg.version,'fields[appStoreVersions]':'platform,versionString,appStoreState,appVersionState,releaseType,reviewType,createdDate',limit:20});
  const {json}=await api('GET',`/v1/appStoreVersions?${q}`);const v=json?.data?.find(x=>x.attributes?.versionString===cfg.version);if(!v)throw new Error(`App Store version ${cfg.version} does not exist. Create the version/listing in App Store Connect first.`);return v;
}
async function findBuild(appId){
  for(let i=0;i<46;i++){
    const q=params({'filter[app]':appId,'filter[version]':cfg.build,'fields[builds]':'version,processingState,uploadedDate,usesNonExemptEncryption',limit:20});
    const {json}=await api('GET',`/v1/builds?${q}`);const builds=json?.data||[];const b=builds.find(x=>String(x.attributes?.version)===cfg.build)||builds[0];
    if(b){const ps=b.attributes?.processingState||'';note(`Apple build ${cfg.build} processing state: ${ps||'unknown'}`);if(ps==='VALID')return b;if(['FAILED','INVALID'].includes(ps))throw new Error(`Apple marked build ${cfg.build} as ${ps}`)}
    if(i===45)break;await sleep(20000);
  }
  throw new Error(`Build ${cfg.build} was not VALID in App Store Connect within the polling window.`);
}
async function completeLocalization(loc){
  const a=loc.attributes||{},attributes={};
  if(!String(a.description||'').trim())attributes.description=DEFAULT_DESCRIPTION;
  if(!String(a.supportUrl||'').trim())attributes.supportUrl=SUPPORT_URL;
  if(!String(a.marketingUrl||'').trim())attributes.marketingUrl=MARKETING_URL;
  if(!String(a.keywords||'').trim())attributes.keywords=DEFAULT_KEYWORDS;
  if(!Object.keys(attributes).length)return loc;
  const {json}=await api('PATCH',`/v1/appStoreVersionLocalizations/${loc.id}`,{data:{type:'appStoreVersionLocalizations',id:loc.id,attributes}});
  note(`Completed missing App Store listing metadata for ${a.locale||'the primary locale'}.`);
  return json?.data||{...loc,attributes:{...a,...attributes}};
}
async function metadataChecks(versionId){
  const q=params({'fields[appStoreVersionLocalizations]':'locale,description,keywords,supportUrl,marketingUrl,promotionalText,whatsNew',limit:50});
  let {json}=await api('GET',`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?${q}`);let locs=json?.data||[];
  if(!locs.length){
    const created=await api('POST','/v1/appStoreVersionLocalizations',{data:{type:'appStoreVersionLocalizations',attributes:{locale:'en-US',description:DEFAULT_DESCRIPTION,keywords:DEFAULT_KEYWORDS,supportUrl:SUPPORT_URL,marketingUrl:MARKETING_URL},relationships:{appStoreVersion:{data:{type:'appStoreVersions',id:versionId}}}}});
    locs=created.json?.data?[created.json.data]:[];note('Created the English App Store listing metadata.');
  }else locs=await Promise.all(locs.map(completeLocalization));
  const usable=locs.filter(x=>String(x.attributes?.description||'').trim()&&String(x.attributes?.supportUrl||'').trim());
  if(!usable.length)throw new Error('App Store listing is missing a description or support URL.');
  note(`App Store listing metadata present for ${usable.map(x=>x.attributes?.locale).join(', ')}`);
  let screenshotCount=0;
  for(const loc of usable){
    const r=await api('GET',`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&limit=50&limit%5BappScreenshots%5D=50`,null,{allow:[403,404]});
    if(r.status===200)screenshotCount+=(r.json?.included||[]).filter(x=>x.type==='appScreenshots').length;
  }
  if(screenshotCount)note(`App Store screenshots found: ${screenshotCount}`);else note('Screenshot inventory could not be fully confirmed by API; Apple submission validation will enforce screenshot requirements.');
  const review=await api('GET',`/v1/appStoreVersions/${versionId}/appStoreReviewDetail?fields%5BappStoreReviewDetails%5D=contactFirstName,contactLastName,contactPhone,contactEmail,demoAccountRequired,notes`,null,{allow:[404]});
  if(review.status===404||!review.json?.data)throw new Error('App Review contact details are missing for this version.');
  const a=review.json.data.attributes||{};for(const k of ['contactFirstName','contactLastName','contactPhone','contactEmail'])if(!String(a[k]||'').trim())throw new Error(`App Review detail is missing ${k}.`);
  note('App Review contact details are present.');
}
async function attachedBuild(versionId){
  const r=await api('GET',`/v1/appStoreVersions/${versionId}/build?fields%5Bbuilds%5D=version,processingState`,null,{allow:[404]});return r.status===200?r.json?.data:null;
}
async function attachBuild(versionId,build){
  const current=await attachedBuild(versionId);if(current?.id===build.id){note(`Build ${cfg.build} is already attached to App Store version ${cfg.version}.`);return}
  await api('PATCH',`/v1/appStoreVersions/${versionId}/relationships/build`,{data:{type:'builds',id:build.id}});note(`Attached build ${cfg.build} to version ${cfg.version}.`);
}
async function setAutomaticRelease(versionId,current){
  if(current?.attributes?.releaseType==='AFTER_APPROVAL'){note('Release mode is already automatic after Apple approval.');return}
  await api('PATCH',`/v1/appStoreVersions/${versionId}`,{data:{type:'appStoreVersions',id:versionId,attributes:{releaseType:'AFTER_APPROVAL'}}});note('Set App Store release mode to automatic after approval.');
}
async function ensureExportCompliance(build){
  if(build.attributes?.usesNonExemptEncryption===false){note('Export-compliance flag confirms no non-exempt encryption.');return}
  if(build.attributes?.usesNonExemptEncryption==null){
    await api('PATCH',`/v1/builds/${build.id}`,{data:{type:'builds',id:build.id,attributes:{usesNonExemptEncryption:false}}});note('Confirmed build uses no non-exempt encryption in App Store Connect.');return;
  }
  throw new Error('Build is marked as using non-exempt encryption; automatic submission stopped for export-compliance review.');
}
async function activeSubmission(appId){
  const {json}=await api('GET',`/v1/apps/${appId}/reviewSubmissions?limit=50`);const all=json?.data||[];return all.find(x=>['READY_FOR_REVIEW','WAITING_FOR_REVIEW','IN_REVIEW','UNRESOLVED_ISSUES','CANCELING','COMPLETING'].includes(x.attributes?.state));
}
async function ensureSubmission(appId,versionId){
  let sub=await activeSubmission(appId);
  if(sub&&['WAITING_FOR_REVIEW','IN_REVIEW','COMPLETING'].includes(sub.attributes?.state)){note(`Apple review submission is already ${sub.attributes.state}.`);return sub}
  if(sub?.attributes?.state==='UNRESOLVED_ISSUES')throw new Error('The current Apple review submission has unresolved issues.');
  if(!sub){
    const r=await api('POST','/v1/reviewSubmissions',{data:{type:'reviewSubmissions',attributes:{platform:'IOS'},relationships:{app:{data:{type:'apps',id:appId}}}}});sub=r.json?.data;if(!sub)throw new Error('Apple did not return a review submission ID.');note('Created a new App Review submission.');
  }else note('Using the existing draft App Review submission.');
  const ir=await api('GET',`/v1/reviewSubmissions/${sub.id}/items?include=appStoreVersion&limit=50`);const hasVersion=(ir.json?.included||[]).some(x=>x.type==='appStoreVersions'&&x.id===versionId)||(ir.json?.data||[]).some(x=>x.relationships?.appStoreVersion?.data?.id===versionId);
  if(!hasVersion){await api('POST','/v1/reviewSubmissionItems',{data:{type:'reviewSubmissionItems',relationships:{reviewSubmission:{data:{type:'reviewSubmissions',id:sub.id}},appStoreVersion:{data:{type:'appStoreVersions',id:versionId}}}}});note(`Added Hobah ${cfg.version} to the App Review submission.`)}else note(`Hobah ${cfg.version} is already in the App Review submission.`);
  const sent=await api('PATCH',`/v1/reviewSubmissions/${sub.id}`,{data:{type:'reviewSubmissions',id:sub.id,attributes:{submitted:true}}});sub=sent.json?.data||sub;note('Submitted Hobah to Apple App Review.');
  for(let i=0;i<10;i++){
    const r=await api('GET',`/v1/reviewSubmissions/${sub.id}`);sub=r.json?.data||sub;const s=sub.attributes?.state||'';if(['WAITING_FOR_REVIEW','IN_REVIEW','COMPLETING','COMPLETE'].includes(s)){note(`Apple review submission state: ${s}.`);return sub}await sleep(3000);
  }
  note(`Apple review submission state: ${sub.attributes?.state||'submitted'}.`);return sub;
}
async function manualRelease(versionId){
  await api('POST','/v1/appStoreVersionReleaseRequests',{data:{type:'appStoreVersionReleaseRequests',relationships:{appStoreVersion:{data:{type:'appStoreVersions',id:versionId}}}}});note('Apple had already approved the version; manual release request sent to publish it now.');
}

try{
  note(`Final App Store release check for Hobah ${cfg.version} (${cfg.bundleId}), build ${cfg.build}.`);
  const app=await findApp();note(`Found App Store Connect app: ${app.attributes?.name||'Hobah'}.`);
  let version=await findVersion(app.id),state=stateOf(version);note(`Current App Store version state: ${state||'unknown'}.`);
  if(state==='READY_FOR_DISTRIBUTION'){note('Version is already live/ready for distribution.');report('already-live',{app_store_state:state});process.exit(0)}
  if(['PROCESSING_FOR_DISTRIBUTION','PENDING_APPLE_RELEASE'].includes(state)){note('Apple is already processing the approved release.');report('apple-release-processing',{app_store_state:state});process.exit(0)}
  if(state==='PENDING_DEVELOPER_RELEASE'){await manualRelease(version.id);report('release-requested',{app_store_state:state});process.exit(0)}
  if(['REJECTED','METADATA_REJECTED','INVALID_BINARY','DEVELOPER_REJECTED','UNRESOLVED_ISSUES'].includes(state))throw new Error(`Version cannot be published while its App Store state is ${state}.`);
  if(['WAITING_FOR_REVIEW','IN_REVIEW'].includes(state)){note(`The app is already ${state}; it will release automatically after approval if configured that way.`);report('already-in-review',{app_store_state:state});process.exit(0)}
  const build=await findBuild(app.id);await ensureExportCompliance(build);await metadataChecks(version.id);await attachBuild(version.id,build);await setAutomaticRelease(version.id,version);await ensureSubmission(app.id,version.id);
  version=(await api('GET',`/v1/appStoreVersions/${version.id}?fields%5BappStoreVersions%5D=platform,versionString,appStoreState,appVersionState,releaseType`)).json?.data||version;state=stateOf(version);note(`Final App Store version state: ${state||'unknown'}.`);
  report('submitted-for-review',{app_store_state:state,release_type:version.attributes?.releaseType||'AFTER_APPROVAL'});
}catch(e){note(`ERROR: ${e.message}`);report('failed');process.exitCode=1}
