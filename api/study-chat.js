module.exports=async function handler(req,res){
  res.setHeader('content-type','application/json');
  const apiKey=process.env.OPENAI_API_KEY||process.env.OPENAI_KEY||process.env.OPENAI_SECRET_KEY||'';
  if(req.method==='GET'&&req.query&&req.query.health){
    res.statusCode=apiKey?200:503;
    return res.end(JSON.stringify({
      ready:!!apiKey,
      environment:process.env.VERCEL_ENV||'unknown',
      production:process.env.VERCEL_ENV==='production',
      keyName:process.env.OPENAI_API_KEY?'OPENAI_API_KEY':process.env.OPENAI_KEY?'OPENAI_KEY':process.env.OPENAI_SECRET_KEY?'OPENAI_SECRET_KEY':null,
      hint:apiKey?null:'Add OPENAI_API_KEY to this Vercel project and enable it for Production, then redeploy.'
    }));
  }
  if(req.method!=='POST'){res.statusCode=405;return res.end(JSON.stringify({error:'Method not allowed'}))}
  if(!apiKey){res.statusCode=503;return res.end(JSON.stringify({error:'Study AI is not configured for this production deployment. In Vercel, add OPENAI_API_KEY under Settings → Environment Variables, enable Production, then redeploy.'}))}
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),question=String(body.question||'').trim().slice(0,3000);
    if(!question){res.statusCode=400;return res.end(JSON.stringify({error:'Missing question'}))}
    const c=body.context||{},notes=Array.isArray(c.studyNotes)?c.studyNotes.slice(0,8):[],history=Array.isArray(body.history)?body.history.slice(-6):[];
    const source=`CURRENT REFERENCE: ${String(c.currentReference||'Study Library')}\n\nSCRIPTURE ON SCREEN:\n${String(c.scripture||'').slice(0,12000)}\n\nBOOK BACKGROUND:\n${String(c.bookBackground||'').slice(0,3500)}\n\nSECTION CONTEXT:\n${String(c.sectionContext||'').slice(0,2500)}\n\nRELEVANT EDITORIAL STUDY NOTES:\n${notes.map(n=>`[${n.reference} — ${n.type}] ${n.text}`).join('\n\n').slice(0,12000)}`;
    const input=[...history.map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.text||'').slice(0,2500)})),{role:'user',content:`${source}\n\nQUESTION:\n${question}`}];
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5-mini',store:false,max_output_tokens:1400,instructions:'You are Study AI inside a research-oriented Ethiopian Bible reading edition. Give rigorous, clear, intellectually serious answers. Treat the supplied Scripture text, book background, section context, and editorial study notes as the primary source material for questions about this edition. Never invent wording that is not supplied. Clearly distinguish what THIS EDITION’S STUDY NOTES say from broader historical, linguistic, textual-critical, Jewish, Christian, Ethiopian, or scholarly context you add from general knowledge. When scholarship is disputed, name the main views and indicate uncertainty rather than pretending consensus. Do not force a doctrinal conclusion when traditions differ. Prefer compact paragraphs over lists unless comparison genuinely benefits from structure. If the supplied material is insufficient for a source-specific claim, say so.',input})});
    const data=await r.json();if(!r.ok){res.statusCode=r.status;return res.end(JSON.stringify({error:data?.error?.message||'OpenAI request failed'}))}
    let answer='';for(const item of data.output||[])for(const part of item.content||[])if(part.type==='output_text'&&part.text)answer+=part.text;
    if(!answer)answer=data.output_text||'';res.statusCode=200;return res.end(JSON.stringify({answer:answer.trim()||'No answer returned.'}))
  }catch(e){res.statusCode=500;return res.end(JSON.stringify({error:'Study AI failed'}))}
}
