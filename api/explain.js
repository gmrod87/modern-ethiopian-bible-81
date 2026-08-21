module.exports=async function handler(req,res){
  res.setHeader('access-control-allow-origin','*');
  res.setHeader('access-control-allow-methods','POST,OPTIONS');
  res.setHeader('access-control-allow-headers','content-type');
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
  const send=(status,payload)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');return res.end(JSON.stringify(payload))};
  if(req.method!=='POST')return send(405,{error:'Method not allowed'});
  const apiKey=process.env.OPENAI_API_KEY||process.env.OPENAI_KEY||process.env.OPENAI_SECRET_KEY||'';
  if(!apiKey)return send(503,{error:'Study AI is not configured'});
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const capWords=(text,max=300)=>{
    text=clean(text);const words=text.split(/\s+/).filter(Boolean);if(words.length<=max)return text;
    let out=words.slice(0,max).join(' ');
    const marks=[...out.matchAll(/[.!?](?=\s|$)/g)];
    const last=marks.at(-1);if(last&&last.index>out.length*.62)out=out.slice(0,last.index+1);
    else out=out.replace(/[,:;\-–—]+$/,'')+'.';
    return out;
  };
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),ctx=body.context||{};
    const reference=clean(body.reference||ctx.currentReference||'the current verse').slice(0,240);
    const question=clean(body.question||`Explain ${reference} in more detail.`).slice(0,1200);
    const scripture=String(ctx.scripture||'').slice(0,2600),section=String(ctx.sectionContext||'').slice(0,1000),background=String(ctx.bookBackground||'').slice(0,900);
    const prompt=`REFERENCE: ${reference}\n\nSCRIPTURE:\n${scripture}\n\nIMMEDIATE CONTEXT:\n${section}\n\nBOOK BACKGROUND:\n${background}\n\nQUESTION: ${question}\n\nGive one complete spoken explanation. Start with the answer immediately. Explain what is happening in the verse, its immediate literary context, and why it matters. Aim for 220–270 words. HARD LIMIT: never exceed 300 words. Finish with a complete sentence. No headings, bullets, markdown, preamble, or follow-up question.`;
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),18000);
    let r;
    try{
      r=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:ctl.signal,headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.4-nano',store:false,stream:false,reasoning:{effort:'none'},text:{verbosity:'low'},max_output_tokens:520,instructions:'You are Study AI inside Hobah, a research-oriented Ethiopian Bible edition. Be accurate, concise and useful. Treat supplied Scripture and context as primary. Distinguish tradition from historical or scholarly uncertainty when relevant. Never exceed the requested word limit.',input:[{role:'user',content:prompt}]})});
    }finally{clearTimeout(timer)}
    if(!r.ok){const raw=await r.text();let msg='Study AI unavailable';try{msg=JSON.parse(raw)?.error?.message||msg}catch{};console.error('Hobah explain upstream',r.status,msg);return send(r.status,{error:msg})}
    const j=await r.json();
    let answer=clean(j.output_text||'');
    if(!answer){
      const parts=[];
      for(const item of (Array.isArray(j.output)?j.output:[]))for(const c of (Array.isArray(item?.content)?item.content:[]))if(typeof c?.text==='string')parts.push(c.text);
      answer=clean(parts.join(' '));
    }
    answer=capWords(answer,300);
    if(!answer)return send(502,{error:'Study AI returned no explanation'});
    const words=answer.split(/\s+/).filter(Boolean).length;
    console.log('Hobah explain success',JSON.stringify({reference,words}));
    return send(200,{answer,reference,words});
  }catch(e){
    if(e?.name==='AbortError'){console.error('Hobah explain timeout');return send(504,{error:'Study AI took too long to respond'})}
    console.error('Hobah explain failed',e?.message||e);return send(500,{error:'Study AI could not explain that'});
  }
};
