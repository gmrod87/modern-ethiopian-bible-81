import crypto from 'node:crypto';
import fs from 'node:fs';

const realFetch=globalThis.fetch.bind(globalThis);

const asJsonResponse=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json'}});

function loadEncryptedReviewContact(){
  const path=process.env.APPSTORE_CONTACT_CIPHERTEXT_PATH||'';
  if(!path||!fs.existsSync(path))return null;
  const envelope=JSON.parse(fs.readFileSync(path,'utf8'));
  if(envelope?.scheme!=='p256-hkdf-sha256-aes-256-gcm')throw new Error('Unsupported App Review contact encryption scheme.');
  const privatePem=Buffer.from(process.env.APP_STORE_CONNECT_API_KEY_P8_BASE64||'','base64').toString('utf8');
  const privateKey=crypto.createPrivateKey(privatePem);
  const ephemeralPublicKey=crypto.createPublicKey({
    key:Buffer.from(envelope.ephemeralPublicKeySpkiB64,'base64'),
    format:'der',type:'spki'
  });
  const shared=crypto.diffieHellman({privateKey,publicKey:ephemeralPublicKey});
  const key=Buffer.from(crypto.hkdfSync('sha256',shared,Buffer.from(envelope.saltB64,'base64'),Buffer.from('hobah-app-review-contact-v1'),32));
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.ivB64,'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tagB64,'base64'));
  const plaintext=Buffer.concat([decipher.update(Buffer.from(envelope.ciphertextB64,'base64')),decipher.final()]);
  const contact=JSON.parse(plaintext.toString('utf8'));
  for(const k of ['contactFirstName','contactLastName','contactPhone','contactEmail']){
    if(!String(contact?.[k]||'').trim())throw new Error(`Encrypted App Review contact is missing ${k}.`);
  }
  return contact;
}

globalThis.fetch=async(input,init)=>{
  try{
    const original=new URL(typeof input==='string'?input:input.url);
    const method=String(init?.method||'GET').toUpperCase();
    if(original.hostname==='api.appstoreconnect.apple.com'&&original.pathname==='/v1/appStoreVersions'&&method==='GET'){
      const appId=original.searchParams.get('filter[app]');
      if(appId){
        const u=new URL(original);
        u.pathname=`/v1/apps/${encodeURIComponent(appId)}/appStoreVersions`;
        u.searchParams.delete('filter[app]');
        let r=await realFetch(u.toString(),init);
        if(!r.ok)return r;
        const payload=await r.json();
        const wanted=process.env.MARKETING_VERSION||'1.0.0';
        const match=(payload?.data||[]).find(v=>v?.attributes?.versionString===wanted&&v?.attributes?.platform==='IOS');
        if(match)return asJsonResponse({...payload,data:[match]},r.status);

        const allUrl=new URL(u);
        allUrl.searchParams.delete('filter[versionString]');
        allUrl.searchParams.set('limit','200');
        const allResp=await realFetch(allUrl.toString(),init);
        let versions=[];
        if(allResp.ok){
          const all=await allResp.json();
          versions=(all?.data||[]).filter(v=>v?.attributes?.platform==='IOS');
          console.log('Existing iOS App Store versions:',versions.map(v=>`${v.attributes?.versionString||'?'} [${v.attributes?.appStoreState||v.attributes?.appVersionState||'?'}] id=${v.id}`).join('; ')||'none');
        }

        const editable=versions.find(v=>(v.attributes?.appStoreState||v.attributes?.appVersionState)==='PREPARE_FOR_SUBMISSION');
        if(editable){
          const headers={...(init?.headers||{})};
          const rename=await realFetch(`https://api.appstoreconnect.apple.com/v1/appStoreVersions/${encodeURIComponent(editable.id)}`,{
            method:'PATCH',headers,
            body:JSON.stringify({data:{type:'appStoreVersions',id:editable.id,attributes:{versionString:wanted,releaseType:'AFTER_APPROVAL'}}})
          });
          if(!rename.ok)return rename;
          const updated=await rename.json();
          console.log(`Updated draft App Store version ${editable.attributes?.versionString||''} to ${wanted} to match the signed build.`);
          return asJsonResponse({data:[updated.data]});
        }

        const headers={...(init?.headers||{})};
        const create=await realFetch('https://api.appstoreconnect.apple.com/v1/appStoreVersions',{
          method:'POST',headers,
          body:JSON.stringify({data:{type:'appStoreVersions',attributes:{platform:'IOS',versionString:wanted,releaseType:'AFTER_APPROVAL',usesIdfa:false},relationships:{app:{data:{type:'apps',id:appId}}}}})
        });
        if(!create.ok)return create;
        const made=await create.json();
        console.log(`Created App Store version ${wanted} for Hobah.`);
        return asJsonResponse({data:[made.data]});
      }
    }

    const reviewMatch=original.hostname==='api.appstoreconnect.apple.com'&&method==='GET'&&original.pathname.match(/^\/v1\/appStoreVersions\/([^/]+)\/appStoreReviewDetail$/);
    if(reviewMatch){
      const existing=await realFetch(input,init);
      if(existing.status===200){
        let payload=null;
        try{payload=await existing.clone().json()}catch{}
        if(payload?.data)return existing;
      }else if(existing.status!==404){
        return existing;
      }
      const headers={...(init?.headers||{})};
      let attrs=null;
      const bundle=process.env.BUNDLE_ID||'com.hobah.bible';
      const appsUrl=`https://api.appstoreconnect.apple.com/v1/apps?filter%5BbundleId%5D=${encodeURIComponent(bundle)}&limit=1`;
      const appsResp=await realFetch(appsUrl,{method:'GET',headers});
      if(appsResp.ok){
        const app=(await appsResp.json())?.data?.[0];
        if(app){
          const fields='contactFirstName,contactLastName,contactPhone,contactEmail,demoAccountName,demoAccountPassword,demoAccountRequired,notes';
          const betaResp=await realFetch(`https://api.appstoreconnect.apple.com/v1/apps/${encodeURIComponent(app.id)}/betaAppReviewDetail?fields%5BbetaAppReviewDetails%5D=${encodeURIComponent(fields)}`,{method:'GET',headers});
          if(betaResp.ok){
            const beta=(await betaResp.json())?.data, a=beta?.attributes||{};
            if(['contactFirstName','contactLastName','contactPhone','contactEmail'].every(k=>String(a[k]||'').trim())){
              attrs={contactFirstName:a.contactFirstName,contactLastName:a.contactLastName,contactPhone:a.contactPhone,contactEmail:a.contactEmail,demoAccountRequired:!!a.demoAccountRequired};
              if(a.notes)attrs.notes=a.notes;
              if(a.demoAccountRequired&&a.demoAccountName)attrs.demoAccountName=a.demoAccountName;
              if(a.demoAccountRequired&&a.demoAccountPassword)attrs.demoAccountPassword=a.demoAccountPassword;
              console.log('Using existing TestFlight review contact for App Store review.');
            }
          }
        }
      }
      if(!attrs){
        const contact=loadEncryptedReviewContact();
        if(contact){
          attrs={
            contactFirstName:contact.contactFirstName,
            contactLastName:contact.contactLastName,
            contactPhone:contact.contactPhone,
            contactEmail:contact.contactEmail,
            demoAccountRequired:!!contact.demoAccountRequired
          };
          if(contact.notes)attrs.notes=contact.notes;
          if(contact.demoAccountRequired&&contact.demoAccountName)attrs.demoAccountName=contact.demoAccountName;
          if(contact.demoAccountRequired&&contact.demoAccountPassword)attrs.demoAccountPassword=contact.demoAccountPassword;
          console.log('Decrypted the secure App Review contact payload for Apple submission.');
        }
      }
      if(!attrs)return existing;
      const versionId=decodeURIComponent(reviewMatch[1]);
      const create=await realFetch('https://api.appstoreconnect.apple.com/v1/appStoreReviewDetails',{
        method:'POST',headers,
        body:JSON.stringify({data:{type:'appStoreReviewDetails',attributes:attrs,relationships:{appStoreVersion:{data:{type:'appStoreVersions',id:versionId}}}}})
      });
      if(!create.ok)return create;
      console.log('Created the App Store review contact record without exposing private contact details.');
      return create;
    }
  }catch(e){console.warn('App Store release runner compatibility layer:',e?.message||e)}
  return realFetch(input,init);
};

await import('./appstore-submit.mjs');
