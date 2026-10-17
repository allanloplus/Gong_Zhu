/* 拱豬夜市 — 遊戲流程、畫面、對話串場 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const { PIG, SHEEP, TRANSFORMER, HEART_ACE, SUIT_SYMBOL, SUIT_NAME, suitOf, rankOf } = GZ;

  const SEATS = ['allan', 'hacker', 'arale', 'phishy'];
  const NAMES = SEATS.map((k) => CAST[k].name);
  const COLORS = SEATS.map((k) => CAST[k].color);
  const AVATAR = {
    allan: 'assets/img/allan-smile.webp',
    hacker: 'assets/img/hacker.svg',
    arale: 'assets/img/arale-wink.webp',
    phishy: 'assets/img/phishy.svg',
  };
  const DEFAULT_MOOD = { allan: 'smile', arale: 'wink' };
  const SPEED = { slow: 1.6, mid: 1, fast: 0.5 };
  const SPECIAL_NAME = { [PIG]: '豬', [SHEEP]: '羊', [TRANSFORMER]: '變壓器', [HEART_ACE]: '紅心 A' };

  // ---------- 偏好設定 ----------
  const PREF_KEY = 'gz.prefs.v1';
  const prefs = { speed: 'mid', mode: 'limit', sfx: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { /* ignore */ }
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

  // ---------- 音效（WebAudio 合成，不需要音檔） ----------
  const Sfx = (() => {
    let ac = null;
    const ctx = () => {
      if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
      return ac;
    };
    function tone(freq, dur, type, vol, when, slideTo) {
      const a = prefs.sfx && ctx();
      if (!a) return;
      const t0 = a.currentTime + (when || 0);
      const o = a.createOscillator(), g = a.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(a.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    return {
      unlock() { const a = ctx(); if (a && a.state === 'suspended') a.resume(); },
      card() { tone(700 + Math.random() * 250, 0.07, 'triangle', 0.08); },
      collect() { tone(300, 0.25, 'sine', 0.08, 0, 900); },
      siren() { for (let i = 0; i < 3; i++) { tone(620, 0.2, 'square', 0.05, i * 0.4, 980); tone(980, 0.2, 'square', 0.05, i * 0.4 + 0.2, 620); } },
      chime() { [660, 880, 1320].forEach((f, i) => tone(f, 0.3, 'sine', 0.1, i * 0.09)); },
      bell() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.08, i * 0.12)); },
    };
  })();

  // ---------- 流程控制 ----------
  const ABORT = Symbol('abort');
  let run = { alive: false };
  let G = null;
  let pickResolver = null;
  let idleTimer = null;

  const rawSleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function wait(ms, r = run) {
    await rawSleep(ms * SPEED[prefs.speed]);
    if (!r.alive) throw ABORT;
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- 牌面 ----------
  const ART = {
    [PIG]: '<svg viewBox="0 0 60 60" aria-hidden="true"><path d="M13 14l8 9-11 3z M47 14l-8 9 11 3z" fill="#f7a8c0" stroke="#1d1a2f" stroke-width="3" stroke-linejoin="round"/><circle cx="30" cy="33" r="20" fill="#f7a8c0" stroke="#1d1a2f" stroke-width="3"/><ellipse cx="30" cy="39" rx="9" ry="6.5" fill="#e86a8f" stroke="#1d1a2f" stroke-width="3"/><circle cx="26.8" cy="39" r="1.8" fill="#1d1a2f"/><circle cx="33.2" cy="39" r="1.8" fill="#1d1a2f"/><circle cx="23" cy="28" r="2.6" fill="#1d1a2f"/><circle cx="37" cy="28" r="2.6" fill="#1d1a2f"/><rect x="40" y="44" width="14" height="11" rx="2" fill="#f6b93b" stroke="#1d1a2f" stroke-width="2.5"/><path d="M43 44v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#1d1a2f" stroke-width="2.5"/></svg>',
    [SHEEP]: '<svg viewBox="0 0 60 60" aria-hidden="true"><g fill="#fff" stroke="#1d1a2f" stroke-width="3"><circle cx="20" cy="24" r="9"/><circle cx="32" cy="19" r="10"/><circle cx="43" cy="26" r="9"/><circle cx="16" cy="36" r="9"/><circle cx="44" cy="38" r="9"/><circle cx="30" cy="42" r="10"/></g><ellipse cx="30" cy="32" rx="9" ry="11" fill="#3b3550" stroke="#1d1a2f" stroke-width="3"/><circle cx="26.5" cy="30" r="2" fill="#fff"/><circle cx="33.5" cy="30" r="2" fill="#fff"/><path d="M27 37q3 2 6 0" stroke="#fff" stroke-width="2" fill="none"/></svg>',
    [TRANSFORMER]: '<svg viewBox="0 0 60 60" aria-hidden="true"><rect x="12" y="14" width="36" height="34" rx="5" fill="#8f83f0" stroke="#1d1a2f" stroke-width="3"/><path d="M18 14v-6M30 14v-6M42 14v-6" stroke="#1d1a2f" stroke-width="3"/><path d="M33 19l-10 13h8l-4 11 11-15h-8z" fill="#f6b93b" stroke="#1d1a2f" stroke-width="2.5" stroke-linejoin="round"/></svg>',
  };
  const TAG = { [PIG]: '勒索豬', [SHEEP]: '羊', [TRANSFORMER]: '變壓器' };
  const rankText = (r) => GZ.RANK_LABEL[r] || String(r);

  function cardEl(id, opts = {}) {
    const s = suitOf(id), r = rankOf(id);
    const el = document.createElement(opts.button ? 'button' : 'div');
    if (opts.button) el.type = 'button';
    el.className = 'card ' + (s === 'H' || s === 'D' ? 'red' : 'black');
    if (id === PIG) el.classList.add('pig');
    if (id === SHEEP) el.classList.add('sheep');
    if (id === TRANSFORMER) el.classList.add('ten');
    el.dataset.id = id;
    const sym = SUIT_SYMBOL[s];
    const center = ART[id] ? `<span class="art">${ART[id]}</span><span class="tag">${TAG[id]}</span>` : `<span class="pip">${sym}</span>`;
    el.innerHTML = `<span class="corner tl"><b>${rankText(r)}</b><i>${sym}</i></span>${center}<span class="corner br"><b>${rankText(r)}</b><i>${sym}</i></span>`;
    if (opts.exposed) el.insertAdjacentHTML('beforeend', '<span class="exp">亮</span>');
    el.setAttribute('aria-label', `${SUIT_NAME[s]} ${rankText(r)}${SPECIAL_NAME[id] ? '（' + SPECIAL_NAME[id] + '）' : ''}${opts.exposed ? '，已亮牌' : ''}`);
    return el;
  }

  // ---------- 攤位與看板 ----------
  function buildStalls() {
    const box = $('#stalls');
    box.innerHTML = '';
    for (const p of [1, 2, 3]) {
      const k = SEATS[p];
      const el = document.createElement('div');
      el.className = 'stall';
      el.dataset.seat = p;
      el.style.setProperty('--sign', COLORS[p]);
      el.innerHTML = `
        <div class="awning"></div>
        <div class="stall-body">
          <div class="avatar"><img id="face-${p}" src="${AVATAR[k]}" alt="${NAMES[p]}"><div class="bubble" id="bubble-${p}" hidden></div></div>
          <div class="stall-meta">
            <div class="sign">${NAMES[p]}</div>
            <div class="sign-sub">${CAST[k].title}</div>
            <div class="backs" id="backs-${p}"></div>
            <div class="captured" id="cap-${p}"></div>
          </div>
        </div>`;
      box.appendChild(el);
    }
  }

  function capturedHTML(p) {
    const st = G.state;
    const taken = st.taken[p];
    const exposedBy = st.exposed.filter((id) => ownerOf(id) === p);
    let html = exposedBy.map((id) => `<span class="chip ${chipClass(id)} ex" title="已亮牌">${chipText(id)}</span>`).join('');
    if (taken.includes(PIG)) html += '<span class="chip pig" title="收到豬">豬</span>';
    if (taken.includes(SHEEP)) html += '<span class="chip sheep" title="收到羊">羊</span>';
    if (taken.includes(TRANSFORMER)) html += '<span class="chip ten" title="收到變壓器">變</span>';
    const h = taken.filter((c) => suitOf(c) === 'H').length;
    if (h) html += `<span class="chip heart" title="收到 ${h} 張紅心">♥${h}</span>`;
    if (taken.some(GZ.isScoring)) {
      const sc = GZ.scoreTaken(taken, st.exposed).total;
      html += `<span class="pts">${fmt(sc)}</span>`;
    }
    return html;
  }
  const chipClass = (id) => ({ [PIG]: 'pig', [SHEEP]: 'sheep', [TRANSFORMER]: 'ten', [HEART_ACE]: 'heart' }[id]);
  const chipText = (id) => ({ [PIG]: '亮豬', [SHEEP]: '亮羊', [TRANSFORMER]: '亮變', [HEART_ACE]: '亮♥A' }[id]);
  const fmt = (n) => (n > 0 ? '+' + n : String(n));

  function ownerOf(id) {
    const st = G.state;
    if (st.ownerAtDeal && st.ownerAtDeal[id] != null) return st.ownerAtDeal[id];
    return st.hands.findIndex((h) => h.includes(id));
  }

  function updateSeat(p) {
    if (p === 0) {
      $('#cap-0').innerHTML = capturedHTML(0);
      return;
    }
    const n = G.state.hands[p].length;
    $(`#backs-${p}`).innerHTML = '<i></i>'.repeat(n) + `<b>${n}</b>`;
    $(`#cap-${p}`).innerHTML = capturedHTML(p);
  }

  function updateBoard(flipAll) {
    const st = G.state;
    const rows = $('#scoreRows');
    const live = st ? st.taken.map((t) => GZ.scoreTaken(t, st.exposed).total) : [0, 0, 0, 0];
    if (!rows.children.length) {
      rows.innerHTML = SEATS.map((k, p) => `
        <div class="fb-row" id="fb-${p}">
          <span class="who"><i style="background:${COLORS[p]}"></i><span>${NAMES[p]}</span></span>
          <span class="flap" id="fbh-${p}">0</span>
          <span class="flap" id="fbt-${p}">0</span>
        </div>`).join('');
    }
    for (let p = 0; p < 4; p++) {
      setFlap($(`#fbh-${p}`), fmt(live[p]), live[p] < 0, flipAll);
      setFlap($(`#fbt-${p}`), String(G.totals[p]), G.totals[p] < 0, flipAll);
    }
  }
  function setFlap(el, text, neg, force) {
    if (el.textContent !== text || force) {
      el.textContent = text;
      el.classList.toggle('neg', neg);
      el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
    }
  }

  function markTurn(p) {
    document.querySelectorAll('.stall').forEach((s) => s.classList.toggle('turn', +s.dataset.seat === p));
    $('#me').classList.toggle('turn', p === 0);
    document.querySelectorAll('.fb-row').forEach((r, i) => r.classList.toggle('turn', i === p));
  }

  function updateHub() {
    const st = G.state;
    $('#trickNo').textContent = Math.min(st.trickNo + (st.trick.length ? 1 : 0), 13);
    $('#handNo').textContent = G.handNo;
    if (st.phase === 'expose') { $('#hubTop').textContent = '亮牌'; $('#hubSub').textContent = '宣告中'; return; }
    $('#hubTop').textContent = `第 ${Math.min(st.trickNo + 1, 13)} 墩`;
    $('#hubSub').textContent = st.trick.length
      ? `引 ${SUIT_SYMBOL[suitOf(st.trick[0].id)]} ${SUIT_NAME[suitOf(st.trick[0].id)]}`
      : `${NAMES[st.turn]} 先出`;
  }

  function setStatus(text, mine) {
    const el = $('#status');
    el.textContent = text;
    el.classList.toggle('mine', !!mine);
  }

  // ---------- 手牌 ----------
  function renderHand(active) {
    const st = G.state;
    const hand = $('#hand');
    const legal = active ? GZ.legalPlays(st, 0) : [];
    hand.classList.toggle('active', !!active);
    hand.innerHTML = '';
    for (const id of st.hands[0]) {
      const el = cardEl(id, { button: true, exposed: st.exposed.includes(id) });
      const ok = legal.includes(id);
      if (ok) el.classList.add('legal');
      el.disabled = !!active && !ok;
      if (!active) el.tabIndex = -1;
      hand.appendChild(el);
    }
  }

  $('#hand').addEventListener('click', (e) => {
    const el = e.target.closest('.card');
    if (!el || !pickResolver || !el.classList.contains('legal')) return;
    const r = pickResolver;
    pickResolver = null;
    el.classList.add('gone');
    r(el.dataset.id);
  });

  // ---------- 桌面 ----------
  function placeCard(p, id) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.seat = p;
    slot.appendChild(cardEl(id, { exposed: G.state.exposed.includes(id) }));
    $('#susan').appendChild(slot);
  }
  function clearTable() { document.querySelectorAll('#susan .slot').forEach((s) => s.remove()); }

  async function collect(winner) {
    const susan = $('#susan');
    const target = winner === 0 ? $('#allanPortrait') : document.querySelector(`.stall[data-seat="${winner}"] .avatar`);
    susan.classList.add('spin');
    await wait(900);
    susan.classList.remove('spin');
    const tr = target.getBoundingClientRect();
    const dur = 560 * SPEED[prefs.speed];
    Sfx.collect();
    document.querySelectorAll('#susan .slot').forEach((s) => {
      const c = s.firstElementChild;
      const r = c.getBoundingClientRect();
      const fly = c.cloneNode(true);
      fly.classList.add('flyer');
      fly.classList.remove('win');
      Object.assign(fly.style, { left: r.left + 'px', top: r.top + 'px', rotate: '0deg', animation: 'none' });
      document.body.appendChild(fly);
      const dx = tr.left + tr.width / 2 - r.left - r.width / 2;
      const dy = tr.top + tr.height / 2 - r.top - r.height / 2;
      if (fly.animate) {
        fly.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.2 }],
          { duration: dur, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' }).onfinish = () => fly.remove();
      } else setTimeout(() => fly.remove(), 50);
      s.remove();
    });
    await wait(580);
  }

  // ---------- 對話 ----------
  let talkChain = Promise.resolve();
  let talkGen = 0;
  const faceTimers = {};
  const bubbleTimers = {};

  function setFace(who, mood) {
    if (!mood || (who !== 'allan' && who !== 'arale')) return;
    const img = who === 'allan' ? $('#allanFace') : $('#face-2');
    if (!img) return;
    img.src = `assets/img/${who}-${mood}.webp`;
    clearTimeout(faceTimers[who]);
    faceTimers[who] = setTimeout(() => { img.src = `assets/img/${who}-${DEFAULT_MOOD[who]}.webp`; }, 6000);
  }

  function showBubble(p, text) {
    const b = $(`#bubble-${p}`);
    if (!b) return;
    b.textContent = text;
    b.hidden = false;
    clearTimeout(bubbleTimers[p]);
    bubbleTimers[p] = setTimeout(() => { b.hidden = true; }, 2600 + text.length * 110);
  }

  function chatMsg(who, text, mood) {
    const log = $('#chatLog');
    const li = document.createElement('li');
    li.className = `msg ${who}${who === 'allan' ? ' mine' : ''}`;
    li.style.setProperty('--c', CAST[who].color);
    const img = (who === 'allan' || who === 'arale') && mood ? `assets/img/${who}-${mood}.webp` : AVATAR[who];
    li.innerHTML = `<img src="${img}" alt=""><div><div class="who"><span>${CAST[who].name}</span><button class="say" type="button" title="再聽一次" aria-label="再聽一次">▶ 播放</button></div><p></p></div>`;
    li.querySelector('p').textContent = text;
    li.querySelector('.say').addEventListener('click', () => { Sfx.unlock(); Voice.speak(who, text, { interrupt: true, force: true }); });
    log.appendChild(li);
    trimLog();
    log.scrollTop = log.scrollHeight;
  }
  function sysMsg(html, kind) {
    const log = $('#chatLog');
    const li = document.createElement('li');
    li.className = 'sys' + (kind ? ' ' + kind : '');
    li.innerHTML = html;
    log.appendChild(li);
    trimLog();
    log.scrollTop = log.scrollHeight;
  }
  function trimLog() { const log = $('#chatLog'); while (log.children.length > 160) log.firstElementChild.remove(); }

  function fill(text, ctx) { return text.replace(/\{(\w+)\}/g, (m, k) => (ctx && ctx[k] != null ? ctx[k] : m)); }

  async function line(who, text, mood, gen) {
    if (gen !== talkGen) return;
    chatMsg(who, text, mood);
    showBubble(SEATS.indexOf(who), text);
    setFace(who, mood);
    const vs = Voice.settings;
    const voiced = Voice.supported && vs.enabled && (who === 'allan' || who === 'arale' || vs.npc);
    if (voiced) await Promise.race([Voice.speak(who, text), rawSleep(3500 + text.length * 320)]);
    else await rawSleep((700 + text.length * 60) * Math.max(0.6, SPEED[prefs.speed]));
  }

  /** 排進對話佇列；回傳的 promise 在這段劇本講完時 resolve */
  let pending = 0;
  function talk(script, ctx, optional) {
    if (!script) return Promise.resolve();
    if (optional && pending >= 2) return Promise.resolve();   // 閒聊排太多就略過，避免對話落後牌局
    const gen = talkGen;
    pending++;
    talkChain = talkChain.then(async () => {
      for (const [who, text, mood] of script) await line(who, fill(text, ctx), mood, gen);
    }).catch(() => {}).then(() => { pending = Math.max(0, pending - 1); });
    return talkChain;
  }
  function resetTalk() { talkGen++; pending = 0; talkChain = Promise.resolve(); Voice.stop(); }

  async function alarm(kind, title, text) {
    const el = $('#alarm');
    el.classList.toggle('good', kind === 'good');
    $('#alarmTitle').textContent = title;
    $('#alarmText').textContent = text;
    el.hidden = false;
    if (kind === 'good') Sfx.chime(); else Sfx.siren();
    await rawSleep(1700);
    el.hidden = true;
  }

  // ---------- 亮牌 ----------
  function exposeDialog(options, suggested) {
    return new Promise((resolve) => {
      const box = $('#exposeCards');
      box.innerHTML = '';
      const effect = {
        [PIG]: '豬 -100 → -200',
        [SHEEP]: '羊 +100 → +200',
        [TRANSFORMER]: '×2 → ×4（單獨 +50 → +100）',
        [HEART_ACE]: '所有紅心分數 ×2',
      };
      for (const id of options) {
        const lab = document.createElement('label');
        lab.className = 'expose-opt';
        lab.innerHTML = `<input type="checkbox" id="ex-${id}" value="${id}"${suggested.includes(id) ? ' checked' : ''}>`;
        lab.appendChild(cardEl(id));
        lab.insertAdjacentHTML('beforeend', `<small>${effect[id]}</small>`);
        box.appendChild(lab);
      }
      const modal = $('#exposeModal');
      modal.hidden = false;
      const done = (list) => { modal.hidden = true; $('#btnExposeOk').onclick = null; $('#btnExposeNone').onclick = null; resolve(list); };
      $('#btnExposeOk').onclick = () => done([...box.querySelectorAll('input:checked')].map((i) => i.value));
      $('#btnExposeNone').onclick = () => done([]);
      setTimeout(() => $('#btnExposeOk').focus(), 50);
    });
  }

  async function exposePhase(r) {
    const st = G.state;
    st.ownerAtDeal = {};
    st.hands.forEach((h, p) => GZ.EXPOSABLE.forEach((id) => { if (h.includes(id)) st.ownerAtDeal[id] = p; }));
    for (let p = 1; p < 4; p++) st.exposed.push(...AI.decideExpose(st, p, SEATS[p]));

    const mine = GZ.exposableFor(st, 0);
    if (mine.length) {
      setStatus('亮牌宣告：要不要亮？', true);
      talk(LINES.exposeIntro[0]);
      const chosen = await exposeDialog(mine, AI.decideExpose(st, 0, 'allan'));
      if (!r.alive) throw ABORT;
      st.exposed.push(...chosen);
      for (const id of chosen) talk(pick(LINES.exposeAllan[id]));
      renderHand(false);
    }
    const others = st.exposed.filter((id) => ownerOf(id) !== 0);
    for (const id of others) {
      const p = ownerOf(id);
      sysMsg(`<b>${NAMES[p]}</b> 亮牌：<b>${GZ.label(id)}</b>（${SPECIAL_NAME[id]}加倍）`, id === SHEEP ? 'good' : 'bad');
      updateSeat(p);
    }
    if (others.length) await talk(pick(LINES.exposeOther), { who: NAMES[ownerOf(others[0])], card: SPECIAL_NAME[others[0]] });
    else if (!st.exposed.length) talk(pick(LINES.exposeNone));
    updateSeat(0);
    await wait(400, r);
  }

  // ---------- 一墩 ----------
  function humanTurn(r) {
    return new Promise((resolve) => {
      renderHand(true);
      setStatus('輪到你出牌！點一張亮起來的牌', true);
      $('#btnHint').disabled = false;
      if (!G.toldFirstTurn) { G.toldFirstTurn = true; talk(LINES.allanFirstTurn[0]); }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { if (r.alive && pickResolver) talk(pick(LINES.idle)); }, 30000);
      pickResolver = (id) => {
        clearTimeout(idleTimer);
        $('#btnHint').disabled = true;
        resolve(id);
      };
    });
  }

  $('#btnHint').addEventListener('click', () => {
    if (!pickResolver) return;
    const { id, why } = AI.choose(G.state, 0, 'allan');
    document.querySelectorAll('#hand .card').forEach((c) => c.classList.toggle('hint', c.dataset.id === id));
    const [who, text, mood] = LINES.hintPrefix[0];
    talk([[who, text, mood]], { card: GZ.label(id), why });
  });

  function describeTrick(cards) {
    return cards.map((c) => `<span class="${suitOf(c) === 'H' || suitOf(c) === 'D' ? 'r' : ''}">${GZ.label(c)}</span>`).join(' ');
  }

  async function onTrickDone(res, r) {
    const st = G.state;
    const { winner, cards } = res;
    const winEl = document.querySelector(`#susan .slot[data-seat="${winner}"] .card`);
    if (winEl) winEl.classList.add('win');
    setStatus(`${NAMES[winner]} 收下這一墩`);
    await wait(750, r);
    const pts = cards.reduce((s, c) => s + GZ.cardPoints(c), 0);
    const hasSp = cards.some(GZ.isScoring);
    sysMsg(`第 ${st.trickNo} 墩 · <b>${NAMES[winner]}</b> 收下 ${describeTrick(cards)}${hasSp ? `（牌面 ${fmt(pts)}${cards.includes(TRANSFORMER) ? '，含變壓器' : ''}）` : ''}`,
      pts < 0 ? 'bad' : pts > 0 ? 'good' : '');
    await collect(winner);
    updateSeat(winner);
    updateBoard();
    const who = SEATS[winner];
    if (cards.includes(PIG)) {
      await alarm('bad', 'RANSOM-PIG ALERT', `勒索豬入侵：${NAMES[winner]}`);
      await talk(pick(LINES.pigTaken[who]));
    } else if (cards.includes(SHEEP)) {
      alarm('good', 'BUDGET +100', `${NAMES[winner]} 收到資安預算羊`);
      await talk(pick(LINES.sheepTaken[who]));
    }
    if (cards.includes(TRANSFORMER)) talk(pick(LINES.tenTaken[who]), null, true);
    const hearts = cards.filter((c) => suitOf(c) === 'H').reduce((s, c) => s + GZ.HEART_VALUE[rankOf(c)], 0);
    if (hearts <= -60 && !cards.includes(PIG) && Math.random() < 0.7) talk(pick(LINES.heartsHeavy[who]), null, true);
    if (winner === 0 && !hasSp && Math.random() < 0.1) talk(pick(LINES.allanWinsTrickClean), null, true);
  }

  function npcBanter(p) {
    const k = SEATS[p];
    if ((k !== 'hacker' && k !== 'phishy') || Math.random() > 0.14) return;
    const text = pick(LINES.npcPlay[k]);
    const script = [[k, text, null]];
    if (Math.random() < 0.5) script.push(['allan', pick(LINES.allanReplyNpc[k]), pick(['lecture', 'wink', 'smile'])]);
    talk(script, null, true);
  }

  // ---------- 一手 ----------
  async function playHand(r) {
    G.handNo += 1;
    G.state = GZ.newHand(Math.random, G.totals);
    const st = G.state;
    clearTable();
    for (let p = 0; p < 4; p++) updateSeat(p);
    updateBoard(true);
    updateHub();
    renderHand(false);
    sysMsg(`—— 第 <b>${G.handNo}</b> 手 · ${NAMES[st.leader]} 拿到 ♣2，先出牌 ——`);
    talk(pick(LINES.handStart), { n: G.handNo }, true);
    await wait(700, r);
    await exposePhase(r);
    st.phase = 'play';
    updateHub();

    while (st.phase === 'play') {
      const p = st.turn;
      markTurn(p);
      updateHub();
      let id;
      if (p === 0) {
        id = await humanTurn(r);
        if (!r.alive) throw ABORT;
      } else {
        setStatus(`${NAMES[p]} 思考中…`);
        await wait(650 + Math.random() * 500, r);
        id = AI.choose(st, p, SEATS[p]).id;
      }
      const res = GZ.play(st, p, id);
      Sfx.card();
      placeCard(p, id);
      if (p === 0) renderHand(false); else updateSeat(p);
      updateHub();
      if (id === PIG) talk(pick(LINES.pigPlayed), null, true);
      else if (p !== 0) npcBanter(p);
      if (res.done) {
        markTurn(-1);
        await onTrickDone(res, r);
      }
    }
    markTurn(-1);
    return handReport(r);
  }

  function verdict(sc) {
    if (sc.grandSlam) return ['slam', '大滿貫 · 卓越績效'];
    if (sc.total > 0) return ['good', '優良實務'];
    if (sc.total === 0) return ['ok', '符合'];
    if (sc.total > -100) return ['minor', '觀察事項'];
    if (sc.total > -300) return ['minor', '次要不符合'];
    return ['major', '主要不符合'];
  }
  function calcText(sc) {
    const t = {
      hearts: (l) => `紅心 ${l.n} 張 ${fmt(l.pts)}${l.doubled ? '（亮♥A×2）' : ''}`,
      allred: (l) => `全紅 ${fmt(l.pts)}`,
      pig: (l) => `豬 ${fmt(l.pts)}${l.doubled ? '（亮）' : ''}`,
      pigflip: (l) => `豬翻正 ${fmt(l.pts)}`,
      sheep: (l) => `羊 ${fmt(l.pts)}${l.doubled ? '（亮）' : ''}`,
      tenAlone: (l) => `變壓器單獨 ${fmt(l.pts)}`,
      tenMul: (l) => `變壓器 ×${l.mul}`,
    };
    return sc.lines.length ? sc.lines.map((l) => t[l.key](l)).join('、') : '沒有分數牌';
  }

  async function handReport(r) {
    const st = G.state;
    const scores = GZ.scoreHand(st);
    scores.forEach((sc, p) => { G.totals[p] += sc.total; });
    updateBoard(true);
    Sfx.bell();
    await wait(500, r);

    const n = String(G.handNo).padStart(2, '0');
    $('#reportNo').textContent = `稽核報告 GZ-${n}`;
    $('#reportTitle').textContent = `第 ${G.handNo} 手 稽核結果`;
    $('#reportRows').innerHTML = scores.map((sc, p) => {
      const sp = st.taken[p].filter(GZ.isScoring)
        .sort((a, b) => (suitOf(a) === 'H') - (suitOf(b) === 'H') || rankOf(b) - rankOf(a));
      const minis = sp.map((c) => `<span class="mini${suitOf(c) === 'H' || suitOf(c) === 'D' ? ' red' : ''}${c === PIG || c === SHEEP || c === TRANSFORMER ? ' sp' : ''}">${GZ.label(c)}</span>`).join('');
      const [vc, vt] = verdict(sc);
      return `<tr>
        <td><span class="rp-who" style="--c:${COLORS[p]}"><img src="${AVATAR[SEATS[p]]}" alt="">${NAMES[p]}</span></td>
        <td><div class="mini-cards">${minis || '—'}</div></td>
        <td class="calc">${calcText(sc)}</td>
        <td class="num">${fmt(sc.total)}</td>
        <td class="num">${G.totals[p]}</td>
        <td><span class="verdict ${vc}">${vt}</span></td>
      </tr>`;
    }).join('');
    const over = GZ.isGameOver(G.totals, G.handNo, G.mode);
    $('#btnNext').textContent = over ? '查看驗證結果' : '下一手';
    $('#reportStamp').textContent = over ? '終審' : '已稽核';
    $('#reportModal').hidden = false;
    setStatus(over ? '散場！看看誰拿到證書' : '這一手結束，請看稽核報告');

    const totals = scores.map((s) => s.total);
    const best = totals.indexOf(Math.max(...totals));
    const worst = totals.indexOf(Math.min(...totals));
    const slam = scores.findIndex((s) => s.grandSlam);
    if (slam >= 0) sysMsg(`<b>${NAMES[slam]}</b> 全收大滿貫 +800！`, 'good');
    let script;
    if (best === 0 && totals[0] > 0) script = pick(LINES.handEnd.allanBest);
    else if (worst === 0 && totals[0] < 0) script = pick(LINES.handEnd.allanWorst);
    else if (best === 2 && totals[2] > 0) script = pick(LINES.handEnd.araleBest);
    else script = pick(LINES.handEnd.other);
    talk(script);

    await new Promise((res) => { $('#btnNext').onclick = () => { $('#btnNext').onclick = null; res(); }; setTimeout(() => $('#btnNext').focus(), 60); });
    $('#reportModal').hidden = true;
    if (!r.alive) throw ABORT;
    return over;
  }

  function showCertificate() {
    const order = [0, 1, 2, 3].sort((a, b) => G.totals[b] - G.totals[a]);
    const w = order[0];
    $('#certName').textContent = NAMES[w];
    $('#certNo').textContent = `證書編號 GZ-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    $('#certRank').innerHTML = order.map((p, i) => `<li><span>${i + 1}. ${NAMES[p]}</span><b>${G.totals[p]}</b></li>`).join('');
    $('#certModal').hidden = false;
    Sfx.bell();
    const k = SEATS[w];
    const script = k === 'allan' ? pick(LINES.gameOver.allanWin) : k === 'arale' ? pick(LINES.gameOver.araleWin) : pick(LINES.gameOver.otherWin);
    talk(script, { who: NAMES[w] });
    setTimeout(() => $('#btnAgain').focus(), 60);
  }

  // ---------- 一局 ----------
  async function newGame() {
    run.alive = false;
    pickResolver = null;
    clearTimeout(idleTimer);
    resetTalk();
    const r = { alive: true };
    run = r;
    ['#reportModal', '#certModal', '#exposeModal', '#alarm'].forEach((s) => { $(s).hidden = true; });
    G = {
      state: null,
      totals: [0, 0, 0, 0],
      handNo: 0,
      mode: prefs.mode === 'hands' ? { type: 'hands', hands: 4 } : { type: 'limit', limit: -1000 },
      toldFirstTurn: false,
    };
    $('#goalText').textContent = prefs.mode === 'hands' ? '快速局：打完 4 手散場' : '累計到 -1000 分即散場';
    $('#chatLog').innerHTML = '';
    $('#scoreRows').innerHTML = '';
    buildStalls();
    G.state = GZ.newHand(Math.random, G.totals);
    G.state.hands = [[], [], [], []];
    updateBoard(true);
    for (let p = 0; p < 4; p++) updateSeat(p);
    renderHand(false);
    clearTable();
    $('#hubTop').textContent = '開桌';
    $('#hubSub').textContent = '準備中';
    setStatus('攤位開張中…');
    try {
      await talk(pick(LINES.intro));
      if (!r.alive) return;
      for (;;) {
        const over = await playHand(r);
        if (over) { showCertificate(); return; }
      }
    } catch (e) {
      if (e !== ABORT) { console.error(e); setStatus('出了點狀況，請按「新局」重新開始'); }
    }
  }

  // ---------- 開場 / 設定 ----------
  function syncIntro() {
    $('#modeLimit').checked = prefs.mode !== 'hands';
    $('#modeHands').checked = prefs.mode === 'hands';
    ({ slow: $('#speedSlow'), mid: $('#speedMid'), fast: $('#speedFast') }[prefs.speed] || $('#speedMid')).checked = true;
    $('#introVoice').checked = Voice.settings.enabled;
    if (!Voice.supported) { $('#introVoice').checked = false; $('#introVoice').disabled = true; }
  }

  function unlockSpeech() {
    // 行動裝置需要在使用者點擊時先「說」一次，之後才能自動播放
    try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) { /* ignore */ }
  }

  $('#btnStart').addEventListener('click', () => {
    prefs.mode = $('#modeHands').checked ? 'hands' : 'limit';
    prefs.speed = document.querySelector('input[name=speed]:checked').value;
    savePrefs();
    Voice.set({ enabled: $('#introVoice').checked && Voice.supported });
    syncVoiceBtn();
    Sfx.unlock();
    unlockSpeech();
    $('#intro').hidden = true;
    newGame();
  });
  $('#btnNew').addEventListener('click', () => { syncIntro(); $('#intro').hidden = false; $('#btnStart').focus(); });
  $('#btnAgain').addEventListener('click', () => { $('#certModal').hidden = true; newGame(); });

  function syncVoiceBtn() {
    const on = Voice.settings.enabled && Voice.supported;
    $('#btnVoice').textContent = on ? '語音：開' : '語音：關';
    $('#btnVoice').setAttribute('aria-pressed', String(on));
  }
  $('#btnVoice').addEventListener('click', () => {
    if (!Voice.supported) return;
    Voice.set({ enabled: !Voice.settings.enabled });
    if (Voice.settings.enabled) { unlockSpeech(); Voice.speak('arale', '語音開啟囉！'); }
    syncVoiceBtn();
  });

  function fillVoiceSelects() {
    const list = Voice.list();
    for (const who of ['allan', 'arale']) {
      const sel = $(`#voice-${who}`);
      const chosen = Voice.settings.voices[who] || '';
      const auto = Voice.pickVoice(who);
      sel.innerHTML = `<option value="">自動（${auto ? auto.name : '系統預設'}）</option>` +
        list.map((v) => `<option value="${v.name.replace(/"/g, '&quot;')}">${v.name}（${v.lang}）</option>`).join('');
      sel.value = chosen;
      const t = Voice.tuneFor(who);
      $(`#pitch-${who}`).value = t.pitch; $(`#pitchOut-${who}`).textContent = Number(t.pitch).toFixed(2);
      $(`#rate-${who}`).value = t.rate; $(`#rateOut-${who}`).textContent = Number(t.rate).toFixed(2);
    }
    const tw = list.filter((v) => /TW|Hant|Taiwan|臺灣|台灣/i.test(v.lang + v.name));
    $('#voiceSupport').textContent = !Voice.supported
      ? '這個瀏覽器不支援語音合成，對話會以文字顯示。'
      : tw.length
        ? `找到 ${tw.length} 個台灣華語聲線。Allan 預設用台灣男聲（YunJhe / Zhiwei），阿拉蕾預設用台灣年輕女聲（HsiaoYu / HsiaoChen / Yating）。Edge 瀏覽器的聲線最完整。`
        : '沒有找到台灣華語聲線，會借用其他中文聲線並調整音高。建議使用 Microsoft Edge 以取得台灣男聲與女聲。';
  }
  Voice.onChange(() => { if (!$('#settingsModal').hidden) fillVoiceSelects(); });

  for (const who of ['allan', 'arale']) {
    $(`#voice-${who}`).addEventListener('change', (e) => { Voice.setVoice(who, e.target.value); fillVoiceSelects(); });
    $(`#pitch-${who}`).addEventListener('input', (e) => { Voice.setTune(who, { pitch: +e.target.value }); $(`#pitchOut-${who}`).textContent = (+e.target.value).toFixed(2); });
    $(`#rate-${who}`).addEventListener('input', (e) => { Voice.setTune(who, { rate: +e.target.value }); $(`#rateOut-${who}`).textContent = (+e.target.value).toFixed(2); });
  }
  document.querySelectorAll('[data-test]').forEach((b) => b.addEventListener('click', () => {
    const who = b.dataset.test;
    Voice.speak(who, who === 'allan' ? '大家好，我是 Allan，Team Taiwan 資安顧問。' : '哇嗚～我是阿拉蕾，今天也要幫老師拱豬喔！', { interrupt: true, force: true });
  }));

  $('#btnSettings').addEventListener('click', () => {
    fillVoiceSelects();
    $('#optNpcVoice').checked = Voice.settings.npc;
    $('#optSfx').checked = prefs.sfx;
    $('#optSpeed').value = prefs.speed;
    $('#settingsModal').hidden = false;
    $('#btnSettingsClose').focus();
  });
  $('#optNpcVoice').addEventListener('change', (e) => Voice.set({ npc: e.target.checked }));
  $('#optSfx').addEventListener('change', (e) => { prefs.sfx = e.target.checked; savePrefs(); });
  $('#optSpeed').addEventListener('change', (e) => { prefs.speed = e.target.value; savePrefs(); });
  $('#btnSettingsClose').addEventListener('click', () => { $('#settingsModal').hidden = true; });

  $('#chatToggle').addEventListener('click', () => {
    if (window.innerWidth > 860) return;
    const c = $('#chat');
    c.classList.toggle('collapsed');
    $('#chatToggle').setAttribute('aria-expanded', String(!c.classList.contains('collapsed')));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#settingsModal').hidden) $('#settingsModal').hidden = true;
  });

  // 初始畫面：先擺好攤位，讓開場背後有東西看
  G = { state: GZ.newHand(Math.random), totals: [0, 0, 0, 0], handNo: 0, mode: { type: 'limit', limit: -1000 } };
  buildStalls();
  updateBoard(true);
  for (let p = 0; p < 4; p++) updateSeat(p);
  renderHand(false);
  syncIntro();
  syncVoiceBtn();

  // 測試用掛勾
  window.__gz = { get G() { return G; }, prefs, newGame };
})();
