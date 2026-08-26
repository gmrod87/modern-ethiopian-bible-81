const realFetch=globalThis.fetch.bind(globalThis);

const asJsonResponse=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json'}});

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
      if(existing.status!==404)return existing;
      const headers={...(init?.headers||{})};
      const bundle=process.env.BUNDLE_ID||'com.hobah.bible';
      const appsUrl=`https://api.appstoreconnect.apple.com/v1/apps?filter%5BbundleId%5D=${encodeURIComponent(bundle)}&limit=1`;
      const appsResp=await realFetch(appsUrl,{method:'GET',headers});
      if(!appsResp.ok)return existing;
      const app=(await appsResp.json())?.data?.[0];
      if(!app)return existing;
      const fields='contactFirstName,contactLastName,contactPhone,contactEmail,demoAccountName,demoAccountPassword,demoAccountRequired,notes';
      const betaResp=await realFetch(`https://api.appstoreconnect.apple.com/v1/apps/${encodeURIComponent(app.id)}/betaAppReviewDetail?fields%5BbetaAppReviewDetails%5D=${encodeURIComponent(fields)}`,{method:'GET',headers});
      if(!betaResp.ok)return existing;
      const beta=(await betaResp.json())?.data, a=beta?.attributes||{};
      if(!['contactFirstName','contactLastName','contactPhone','contactEmail'].every(k=>String(a[k]||'').trim()))return existing;
      const attrs={contactFirstName:a.contactFirstName,contactLastName:a.contactLastName,contactPhone:a.contactPhone,contactEmail:a.contactEmail,demoAccountRequired:!!a.demoAccountRequired};
      if(a.notes)attrs.notes=a.notes;
      if(a.demoAccountRequired&&a.demoAccountName)attrs.demoAccountName=a.demoAccountName;
      if(a.demoAccountRequired&&a.demoAccountPassword)attrs.demoAccountPassword=a.demoAccountPassword;
      const versionId=decodeURIComponent(reviewMatch[1]);
      const create=await realFetch('https://api.appstoreconnect.apple.com/v1/appStoreReviewDetails',{
        method:'POST',headers,
        body:JSON.stringify({data:{type:'appStoreReviewDetails',attributes:attrs,relationships:{appStoreVersion:{data:{type:'appStoreVersions',id:versionId}}}}})
      });
      if(!create.ok)return create;
      console.log('Copied existing TestFlight review contact into the App Store review record.');
      return create;
    }
  }catch(e){console.warn('App Store release runner compatibility layer:',e?.message||e)}
  return realFetch(input,init);
};

await import('./appstore-submit.mjs');
