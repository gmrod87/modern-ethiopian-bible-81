import crypto from 'node:crypto';

const required=['APP_STORE_CONNECT_ISSUER_ID','APP_STORE_CONNECT_KEY_ID','APP_STORE_CONNECT_API_KEY_P8_BASE64','BUNDLE_ID'];
for(const k of required) if(!process.env[k]) throw new Error(`Missing ${k}`);

const cfg={
  issuer:process.env.APP_STORE_CONNECT_ISSUER_ID,
  keyId:process.env.APP_STORE_CONNECT_KEY_ID,
  privateKey:Buffer.from(process.env.APP_STORE_CONNECT_API_KEY_P8_BASE64,'base64').toString('utf8'),
  bundleId:process.env.BUNDLE_ID
};
const BASE='https://api.appstoreconnect.apple.com';
const BASE_TERRITORY='AUS';
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
async function api(method,path,body=null,{allow=[]}={}){
  const r=await fetch(BASE+path,{method,headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const text=await r.text();let json=null;try{json=text?JSON.parse(text):null}catch{}
  if(!r.ok&&!allow.includes(r.status)) throw new Error(`${method} ${path} -> ${r.status}\n${appleError(json,text)}`);
  return {status:r.status,json,text};
}
async function findApp(){
  const {json}=await api('GET',`/v1/apps?${params({'filter[bundleId]':cfg.bundleId,'fields[apps]':'name,bundleId',limit:2})}`);
  const app=json?.data?.[0];if(!app)throw new Error(`No app found for ${cfg.bundleId}`);return app;
}
async function getSchedule(appId){
  const r=await api('GET',`/v1/apps/${appId}/appPriceSchedule`,null,{allow:[404]});
  return r.status===200?r.json?.data:null;
}
async function activeFreePrice(scheduleId){
  if(!scheduleId)return false;
  const q=params({include:'appPricePoint','fields[appPrices]':'manual,startDate,endDate,appPricePoint','fields[appPricePoints]':'customerPrice',limit:200});
  const {json}=await api('GET',`/v1/appPriceSchedules/${scheduleId}/manualPrices?${q}`);
  const points=new Map((json?.included||[]).filter(x=>x.type==='appPricePoints').map(x=>[x.id,Number(x.attributes?.customerPrice)]));
  return (json?.data||[]).some(p=>p.attributes?.endDate==null&&points.get(p.relationships?.appPricePoint?.data?.id)===0);
}
async function freePoint(appId){
  const q=params({'filter[territory]':BASE_TERRITORY,'fields[appPricePoints]':'customerPrice,proceeds',limit:200});
  const {json}=await api('GET',`/v1/apps/${appId}/appPricePoints?${q}`);
  const point=(json?.data||[]).find(x=>Number(x.attributes?.customerPrice)===0);
  if(!point)throw new Error(`Apple returned no free price point for ${BASE_TERRITORY}.`);
  return point;
}

const app=await findApp();
console.log(`[pricing] Found ${app.attributes?.name||'Hobah'} (${cfg.bundleId}).`);
let schedule=await getSchedule(app.id);
if(schedule&&await activeFreePrice(schedule.id)){
  console.log('[pricing] App Store price is already Free (A$0.00).');
  process.exit(0);
}
const point=await freePoint(app.id);
const tempId='${freeprice-0}';
const body={
  data:{
    type:'appPriceSchedules',
    attributes:{},
    relationships:{
      app:{data:{type:'apps',id:app.id}},
      manualPrices:{data:[{type:'appPrices',id:tempId}]},
      baseTerritory:{data:{type:'territories',id:BASE_TERRITORY}}
    }
  },
  included:[{
    type:'appPrices',
    id:tempId,
    attributes:{startDate:null,endDate:null},
    relationships:{appPricePoint:{data:{type:'appPricePoints',id:point.id}}}
  }]
};
await api('POST','/v1/appPriceSchedules',body);
console.log('[pricing] Set Hobah base App Store price to Free (A$0.00), base territory Australia.');
schedule=await getSchedule(app.id);
if(!schedule||!(await activeFreePrice(schedule.id))) throw new Error('Apple accepted the price request but an active Free price could not be verified.');
console.log('[pricing] Apple confirms an active Free price schedule.');
