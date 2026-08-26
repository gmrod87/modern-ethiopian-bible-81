const realFetch=globalThis.fetch.bind(globalThis);

globalThis.fetch=async(input,init)=>{
  try{
    const original=new URL(typeof input==='string'?input:input.url);
    if(original.hostname==='api.appstoreconnect.apple.com'&&original.pathname==='/v1/appStoreVersions'&&String(init?.method||'GET').toUpperCase()==='GET'){
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
        if(match)return new Response(JSON.stringify({...payload,data:[match]}),{status:r.status,headers:{'content-type':'application/json'}});

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
            method:'PATCH',
            headers,
            body:JSON.stringify({data:{type:'appStoreVersions',id:editable.id,attributes:{versionString:wanted,releaseType:'AFTER_APPROVAL'}}})
          });
          if(!rename.ok)return rename;
          const updated=await rename.json();
          console.log(`Updated draft App Store version ${editable.attributes?.versionString||''} to ${wanted} to match the signed build.`);
          return new Response(JSON.stringify({data:[updated.data]}),{status:200,headers:{'content-type':'application/json'}});
        }

        const headers={...(init?.headers||{})};
        const create=await realFetch('https://api.appstoreconnect.apple.com/v1/appStoreVersions',{
          method:'POST',
          headers,
          body:JSON.stringify({data:{type:'appStoreVersions',attributes:{platform:'IOS',versionString:wanted,releaseType:'AFTER_APPROVAL',usesIdfa:false},relationships:{app:{data:{type:'apps',id:appId}}}}})
        });
        if(!create.ok)return create;
        const made=await create.json();
        console.log(`Created App Store version ${wanted} for Hobah.`);
        return new Response(JSON.stringify({data:[made.data]}),{status:200,headers:{'content-type':'application/json'}});
      }
    }
  }catch(e){console.warn('App Store release runner compatibility layer:',e?.message||e)}
  return realFetch(input,init);
};

await import('./appstore-submit.mjs');
