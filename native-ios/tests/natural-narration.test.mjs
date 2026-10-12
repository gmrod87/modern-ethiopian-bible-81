import test from 'node:test';
import assert from 'node:assert/strict';
import { createNarration, NATURAL_VOICE_CONSENT, NARRATION_ENGINE } from '../src/natural-narration.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture(values = {}, options = {}) {
  const data = new Map(Object.entries(values)), calls = [], deviceCalls = [], prompts = [];
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const nativeAudio = Object.fromEntries(['play', 'prepare', 'pause', 'resume', 'stop', 'setRate', 'getState', 'clearCache'].map(name => [name, async value => { calls.push([name, value]); return options[name]?.(value); }]));
  const deviceAudio = Object.fromEntries(['play', 'prepare', 'pause', 'resume', 'stop', 'setRate', 'getState'].map(name => [name, async value => { deviceCalls.push([name, value]); return 'device-id'; }]));
  deviceAudio.keyFor = (text, mode, voice) => `${voice}|${mode}|${text}`;
  const narration = createNarration({ nativeAudio, deviceAudio, storage, isOnline: () => options.online !== false, requestConsent: async channel => { prompts.push(channel); return options.consent ?? false; } });
  return { narration, data, calls, deviceCalls, prompts };
}

test('male and female selections reach the original natural voices with distinct cache IDs', async () => {
  const f = fixture({ [NATURAL_VOICE_CONSENT]: 'granted', 'hobah:ttsVoice': 'male' });
  const male = await f.narration.play({ text: 'Psalm 23', rate: 1.15 });
  f.data.set('hobah:ttsVoice', 'female');
  const female = await f.narration.play({ text: 'Psalm 23', rate: 1.15 });
  const played = f.calls.filter(([name]) => name === 'play').map(([, value]) => value);
  assert.deepEqual(played.map(item => item.voice), ['cedar', 'marin']);
  assert.equal(played[0].rate, 1.15);
  assert.notEqual(male, female);
  assert.equal(f.deviceCalls.length, 0);
});

test('prefetch neither sends a passage nor prompts before natural voice consent', async () => {
  const f = fixture({ 'hobah:thirdPartyAIConsent:v1': 'granted' });
  await f.narration.prepare({ text: 'A passage' });
  assert.equal(f.calls.length, 0);
  assert.equal(f.prompts.length, 0);
  await assert.rejects(f.narration.play({ text: 'A passage' }), /not enabled/);
  assert.equal(f.calls.some(([name]) => name === 'play' || name === 'prepare'), false);
});

test('explicit consent enables playback and subsequent prefetch', async () => {
  const f = fixture({}, { consent: true });
  await f.narration.play({ text: 'One' });
  await f.narration.prepare({ text: 'Two' });
  assert.deepEqual(f.prompts, ['scripture']);
  assert.equal(f.data.get(NATURAL_VOICE_CONSENT), 'granted');
  assert.equal(f.calls.filter(([name]) => name === 'prepare').length, 1);
});

test('service failures never silently fall back to device speech', async () => {
  const f = fixture({ [NATURAL_VOICE_CONSENT]: 'granted' }, { play() { throw new Error('credit_balance_exhausted'); } });
  await assert.rejects(f.narration.play({ text: 'A passage' }), /temporarily unavailable/);
  assert.equal(f.deviceCalls.length, 0);
  assert.equal(f.narration.engine(), 'natural');
});

test('offline natural mode fails clearly; explicit device mode reads offline without transmitting text', async () => {
  const f = fixture({ [NATURAL_VOICE_CONSENT]: 'granted' }, { online: false });
  await assert.rejects(f.narration.play({ text: 'A passage' }), /need internet/);
  await f.narration.setEngine('device');
  await f.narration.play({ text: 'A passage' });
  assert.equal(f.narration.onDevice, true);
  assert.equal(f.data.get(NARRATION_ENGINE), 'device');
  assert.equal(f.data.has(NATURAL_VOICE_CONSENT), false);
  assert.equal(f.calls.some(([name]) => name === 'play' || name === 'prepare'), false);
  assert.equal(f.deviceCalls.filter(([name]) => name === 'play').length, 1);
});

test('stop while consent is open cannot start narration when permission resolves', async () => {
  const permission = deferred(), f = fixture({}, { consent: permission.promise });
  const play = f.narration.play({ text: 'A passage' });
  await Promise.resolve();
  await f.narration.stop();
  permission.resolve(true);
  await assert.rejects(play, { code: 'NARRATION_CANCELLED' });
  assert.equal(f.calls.some(([name]) => name === 'play'), false);
});

test('late download completion cannot mark a superseded play successful', async () => {
  const download = deferred(), f = fixture({ [NATURAL_VOICE_CONSENT]: 'granted' }, { play: () => download.promise });
  const play = f.narration.play({ text: 'A passage' });
  await new Promise(resolve => setImmediate(resolve));
  await f.narration.stop();
  download.resolve();
  await assert.rejects(play, { code: 'NARRATION_CANCELLED' });
});

test('Study and Scripture consent and playback controls remain separate', async () => {
  const f = fixture({ 'hobah:thirdPartyAIConsent:v1': 'granted' });
  await f.narration.play({ text: 'Study explanation', channel: 'study' });
  await f.narration.pause({ channel: 'study' });
  await f.narration.resume({ channel: 'study' });
  await f.narration.setRate(1.3, { channel: 'study' });
  await f.narration.prepare({ text: 'Scripture' });
  assert.equal(f.calls.find(([name]) => name === 'play')[1].channel, 'study');
  assert.deepEqual(f.calls.find(([name]) => name === 'setRate')[1], { channel: 'study', rate: 1.3 });
  assert.equal(f.calls.some(([name]) => name === 'prepare'), false);
  assert.equal(f.prompts.length, 0);
});
