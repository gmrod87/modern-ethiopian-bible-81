import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const required=['APP_STORE_CONNECT_ISSUER_ID','APP_STORE_CONNECT_KEY_ID','APP_STORE_CONNECT_API_KEY_P8_BASE64','BUNDLE_ID','MARKETING_VERSION'];
for(const k of required)if(!process.env[k])throw new Error(`Missing required environment variable: ${k}`);
const cfg={issuer:process.env.APP_STORE_CONNECT_ISSUER_ID,keyId:process.env.APP_STORE_CONNECT_KEY_ID,privateKey:Buffer.from(process.env.APP_STORE_CONNECT_API_KEY_P8_BASE64,'base64').toString('utf8'),bundleId:process.env.BUNDLE_ID,version:process.env.MARKETING_VERSION};
const BASE='https://api.appstoreconnect.apple.com';
const dir=process.env.APPSTORE_SCREENSHOT_DIR||path.resolve('native-ios/appstore-screenshots');
const targets=[
  {display:'APP_IPHONE_67',file:path.join(dir,'hobah-iphone-67-home.jpg'),expected:[1290,2796]},
  {display:'APP_IPAD_PRO_3GEN_129',file:path.join(dir,'hobah-ipad-129-home.jpg'),expected:[2048,2732]}
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b64url=v=>Buffer.from(v).toString('base64url');
function jwt(){const now=Math.floor(Date.now()/1000);const h=b64url(JSON.stringify({alg:'ES256',kid:cfg.keyId,typ:'JWT'}));const p=b64url(JSON.stringify({iss:cfg.issuer,iat:now-20,exp:now+900,aud:'appstoreconnect-v1'}));const input=`${h}.${p}`;const sig=crypto.sign('sha256',Buffer.from(input),{key:cfg.privateKey,dsaEncoding:'ieee-p1363'});return `${input}.${sig.toString('base64url')}`}
function appleError(json,text){const es=Array.isArray(json?.errors)?json.errors:[];return es.length?es.map(e=>[e.status,e.code,e.title,e.detail].filter(Boolean).join(' | ')).join('\n'):(text||'Unknown Apple error')}
async function api(method,p,body=null,{allow=[]}={}){const r=await fetch(BASE+p,{method,headers:{Authorization:`Bearer ${jwt()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const text=await r.text();let json=null;try{json=text?JSON.parse(text):null}catch{}if(!r.ok&&!allow.includes(r.status))throw new Error(`${method} ${p} -> ${r.status}\n${appleError(json,text)}`);return {status:r.status,json,text}}
const qs=o=>{const q=new URLSearchParams();for(const [k,v] of Object.entries(o))if(v!==undefined&&v!==null)q.set(k,String(v));return q.toString()};

for(const t of targets)if(!fs.existsSync(t.file))throw new Error(`Missing rendered screenshot ${t.file}`);
const app=(await api('GET',`/v1/apps?${qs({'filter[bundleId]':cfg.bundleId,limit:1})}`)).json?.data?.[0];
if(!app)throw new Error('Hobah app not found in App Store Connect.');
const versions=(await api('GET',`/v1/apps/${app.id}/appStoreVersions?${qs({'filter[platform]':'IOS','fields[appStoreVersions]':'platform,versionString,appStoreState,appVersionState',limit:200})}`)).json?.data||[];
const version=versions.find(v=>v.attributes?.versionString===cfg.version);if(!version)throw new Error(`App Store version ${cfg.version} not found.`);
const locs=(await api('GET',`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?${qs({'fields[appStoreVersionLocalizations]':'locale,appScreenshotSets',limit:50})}`)).json?.data||[];
const loc=locs.find(x=>x.attributes?.locale==='en-AU')||locs[0];if(!loc)throw new Error('No App Store localization found.');

async function ensureSet(display){
  const list=await api('GET',`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?${qs({'filter[screenshotDisplayType]':display,'fields[appScreenshotSets]':'screenshotDisplayType,appScreenshots',limit:50})}`);
  let set=(list.json?.data||[]).find(x=>x.attributes?.screenshotDisplayType===display);
  if(set)return set;
  const made=await api('POST','/v1/appScreenshotSets',{data:{type:'appScreenshotSets',attributes:{screenshotDisplayType:display},relationships:{appStoreVersionLocalization:{data:{type:'appStoreVersionLocalizations',id:loc.id}}}}});
  set=made.json?.data;if(!set)throw new Error(`Apple did not create screenshot set ${display}.`);
  console.log(`Created screenshot set ${display}.`);return set;
}

async function uploadOne(set,t){
  const existing=await api('GET',`/v1/appScreenshotSets/${set.id}/appScreenshots?${qs({'fields[appScreenshots]':'fileName,fileSize,sourceFileChecksum,assetDeliveryState',limit:200})}`);
  for(const shot of existing.json?.data||[]){
    const state=shot.attributes?.assetDeliveryState?.state||shot.attributes?.assetDeliveryState||'';
    if(state==='COMPLETE'){console.log(`A completed screenshot already exists for ${t.display}; keeping it.`);return shot;}
  }
  const bytes=fs.readFileSync(t.file),fileName=path.basename(t.file);
  const reserve=await api('POST','/v1/appScreenshots',{data:{type:'appScreenshots',attributes:{fileName,fileSize:bytes.length},relationships:{appScreenshotSet:{data:{type:'appScreenshotSets',id:set.id}}}}});
  const shot=reserve.json?.data;if(!shot)throw new Error(`No screenshot reservation returned for ${t.display}.`);
  const ops=shot.attributes?.uploadOperations||[];if(!ops.length)throw new Error(`No upload operations returned for ${t.display}.`);
  for(const op of ops){
    const headers={};for(const h of op.requestHeaders||[])headers[h.name]=h.value;
    const offset=Number(op.offset||0),length=Number(op.length||0),chunk=bytes.subarray(offset,offset+length);
    const r=await fetch(op.url,{method:op.method||'PUT',headers,body:chunk});
    if(!r.ok)throw new Error(`Apple screenshot blob upload failed for ${t.display}: HTTP ${r.status}`);
  }
  const md5=crypto.createHash('md5').update(bytes).digest('hex');
  await api('PATCH',`/v1/appScreenshots/${shot.id}`,{data:{type:'appScreenshots',id:shot.id,attributes:{uploaded:true,sourceFileChecksum:md5}}});
  for(let i=0;i<40;i++){
    const check=await api('GET',`/v1/appScreenshots/${shot.id}?${qs({'fields[appScreenshots]':'fileName,fileSize,sourceFileChecksum,assetDeliveryState,imageAsset'})}`);
    const a=check.json?.data?.attributes||{},state=a.assetDeliveryState?.state||a.assetDeliveryState||'';
    if(state==='COMPLETE'){console.log(`Apple processed ${t.display} screenshot successfully.`);return check.json.data;}
    if(state==='FAILED')throw new Error(`Apple failed processing ${t.display} screenshot: ${JSON.stringify(a.assetDeliveryState)}`);
    await sleep(3000);
  }
  throw new Error(`Timed out waiting for Apple to process ${t.display} screenshot.`);
}

for(const t of targets){const set=await ensureSet(t.display);await uploadOne(set,t)}
console.log('Required iPhone and iPad App Store screenshots are present.');
