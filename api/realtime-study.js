module.exports=async function handler(req,res){
  res.setHeader('access-control-allow-origin','*');
  res.setHeader('access-control-allow-methods','GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers','content-type');
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
  const apiKey=process.env.OPENAI_API_KEY||process.env.OPENAI_KEY||process.env.OPENAI_SECRET_KEY||'';
  if(req.method==='GET'&&req.query&&req.query.health){res.statusCode=apiKey?200:503;res.setHeader('content-type','application/json');return res.end(JSON.stringify({ready:!!apiKey,model:'gpt-realtime-2.1-mini'}))}
  if(req.method!=='POST'){res.statusCode=405;return res.end('Method not allowed')}
  if(!apiKey){res.statusCode=503;return res.end('Realtime Study AI is not configured')}
  try{
    let sdp='';
    if(typeof req.body==='string')sdp=req.body;
    else if(Buffer.isBuffer(req.body))sdp=req.body.toString('utf8');
    else if(req.body&&typeof req.body==='object'&&typeof req.body.sdp==='string')sdp=req.body.sdp;
    if(!sdp){for await(const chunk of req)sdp+=Buffer.from(chunk).toString('utf8')}
    if(!sdp.trim()){res.statusCode=400;return res.end('Missing SDP')}
    const fd=new FormData();
    fd.set('sdp',sdp);
    fd.set('session',JSON.stringify({
      type:'realtime',model:'gpt-realtime-2.1-mini',output_modalities:['audio'],max_output_tokens:'inf',
      audio:{output:{voice:'marin',speed:1}},
      instructions:'You are Study AI inside Hobah, an Ethiopian Bible reading edition. Answer immediately and conversationally. Begin with the direct answer in the first sentence, then fully explain the passage and its immediate context before stopping. Do not truncate an explanation merely to be brief. Use enough detail to make the meaning clear, usually about 220 to 300 spoken words for an explain-that request, but avoid filler. End at a natural complete thought. Speak in a calm, steady voice at an even perceived volume with consistent pacing. Be rigorous about Scripture and distinguish interpretation from established historical or textual facts.'
    }));
    const controller=new AbortController();
    res.on('close',()=>{if(!res.writableEnded)controller.abort()});
    const r=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',signal:controller.signal,headers:{authorization:`Bearer ${apiKey}`},body:fd});
    const text=await r.text();
    res.statusCode=r.status;
    res.setHeader('content-type','application/sdp');
    res.setHeader('cache-control','no-store');
    return res.end(text);
  }catch(e){if(e&&e.name==='AbortError')return;res.statusCode=500;return res.end('Realtime Study AI failed')}
}
