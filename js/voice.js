/* 拱豬夜市 — 語音（瀏覽器內建 Web Speech API，台灣華語）
 * Allan：優先使用台灣男聲（Microsoft YunJhe / Zhiwei）
 * 阿拉蕾：優先使用台灣年輕女聲（Microsoft HsiaoYu / HsiaoChen / Yating / Hanhan、Google 國語（臺灣）、Mei-Jia）
 * 使用者可在「語音設定」改選，設定存在 localStorage。
 */
(function (root) {
  'use strict';
  const synth = root.speechSynthesis;
  const KEY = 'gz.voice.v1';

  const PREFER = {
    allan: [/YunJhe/i, /Zhiwei/i, /zh[-_]TW.*(male|男)/i, /Yun\w*.*Taiwan/i],
    arale: [/HsiaoYu/i, /HsiaoChen/i, /Yating/i, /Hanhan/i, /國語.*臺灣|國語.*台灣/, /Mei-?Jia/i, /zh[-_]TW/i],
    hacker: [/Zhiwei/i, /YunJhe/i, /Yunxi/i, /Yunyang/i],
    phishy: [/HsiaoChen/i, /Hanhan/i, /Mei-?Jia/i, /Xiaoxiao/i, /Yating/i],
  };
  // 找不到專屬聲線時，用音高/語速做出區別
  const DEFAULT_TUNE = {
    allan: { pitch: 0.95, rate: 1.0 },
    arale: { pitch: 1.3, rate: 1.08 },
    hacker: { pitch: 0.7, rate: 1.05 },
    phishy: { pitch: 1.15, rate: 0.95 },
  };

  let settings = { enabled: true, npc: true, volume: 1, voices: {}, tune: {} };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 無痕模式 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } };

  let voices = [];
  function loadVoices() {
    if (!synth) return [];
    voices = synth.getVoices().filter((v) => /^zh|cmn|yue/i.test(v.lang) || /Chinese|國語|中文/.test(v.name));
    return voices;
  }
  if (synth) {
    loadVoices();
    synth.onvoiceschanged = () => { loadVoices(); listeners.forEach((f) => f()); };
  }
  const listeners = [];

  function isTW(v) { return /TW|Hant|Taiwan|臺灣|台灣/i.test(v.lang + ' ' + v.name); }

  function pickVoice(who) {
    const chosen = settings.voices[who];
    if (chosen) {
      const v = voices.find((x) => x.name === chosen);
      if (v) return v;
    }
    for (const re of PREFER[who] || []) {
      const hits = voices.filter((v) => re.test(v.name) || re.test(v.lang));
      const v = hits.find(isTW) || hits[0];
      if (v) return v;
    }
    return voices.find(isTW) || voices[0] || null;
  }

  function tuneFor(who) {
    const base = DEFAULT_TUNE[who] || { pitch: 1, rate: 1 };
    const t = settings.tune[who] || {};
    const v = pickVoice(who);
    // 如果 Allan 只能借用女聲，就把音高壓低一點
    let pitch = t.pitch != null ? t.pitch : base.pitch;
    if (who === 'allan' && t.pitch == null && v && !/YunJhe|Zhiwei|Yun|male|男/i.test(v.name)) pitch = 0.6;
    return { pitch, rate: t.rate != null ? t.rate : base.rate };
  }

  // 依序播放，避免台詞互相打斷；排太多就丟掉最舊的
  const queue = [];
  let speaking = false;
  function pump() {
    if (speaking || !queue.length) return;
    const job = queue.shift();
    const u = new SpeechSynthesisUtterance(job.text);
    const v = pickVoice(job.who);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'zh-TW';
    const t = tuneFor(job.who);
    u.pitch = t.pitch; u.rate = t.rate; u.volume = settings.volume;
    speaking = true;
    const done = () => { speaking = false; job.resolve(); setTimeout(pump, 120); };
    u.onend = done; u.onerror = done;
    job.onstart && (u.onstart = job.onstart);
    synth.speak(u);
    // 有些瀏覽器不會觸發 onend，保險起見
    setTimeout(() => { if (speaking && !synth.speaking) done(); }, 400 + job.text.length * 260);
  }

  function clean(text) {
    return text.replace(/[♠♥♣♦]/g, (s) => ({ '♠': '黑桃', '♥': '紅心', '♣': '梅花', '♦': '方塊' }[s]))
      .replace(/～/g, '').replace(/\bKPI\b/g, 'K P I').replace(/\bPDCA\b/g, 'P D C A').replace(/\bMVP\b/g, 'M V P')
      .replace(/\bSIEM\b/g, 'S I E M').replace(/\bport\b/g, 'port').replace(/\+(\d+)/g, '加$1').replace(/-(\d+)/g, '負$1');
  }

  function speak(who, text, opts = {}) {
    if (!synth || (!settings.enabled && !opts.force)) return Promise.resolve();
    if ((who === 'hacker' || who === 'phishy') && !settings.npc && !opts.force) return Promise.resolve();
    if (opts.interrupt) { queue.length = 0; synth.cancel(); speaking = false; }
    while (queue.length > 3) queue.shift().resolve();
    return new Promise((resolve) => { queue.push({ who, text: clean(text), resolve, onstart: opts.onstart }); pump(); });
  }

  function stop() { queue.length = 0; if (synth) synth.cancel(); speaking = false; }

  const Voice = {
    supported: !!synth,
    get settings() { return settings; },
    set(patch) { Object.assign(settings, patch); save(); if (!settings.enabled) stop(); },
    setVoice(who, name) { settings.voices[who] = name || undefined; save(); },
    setTune(who, tune) { settings.tune[who] = Object.assign({}, settings.tune[who], tune); save(); },
    tuneFor, pickVoice,
    list() { return loadVoices(); },
    onChange(f) { listeners.push(f); },
    speak, stop,
    get busy() { return speaking || queue.length > 0; },
  };
  root.Voice = Voice;
})(window);
