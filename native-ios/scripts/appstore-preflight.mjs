import crypto from 'node:crypto';

const req=['APP_STORE_CONNECT_ISSUER_ID','APP_STORE_CONNECT_KEY_ID','APP_STORE_CONNECT_API_KEY_P8_BASE64','BUNDLE_ID','MARKETING_VERSION'];
for(const k of req)if(!process.env[k])throw new Error(`Missing ${k}`);
const cfg={issuer:process.env.APP_STORE_CONNECT_ISSUER_ID,keyId:process.env.APP_STORE_CONNECT_KEY_ID,privateKey:Buffer.from(process.env.APP_STORE_CONNECT_API_KEY_P8_BASE64,'base64').toString('utf8'),bundleId:process.env.BUNDLE_ID,version:process.env.MARKETING_VERSION};
const BASE='https://api.appstoreconnect.apple.com';
const PRIVACY_URL='https://modern-ethiopian-bible-81.vercel.app/privacy.html';
const b64url=v=>Buffer.from(v).toString('base64url');
function jwt(){const now=Math.floor(Date.now()/1000);const h=b64url(JSON.stringify({alg:'ES256',kid:cfg.keyId,typ:'JWT'}));const p=b64url(JSON.stringify({iss:cfg.issuer,iat:now-20,exp:now+900,aud:'appstoreconnect-v1'}));const i=`${h}.${p}`;const s=crypto.sign('sha256',Buffer.from(i),{key:cfg.privateKey,dsaEncoding:'ieee-p1363'});return `${i}.${s.toString('base64url')}`}
function err(j,t){return (j?.errors||[]).map(e=>[e.status,e.code,e.title,e.detail].filter(Boolean).join(' | ')).join('\n')||t||'Unknown Apple error'}
async function api(method,path,body=null,{allow=[]}={}){const r=await fetch(BASE+path,{method,headers:{Authorization:`Bearer ${jwt()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const text=await r.text();let json=null;try{json=text?JSON.parse(text):null}catch{}if(!r.ok&&!allow.includes(r.status))throw new Error(`${method} ${path} -> ${r.status}\n${err(json,text)}`);return {status:r.status,json,text}}
const note=s=>console.log(`[preflight] ${s}`);
const params=o=>{const q=new URLSearchParams();for(const [k,v] of Object.entries(o))if(v!==undefined&&v!==null)q.set(k,String(v));return q.toString()};

const apps=(await api('GET',`/v1/apps?${params({'filter[bundleId]':cfg.bundleId,'fields[apps]':'name,bundleId,primaryLocale,contentRightsDeclaration,isOrEverWasMadeForKids',limit:2})}`)).json?.data||[];
const app=apps[0];if(!app)throw new Error('Hobah app not found');note(`App ${app.attributes?.name||'Hobah'} found.`);
if(!app.attributes?.contentRightsDeclaration){
  await api('PATCH',`/v1/apps/${app.id}`,{data:{type:'apps',id:app.id,attributes:{contentRightsDeclaration:'USES_THIRD_PARTY_CONTENT'}}});
  note('Declared rights to use included third-party/public-domain content.');
}else note(`Content-rights declaration already present: ${app.attributes.contentRightsDeclaration}.`);

const versions=(await api('GET',`/v1/apps/${app.id}/appStoreVersions?${params({'filter[platform]':'IOS','fields[appStoreVersions]':'platform,versionString,appVersionState,copyright,releaseType,reviewType,build,appStoreVersionLocalizations',limit:200})}`)).json?.data||[];
const version=versions.find(v=>v.attributes?.versionString===cfg.version);if(!version)throw new Error(`Version ${cfg.version} not found`);
if(!String(version.attributes?.copyright||'').trim()){
  await api('PATCH',`/v1/appStoreVersions/${version.id}`,{data:{type:'appStoreVersions',id:version.id,attributes:{copyright:'2026 Hobah'}}});
  note('Added App Store copyright metadata.');
}else note('Copyright metadata already present.');

const infos=(await api('GET',`/v1/apps/${app.id}/appInfos?${params({'fields[appInfos]':'state,appStoreAgeRating,ageRatingDeclaration,appInfoLocalizations,primaryCategory,secondaryCategory',limit:50})}`)).json?.data||[];
const info=infos.find(x=>['PREPARE_FOR_SUBMISSION','READY_FOR_REVIEW'].includes(x.attributes?.state))||infos[0];
if(!info)throw new Error('No App Info record found');note(`App Info state: ${info.attributes?.state||'unknown'}.`);

const locs=(await api('GET',`/v1/appInfos/${info.id}/appInfoLocalizations?${params({'fields[appInfoLocalizations]':'locale,name,subtitle,privacyPolicyUrl,privacyChoicesUrl',limit:50})}`)).json?.data||[];
if(!locs.length)throw new Error('No App Info localization exists.');
for(const loc of locs){
  if(!String(loc.attributes?.privacyPolicyUrl||'').trim()){
    await api('PATCH',`/v1/appInfoLocalizations/${loc.id}`,{data:{type:'appInfoLocalizations',id:loc.id,attributes:{privacyPolicyUrl:PRIVACY_URL}}});
    note(`Added privacy-policy URL for ${loc.attributes?.locale||'localization'}.`);
  }else note(`Privacy-policy URL already present for ${loc.attributes?.locale||'localization'}.`);
}

const cat=await api('GET',`/v1/appInfos/${info.id}/primaryCategory`,null,{allow:[404]});
if(cat.status===404||!cat.json?.data){
  await api('PATCH',`/v1/appInfos/${info.id}`,{data:{type:'appInfos',id:info.id,relationships:{primaryCategory:{data:{type:'appCategories',id:'BOOKS'}}}}});
  note('Set primary App Store category to Books.');
}else note(`Primary category already set: ${cat.json.data.id}.`);

const age=await api('GET',`/v1/appInfos/${info.id}/ageRatingDeclaration?fields%5BageRatingDeclarations%5D=advertising,alcoholTobaccoOrDrugUseOrReferences,contests,gambling,gamblingSimulated,gunsOrOtherWeapons,healthOrWellnessTopics,kidsAgeBand,lootBox,medicalOrTreatmentInformation,messagingAndChat,parentalControls,profanityOrCrudeHumor,ageAssurance,sexualContentGraphicAndNudity,sexualContentOrNudity,socialMedia,socialMediaAgeRestricted,horrorOrFearThemes,matureOrSuggestiveThemes,unrestrictedWebAccess,userGeneratedContent,violenceCartoonOrFantasy,violenceRealisticProlongedGraphicOrSadistic,violenceRealistic,ageRatingOverrideV2,koreaAgeRatingOverride`,null,{allow:[404]});
if(age.status===200&&age.json?.data){
  const id=age.json.data.id;
  const attrs={
    advertising:false,
    alcoholTobaccoOrDrugUseOrReferences:'INFREQUENT_OR_MILD',
    contests:'NONE',
    gambling:false,
    gamblingSimulated:'NONE',
    gunsOrOtherWeapons:'INFREQUENT_OR_MILD',
    healthOrWellnessTopics:false,
    lootBox:false,
    medicalOrTreatmentInformation:'NONE',
    messagingAndChat:false,
    parentalControls:false,
    profanityOrCrudeHumor:'NONE',
    ageAssurance:false,
    sexualContentGraphicAndNudity:'NONE',
    sexualContentOrNudity:'INFREQUENT_OR_MILD',
    socialMedia:false,
    socialMediaAgeRestricted:false,
    horrorOrFearThemes:'INFREQUENT_OR_MILD',
    matureOrSuggestiveThemes:'INFREQUENT_OR_MILD',
    unrestrictedWebAccess:false,
    userGeneratedContent:false,
    violenceCartoonOrFantasy:'INFREQUENT_OR_MILD',
    violenceRealisticProlongedGraphicOrSadistic:'NONE',
    violenceRealistic:'INFREQUENT_OR_MILD',
    ageRatingOverrideV2:'NONE',
    koreaAgeRatingOverride:'NONE'
  };
  const r=await api('PATCH',`/v1/ageRatingDeclarations/${id}`,{data:{type:'ageRatingDeclarations',id,attributes:attrs}}, {allow:[400,409,422]});
  if(r.status>=400)note(`Age-rating update was not accepted (${r.status}); keeping the existing Apple declaration for review.`);else note('Completed the App Store age-rating declaration.');
}else note('Age-rating declaration could not be read; Apple submission validation will report it if required.');

const vlocs=(await api('GET',`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?${params({'fields[appStoreVersionLocalizations]':'locale,description,supportUrl',limit:50})}`)).json?.data||[];
let screenshotCount=0;
for(const loc of vlocs){
  const sets=await api('GET',`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&fields%5BappScreenshotSets%5D=screenshotDisplayType,appScreenshots&fields%5BappScreenshots%5D=fileName,fileSize,sourceFileChecksum,assetDeliveryState&limit=50&limit%5BappScreenshots%5D=50`,null,{allow:[400,403,404]});
  if(sets.status===200){
    const included=sets.json?.included||[];
    screenshotCount+=included.filter(x=>x.type==='appScreenshots').length;
    for(const s of sets.json?.data||[]){const n=(s.relationships?.appScreenshots?.data||[]).length;if(n&&!included.length)screenshotCount+=n;}
  }
}
note(`Confirmed App Store screenshot count visible through API: ${screenshotCount}.`);

const availability=await api('GET',`/v1/apps/${app.id}/appAvailabilityV2`,null,{allow:[403,404]});
if(availability.status===200&&availability.json?.data)note('App availability record exists.');else note(`App availability record not confirmed (HTTP ${availability.status}).`);
const price=await api('GET',`/v1/apps/${app.id}/appPriceSchedule`,null,{allow:[403,404]});
if(price.status===200&&price.json?.data)note('App price schedule exists.');else note(`App price schedule not confirmed (HTTP ${price.status}).`);
note('Metadata preflight complete.');
