/* 拱豬夜市 — 規則引擎（純邏輯，不碰 DOM，可在 Node 測試） */
(function (root) {
  'use strict';

  const SUITS = ['S', 'H', 'C', 'D'];               // 顯示排序：♠ ♥ ♣ ♦（紅黑交錯）
  const SUIT_SYMBOL = { S: '♠', H: '♥', C: '♣', D: '♦' };
  const SUIT_NAME = { S: '黑桃', H: '紅心', C: '梅花', D: '方塊' };
  const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

  const PIG = 'S12';      // 豬：黑桃 Q
  const SHEEP = 'D11';    // 羊：方塊 J
  const TRANSFORMER = 'C10'; // 變壓器：梅花 10
  const HEART_ACE = 'H14';
  const EXPOSABLE = [PIG, SHEEP, TRANSFORMER, HEART_ACE];

  const HEART_VALUE = { 14: -50, 13: -40, 12: -30, 11: -20, 10: -10, 9: -10, 8: -10, 7: -10, 6: -10, 5: -10, 4: 0, 3: 0, 2: 0 };

  const card = (suit, rank) => ({ id: suit + rank, suit, rank });
  const suitOf = (id) => id[0];
  const rankOf = (id) => parseInt(id.slice(1), 10);
  const label = (id) => SUIT_SYMBOL[suitOf(id)] + (RANK_LABEL[rankOf(id)] || String(rankOf(id)));

  function newDeck() {
    const d = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(card(s, r).id);
    return d;
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sortHand(hand) {
    return hand.slice().sort((a, b) => {
      const sa = SUITS.indexOf(suitOf(a)), sb = SUITS.indexOf(suitOf(b));
      return sa !== sb ? sa - sb : rankOf(a) - rankOf(b);
    });
  }

  /** 單張牌在一墩中的「表面分數」，給 AI 與畫面提示用 */
  function cardPoints(id) {
    if (id === PIG) return -100;
    if (id === SHEEP) return 100;
    if (suitOf(id) === 'H') return HEART_VALUE[rankOf(id)];
    return 0;
  }
  const isScoring = (id) => id === PIG || id === SHEEP || id === TRANSFORMER || suitOf(id) === 'H';

  /** 新的一手 */
  function newHand(rng, prevTotals) {
    const deck = shuffle(newDeck(), rng);
    const hands = [0, 1, 2, 3].map((p) => sortHand(deck.slice(p * 13, p * 13 + 13)));
    const leader = hands.findIndex((h) => h.includes('C2'));
    return {
      hands,
      taken: [[], [], [], []],
      exposed: [],          // 亮出的牌 id
      ledSuits: [],         // 這一手已經被「引」過的花色
      trick: [],            // [{ p, id }]
      leader,
      turn: leader,
      trickNo: 0,
      played: [],           // 已打出的牌
      history: [],          // 每墩紀錄 { cards, winner }
      totals: prevTotals ? prevTotals.slice() : [0, 0, 0, 0],
      phase: 'expose',
    };
  }

  function exposableFor(state, p) {
    return EXPOSABLE.filter((id) => state.hands[p].includes(id));
  }

  /**
   * 合法出牌：
   * 1. 有引牌花色必須跟。
   * 2. 亮過的牌，在該花色「第一次被引出的那一墩」不能打（含自己引），除非手上該花色只剩它。
   */
  function legalPlays(state, p) {
    const hand = state.hands[p];
    const led = state.trick.length ? suitOf(state.trick[0].id) : null;
    let pool = led ? hand.filter((c) => suitOf(c) === led) : hand.slice();
    if (!pool.length) pool = hand.slice();

    const blocked = (c) => {
      if (!state.exposed.includes(c)) return false;
      const s = suitOf(c);
      const firstRoundOfSuit = !state.ledSuits.includes(s) && (led === null || led === s);
      if (!firstRoundOfSuit) return false;
      return hand.filter((x) => suitOf(x) === s).length > 1;
    };
    const ok = pool.filter((c) => !blocked(c));
    return ok.length ? ok : pool;
  }

  function trickWinner(trick) {
    const led = suitOf(trick[0].id);
    let best = trick[0];
    for (const t of trick) if (suitOf(t.id) === led && rankOf(t.id) > rankOf(best.id)) best = t;
    return best.p;
  }

  /** 出一張牌；回傳 { done, winner } */
  function play(state, p, id) {
    if (state.turn !== p) throw new Error('not your turn');
    if (!legalPlays(state, p).includes(id)) throw new Error('illegal play ' + id);
    state.hands[p] = state.hands[p].filter((c) => c !== id);
    if (!state.trick.length) state.pendingLed = suitOf(id);
    state.trick.push({ p, id });
    state.played.push(id);
    if (state.trick.length < 4) {
      state.turn = (p + 1) % 4;
      return { done: false };
    }
    const winner = trickWinner(state.trick);
    const cards = state.trick.map((t) => t.id);
    state.taken[winner].push(...cards);
    state.history.push({ trick: state.trick.slice(), winner, leader: state.leader });
    if (!state.ledSuits.includes(state.pendingLed)) state.ledSuits.push(state.pendingLed);
    state.trick = [];
    state.leader = winner;
    state.turn = winner;
    state.trickNo += 1;
    if (state.trickNo === 13) state.phase = 'scored';
    return { done: true, winner, cards };
  }

  /**
   * 計分（每位玩家各自計算）
   * - 紅心：A -50、K -40、Q -30、J -20、10~5 各 -10、4~2 為 0；♥A 亮牌則全部紅心 ×2
   * - 收齊 13 張紅心（全紅）：紅心改為 +200；此時豬也翻正為 +100
   * - 豬 ♠Q -100（亮牌 -200）；羊 ♦J +100（亮牌 +200）
   * - 變壓器 ♣10：手上沒有其他分數牌時 +50（亮牌 +100）；否則總分 ×2（亮牌 ×4）
   * - 全收 16 張分數牌 = (200 + 100 + 100) × 2 = +800，稱「大滿貫」
   */
  function scoreTaken(cards, exposed) {
    const ex = (id) => exposed.includes(id);
    const hearts = cards.filter((c) => suitOf(c) === 'H');
    const allRed = hearts.length === 13;
    const hMul = ex(HEART_ACE) ? 2 : 1;
    const lines = [];
    let base = 0;

    if (hearts.length) {
      const pts = allRed ? 200 * hMul : hearts.reduce((s, c) => s + HEART_VALUE[rankOf(c)], 0) * hMul;
      base += pts;
      lines.push({ key: allRed ? 'allred' : 'hearts', pts, n: hearts.length, doubled: hMul === 2 });
    }
    const hasPig = cards.includes(PIG);
    if (hasPig) {
      const pts = (allRed ? 100 : -100) * (ex(PIG) ? 2 : 1);
      base += pts;
      lines.push({ key: allRed ? 'pigflip' : 'pig', pts, doubled: ex(PIG) });
    }
    const hasSheep = cards.includes(SHEEP);
    if (hasSheep) {
      const pts = 100 * (ex(SHEEP) ? 2 : 1);
      base += pts;
      lines.push({ key: 'sheep', pts, doubled: ex(SHEEP) });
    }
    let total = base;
    if (cards.includes(TRANSFORMER)) {
      const tex = ex(TRANSFORMER);
      if (!hearts.length && !hasPig && !hasSheep) {
        total = tex ? 100 : 50;
        lines.push({ key: 'tenAlone', pts: total, doubled: tex });
      } else {
        const mul = tex ? 4 : 2;
        total = base * mul;
        lines.push({ key: 'tenMul', mul, doubled: tex });
      }
    }
    const grandSlam = allRed && hasPig && hasSheep && cards.includes(TRANSFORMER);
    return { total, lines, allRed, grandSlam };
  }

  function scoreHand(state) {
    return state.taken.map((cards) => scoreTaken(cards, state.exposed));
  }

  /** 遊戲是否結束：mode = { type: 'limit', limit: -1000 } 或 { type: 'hands', hands: 4 } */
  function isGameOver(totals, handsPlayed, mode) {
    if (mode.type === 'hands') return handsPlayed >= mode.hands;
    return totals.some((t) => t <= mode.limit);
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const GZ = {
    SUITS, SUIT_SYMBOL, SUIT_NAME, RANK_LABEL, PIG, SHEEP, TRANSFORMER, HEART_ACE, EXPOSABLE, HEART_VALUE,
    suitOf, rankOf, label, newDeck, shuffle, sortHand, cardPoints, isScoring,
    newHand, exposableFor, legalPlays, trickWinner, play, scoreTaken, scoreHand, isGameOver, mulberry32,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GZ;
  else root.GZ = GZ;
})(typeof window !== 'undefined' ? window : globalThis);
