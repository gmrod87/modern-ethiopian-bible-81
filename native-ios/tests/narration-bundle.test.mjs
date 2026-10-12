import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the actual assembled reader closure up to bootstrap with minimal DOM
// adapters. This catches postbuild integration and lexical-scope errors that
// isolated bridge tests cannot detect. No network or audio service is mocked as
// having produced real narration.
function reader() {
  const listeners = new Map(), nodes = new Map();
  const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} }, dataset: {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, appendChild() {}, pause() {}, load() {}, querySelector() { return element(); }, querySelectorAll() { return []; }, textContent: '', innerHTML: '' });
  const document = {
    querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); },
    querySelectorAll: () => [],
    addEventListener(name, fn) { listeners.set(name, [...(listeners.get(name) || []), fn]); },
    removeEventListener() {},
    dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); },
    createElement: element, body: element(), documentElement: element()
  };
  const context = { console, document, navigator: {}, localStorage: { getItem: () => null, setItem() {} }, location: { hash: '' }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, addEventListener() {}, requestAnimationFrame: () => 0, performance: { now: () => 0 }, URL, AbortController, CustomEvent };
  context.window = context;
  context.HobahNativeAudio = { onDevice: false, stop: async () => {}, pause: async () => {}, prepare: async () => {}, play: async () => {} };
  context.HobahNativeAudioReady = Promise.resolve();
  const source = readFileSync(new URL('../www/app.js', import.meta.url), 'utf8');
  const bootstrap = source.indexOf('bindAudio();\n');
  assert.ok(bootstrap > 0, 'Reader audio bootstrap is present');
  vm.runInNewContext(source.slice(0, bootstrap) + 'globalThis.readerTest={state,playNarrationItem,stopNarration,toggleNarration};})();', context);
  return { context, document, nodes, ...context.readerTest };
}

test('assembled source selector updates the real reader state without escaping its scope', () => {
  const r = reader();
  r.state.audio.items = [{ text: 'A passage' }];
  r.state.audio.playing = true;
  r.document.dispatchEvent({ type: 'hobah:narration-engine-changed' });
  assert.equal(r.state.audio.playing, false);
  assert.equal(r.state.audio.paused, true);
  assert.equal(r.nodes.get('#audioState').textContent, 'Natural voices selected');
  r.context.HobahNativeAudio.onDevice = true;
  r.document.dispatchEvent({ type: 'hobah:narration-engine-changed' });
  assert.equal(r.nodes.get('#audioState').textContent, 'Device voice selected');
});

test('assembled reader ignores playback completion after Stop', async () => {
  const r = reader();
  let finish;
  r.context.HobahNativeAudio.play = () => new Promise(resolve => { finish = resolve; });
  r.state.audio.items = [{ text: 'A passage', startVerse: 1, endVerse: 1 }];
  r.state.audio.stopped = false;
  const pending = r.playNarrationItem();
  await new Promise(resolve => setImmediate(resolve));
  r.stopNarration();
  finish();
  await pending;
  assert.equal(r.state.audio.stopped, true);
  assert.equal(r.state.audio.playing, false);
  assert.equal(r.state.audio.preparing, false);
});

test('tapping Play during preparation pauses the pending narration', () => {
  const r = reader();
  r.state.audio.preparing = true;
  r.state.audio.stopped = false;
  r.toggleNarration();
  assert.equal(r.state.audio.preparing, false);
  assert.equal(r.state.audio.paused, true);
});
