// Natural narration is opt-in before any passage leaves the device. Device
// speech remains an explicit choice; a service error never changes the voice.
export const NATURAL_VOICE_CONSENT = 'hobah:naturalVoiceConsent:v1';
export const NARRATION_ENGINE = 'hobah:narrationEngine';

export function createNarration({ nativeAudio, deviceAudio, storage, requestConsent, isOnline, onChange = () => {} }) {
  const serial = { scripture: 0, study: 0 };
  const channelOf = options => options?.channel === 'study' ? 'study' : 'scripture';
  const read = key => { try { return storage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { storage.setItem(key, value); } catch {} };
  const engine = () => read(NARRATION_ENGINE) === 'device' ? 'device' : 'natural';
  const consent = channel => read(channel === 'study' ? 'hobah:thirdPartyAIConsent:v1' : NATURAL_VOICE_CONSENT) === 'granted';
  const selectedVoice = () => read('hobah:ttsVoice') === 'male' ? 'cedar' : 'marin';
  const cancelled = () => Object.assign(new Error('Narration cancelled'), { code: 'NARRATION_CANCELLED' });
  const pendingConsent = new Map();

  function item(options) {
    const voice = options.voice === 'cedar' || options.voice === 'marin' ? options.voice : selectedVoice();
    const text = String(options.text || '').trim(), mode = options.mode || 'normal';
    if (!text) throw new Error('Nothing to read');
    return { ...options, text, mode, voice, channel: channelOf(options), id: deviceAudio.keyFor(text, mode, voice) };
  }

  async function allow(channel) {
    if (consent(channel)) return true;
    // Only explicit play can show this. Prefetch never requests permission.
    if (!pendingConsent.has(channel)) pendingConsent.set(channel, Promise.resolve(requestConsent(channel)).finally(() => pendingConsent.delete(channel)));
    const allowed = await pendingConsent.get(channel);
    if (allowed) write(channel === 'study' ? 'hobah:thirdPartyAIConsent:v1' : NATURAL_VOICE_CONSENT, 'granted');
    return allowed;
  }

  const api = {
    keyFor: deviceAudio.keyFor,
    get onDevice() { return engine() === 'device'; },
    engine,
    async setEngine(value) {
      await api.stop({ channel: 'scripture' });
      await api.stop({ channel: 'study' });
      write(NARRATION_ENGINE, value === 'device' ? 'device' : 'natural');
      // Selecting device speech withdraws permission for passage prefetch too.
      if (value === 'device') {
        try { storage.removeItem(NATURAL_VOICE_CONSENT); } catch {}
        await nativeAudio.clearCache();
      }
      onChange(engine());
    },
    async prepare(options) {
      const audio = item(options);
      if (engine() === 'device' || !consent(audio.channel) || !isOnline()) return audio.id;
      await nativeAudio.prepare(audio);
      return audio.id;
    },
    async play(options) {
      const channel = channelOf(options), current = ++serial[channel];
      // Drop the previous chunk and invalidate its download before permission.
      // Resume during a new download must not replay an earlier passage.
      await nativeAudio.stop({ channel });
      if (current !== serial[channel]) throw cancelled();
      if (engine() === 'natural' && !await allow(channel)) {
        if (current !== serial[channel]) throw cancelled();
        throw new Error('Natural voices were not enabled. Choose Device voice to listen offline.');
      }
      if (current !== serial[channel]) throw cancelled();
      // Resolve the narrator after permission, so a selection made while the
      // dialog was open is honoured.
      const audio = item(options);
      if (engine() === 'device') return deviceAudio.play(audio);
      if (!isOnline()) throw new Error('Natural voices need internet. Connect or choose Device voice.');
      try {
        await nativeAudio.play(audio);
      } catch (error) {
        if (current !== serial[channel] || error?.code === 'NARRATION_CANCELLED') throw cancelled();
        throw new Error('Natural voices are temporarily unavailable. Try again or choose Device voice.');
      }
      if (current !== serial[channel]) throw cancelled();
      return audio.id;
    },
    async pause(options = {}) {
      ++serial[channelOf(options)];
      await nativeAudio.pause(options);
      if (engine() === 'device') await deviceAudio.pause(options);
    },
    async resume(options = {}) {
      return engine() === 'device' ? deviceAudio.resume(options) : nativeAudio.resume(options);
    },
    async stop(options = {}) {
      ++serial[channelOf(options)];
      await nativeAudio.stop(options);
      if (engine() === 'device') await deviceAudio.stop(options);
    },
    async setRate(rate, options = {}) {
      return engine() === 'device' ? deviceAudio.setRate(rate) : nativeAudio.setRate({ ...options, rate });
    },
    async getState(options = {}) {
      return engine() === 'device' ? deviceAudio.getState(options) : nativeAudio.getState(options);
    },
    clearCache: () => nativeAudio.clearCache()
  };
  return api;
}

export function requestNaturalVoiceConsent(channel) {
  if (channel === 'study') return window.HobahAIPrivacy?.requestConsent?.() || Promise.resolve(false);
  return new Promise(resolve => {
    const previous = document.activeElement;
    const wrap = document.createElement('div');
    wrap.id = 'hobahNaturalVoiceConsent';
    wrap.className = 'hobahAiConsentBackdrop';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'hobahNaturalVoiceTitle');
    wrap.innerHTML = `<section class="hobahAiConsentCard">
      <span class="eyebrow">NATURAL READ ALOUD</span>
      <h2 id="hobahNaturalVoiceTitle">Allow natural voices?</h2>
      <p>Hear Scripture and the Ancient Library in a natural male or female AI-generated voice.</p>
      <p>Hobah sends the passage you choose to hear, including any reading context, through its server to <strong>OpenAI</strong> to generate the audio. This needs an internet connection.</p>
      <p>You can choose Device voice in Settings to hear on-device speech instead. Reading, search and saved notes work without allowing this.</p>
      <p><a href="/privacy.html" target="_blank" rel="noopener">Read the Privacy Policy</a></p>
      <div class="hobahAiConsentActions"><button type="button" class="later" data-voice-later>Not now</button><button type="button" class="allow" data-voice-allow>Allow natural voices</button></div>
    </section>`;
    const finish = allowed => { wrap.remove(); previous?.focus?.(); resolve(allowed); };
    wrap.querySelector('[data-voice-later]').onclick = () => finish(false);
    wrap.querySelector('[data-voice-allow]').onclick = () => finish(true);
    wrap.onkeydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      if (event.key !== 'Tab') return;
      const focusable = [...wrap.querySelectorAll('a,button')];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.appendChild(wrap);
    wrap.querySelector('[data-voice-allow]').focus();
  });
}

export function installNarrationSettings(narration) {
  // Keep source selection in Settings, outside the compact reading player.
  document.getElementById('narrationEngine')?.remove();
  const install = () => {
    const group = document.querySelector('#settingsDialog .settingsGroup');
    if (!group || document.getElementById('settingsNarrationSource')) return;
    const row = document.createElement('label');
    row.className = 'settingsRow';
    row.innerHTML = '<span class="settingsText"><b>Read Aloud source</b></span><select id="settingsNarrationSource" aria-label="Read Aloud source"><option value="natural">Natural voices</option><option value="device">Device voice (offline)</option></select>';
    const select = row.querySelector('select');
    select.value = narration.engine();
    select.onchange = async () => {
      select.disabled = true;
      try { await narration.setEngine(select.value); }
      finally { select.value = narration.engine(); select.disabled = false; }
    };
    group.appendChild(row);
    document.addEventListener('hobah:narration-engine-changed', () => { select.value = narration.engine(); });
  };
  install();
  new MutationObserver(install).observe(document.body, { childList: true, subtree: true });
}
