const realFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=(input,init)=>{
  try{
    const u=new URL(typeof input==='string'?input:input.url);
    if(u.hostname==='api.appstoreconnect.apple.com'&&u.pathname==='/v1/appStoreVersions'){
      const appId=u.searchParams.get('filter[app]');
      if(appId){
        u.pathname=`/v1/apps/${encodeURIComponent(appId)}/appStoreVersions`;
        u.searchParams.delete('filter[app]');
        input=u.toString();
      }
    }
  }catch{}
  return realFetch(input,init);
};
await import('./appstore-submit.mjs');
