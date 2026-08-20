module.exports=async function handler(req,res){
  res.setHeader('access-control-allow-origin','*');
  res.setHeader('access-control-allow-methods','GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers','content-type');
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
  if(req.method==='GET'){
    if(req.query&&req.query.health){
      res.statusCode=process.env.OPENAI_API_KEY?200:503;
      res.setHeader('content-type','application/json');
      return res.end(JSON.stringify({ready:!!process.env.OPENAI_API_KEY}));
    }
    res.statusCode=405;return res.end('Method not allowed');
  }
  if(req.method!=='POST'){res.statusCode=405;return res.end('Method not allowed')}
  if(!process.env.OPENAI_API_KEY){res.statusCode=503;return res.end('Natural voice is not configured')}
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const text=String(body.text||'').trim().slice(0,1800);
    if(!text){res.statusCode=400;return res.end('Missing text')}
    const voice=['marin','cedar'].includes(body.voice)?body.voice:'marin',mode=['normal','context','advanced'].includes(body.mode)?body.mode:'normal';
    const extra=mode==='context'?' When the text shifts from a chapter title or short historical note into Scripture, give a small natural pause so the listener can feel the change, but keep the whole reading flowing as one audiobook experience.':mode==='advanced'?' Treat short scholarly or theological context as a calm narrator aside, with a brief pause before returning to Scripture. Keep the context concise in tone and do not make it sound like a lecture.':'';
    const controller=new AbortController();
    res.on('close',()=>{if(!res.writableEnded)controller.abort()});
    const r=await fetch('https://api.openai.com/v1/audio/speech',{
      method:'POST',signal:controller.signal,
      headers:{'authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},
      body:JSON.stringify({model:'gpt-4o-mini-tts',voice,input:text,response_format:'mp3',instructions:'Read in a calm, warm, intelligent natural voice. Scripture should sound reverent but not theatrical. Use restrained emotion, clear diction, gentle pacing, and meaningful pauses at sentence boundaries. Do not announce verse numbers or verse labels unless a number is genuinely part of the Scripture sentence itself. Never sound synthetic.'+extra})
    });
    if(!r.ok){res.statusCode=r.status;return res.end(await r.text())}
    res.statusCode=200;
    res.setHeader('content-type','audio/mpeg');
    res.setHeader('cache-control','private, max-age=86400');
    res.setHeader('x-accel-buffering','no');
    res.flushHeaders?.();
    for await(const chunk of r.body){if(res.destroyed)break;res.write(Buffer.from(chunk))}
    if(!res.writableEnded)res.end();
  }catch(e){if(e&&e.name==='AbortError')return;if(!res.headersSent){res.statusCode=500;return res.end('Narration failed')}if(!res.writableEnded)res.end()}
}
