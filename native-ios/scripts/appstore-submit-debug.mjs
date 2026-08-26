const priorFetch=globalThis.fetch.bind(globalThis);

globalThis.fetch=async(input,init)=>{
  const r=await priorFetch(input,init);
  try{
    const u=new URL(typeof input==='string'?input:input.url);
    const method=String(init?.method||'GET').toUpperCase();
    if(u.hostname==='api.appstoreconnect.apple.com'&&u.pathname==='/v1/reviewSubmissionItems'&&method==='POST'&&!r.ok){
      const text=await r.clone().text();
      console.log('APPLE_REVIEW_VALIDATION_RESPONSE_BEGIN');
      console.log(text);
      console.log('APPLE_REVIEW_VALIDATION_RESPONSE_END');
    }
  }catch{}
  return r;
};

await import('./appstore-submit-runner.mjs');
