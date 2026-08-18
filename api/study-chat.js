module.exports=async function handler(req,res){
  const json=(status,payload)=>{res.statusCode=status;res.setHeader('content-type','application/json');return res.end(JSON.stringify(payload))};
  const apiKey=process.env.OPENAI_API_KEY||process.env.OPENAI_KEY||process.env.OPENAI_SECRET_KEY||'';
  if(req.method==='GET'&&req.query&&req.query.health){
    return json(apiKey?200:503,{ready:!!apiKey,environment:process.env.VERCEL_ENV||'unknown',production:process.env.VERCEL_ENV==='production',keyName:process.env.OPENAI_API_KEY?'OPENAI_API_KEY':process.env.OPENAI_KEY?'OPENAI_KEY':process.env.OPENAI_SECRET_KEY?'OPENAI_SECRET_KEY':null,hint:apiKey?null:'Add OPENAI_API_KEY to this Vercel project and enable it for Production, then redeploy.'});
  }
  if(req.method!=='POST')return json(405,{error:'Method not allowed'});
  if(!apiKey)return json(503,{error:'Study AI is not configured for this production deployment. In Vercel, add OPENAI_API_KEY under Settings → Environment Variables, enable Production, then redeploy.'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),question=String(body.question||'').trim().slice(0,3000),mode=['study','context','theory'].includes(body.mode)?body.mode:'study';
    if(!question)return json(400,{error:'Missing question'});
    const c=body.context||{},notes=Array.isArray(c.studyNotes)?c.studyNotes.slice(0,6):[],history=Array.isArray(body.history)?body.history.slice(-4):[];
    const source=`CURRENT REFERENCE: ${String(c.currentReference||'Study Library')}\n\nSCRIPTURE ON SCREEN:\n${String(c.scripture||'').slice(0,9000)}\n\nBOOK BACKGROUND:\n${String(c.bookBackground||'').slice(0,2800)}\n\nSECTION CONTEXT:\n${String(c.sectionContext||'').slice(0,2000)}\n\nRELEVANT EDITORIAL STUDY NOTES:\n${notes.map(n=>`[${n.reference} — ${n.type}] ${n.text}`).join('\n\n').slice(0,8000)}`;
    const modeInstruction=mode==='context'
      ?'MODE: HISTORICAL CONTEXT. Prioritize traditional authorship claims, modern scholarly dating and composition views, historical setting, archaeology where relevant, manuscript transmission, canon history, and what evidence supports or weakens each view. Distinguish tradition from historical probability and scholarly consensus from live debate.'
      :mode==='theory'
      ?'MODE: DEBATE & THEORIES. Treat popular biblical conspiracy claims as hypotheses to test, not facts to repeat. State the claim fairly, give the strongest supporting and counter-evidence, identify what is established versus inferred, then give a measured verdict. Do not sensationalize or drift into unrelated modern conspiracies.'
      :'MODE: STUDY. Explain the text clearly using literary context, theology, cross-references, textual history, and major interpretive views where useful.';
    const input=[...history.map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.text||'').slice(0,1800)})),{role:'user',content:`${source}\n\n${modeInstruction}\n\nQUESTION:\n${question}`}];
    const controller=new AbortController();
    res.on('close',()=>{if(!res.writableEnded)controller.abort()});
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5-mini',store:false,stream:true,reasoning:{effort:'minimal'},text:{verbosity:'low'},max_output_tokens:900,instructions:'You are Study AI inside a research-oriented Ethiopian Bible reading edition. Answer the question directly in the first sentence, then support it in no more than four short paragraphs unless a comparison truly needs a compact list. Be rigorous, clear, and concise. Treat the supplied Scripture text, book background, section context, and editorial notes as the primary source material for this edition. Never invent wording that is not supplied. Distinguish this edition’s notes from broader historical, textual-critical, Jewish, Christian, Ethiopian, or scholarly context. When scholarship is disputed, name the main views and uncertainty. Do not force a doctrinal conclusion when traditions differ.',input})});
    if(!r.ok){
      const raw=await r.text();let message='OpenAI request failed';
      try{message=JSON.parse(raw)?.error?.message||message}catch{if(raw)message=raw.slice(0,500)}
      return json(r.status,{error:message});
    }
    res.statusCode=200;
    res.setHeader('content-type','text/event-stream; charset=utf-8');
    res.setHeader('cache-control','no-cache, no-transform');
    res.setHeader('x-accel-buffering','no');
    res.flushHeaders?.();
    for await(const chunk of r.body){if(res.destroyed)break;res.write(Buffer.from(chunk))}
    if(!res.writableEnded)res.end();
  }catch(e){
    if(e&&e.name==='AbortError')return;
    if(res.headersSent){if(!res.writableEnded)res.end();return}
    return json(500,{error:'Study AI failed'});
  }
}
