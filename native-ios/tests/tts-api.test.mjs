import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
const handler = createRequire(import.meta.url)('../../api/tts.js');

async function invoke(upstream, voice) {
  const priorFetch = globalThis.fetch, priorKey = process.env.OPENAI_API_KEY;
  let request;
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
  globalThis.fetch = async (url, init) => { request = { url, ...JSON.parse(init.body) }; return upstream; };
  const response = Object.assign(new EventEmitter(), {
    headers: {}, chunks: [], writableEnded: false,
    setHeader(key, value) { this.headers[key] = value; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); },
    end(chunk) { if (chunk) this.write(chunk); this.writableEnded = true; }
  });
  try { await handler({ method: 'POST', body: { text: 'The Lord is my shepherd.', voice } }, response); }
  finally { globalThis.fetch = priorFetch; if (priorKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = priorKey; }
  return { response, request, body: Buffer.concat(response.chunks) };
}

test('both selected natural voices stream actual audio bytes', async () => {
  for (const voice of ['cedar', 'marin']) {
    const { response, request, body } = await invoke(new Response(new Uint8Array([73, 68, 51, 0, 1, 2]), { headers: { 'content-type': 'audio/mpeg' } }), voice);
    assert.equal(request.voice, voice);
    assert.equal(request.model, 'gpt-4o-mini-tts');
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'audio/mpeg');
    assert.deepEqual([...body], [73, 68, 51, 0, 1, 2]);
  }
});

test('exhausted credit produces a safe actionable error and is not cached', async () => {
  const failure = { error: { code: 'credit_balance_exhausted', type: 'insufficient_quota', message: 'Private account billing details' } };
  const { response, body } = await invoke(Response.json(failure, { status: 429 }), 'cedar');
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(JSON.parse(body).error.code, 'NARRATION_SERVICE_UNFUNDED');
  assert.equal(body.toString().includes('Private account'), false);
});
