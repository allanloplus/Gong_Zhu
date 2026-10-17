/* 拱豬夜市 — 電腦玩家策略（啟發式；也拿來給「問阿拉蕾」當提示） */
(function (root) {
  'use strict';
  const GZ = root.GZ || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const { suitOf, rankOf, PIG, SHEEP, TRANSFORMER, HEART_ACE } = GZ;

  /** 個性：risk 越高越敢衝；expose 越高越愛亮牌 */
  const PERSONA = {
    allan: { risk: 0.5, expose: 0.5 },
    hacker: { risk: 0.75, expose: 0.6 },
    arale: { risk: 0.45, expose: 0.55 },
    phishy: { risk: 0.35, expose: 0.4 },
  };

  function unseen(state, p) {
    const known = new Set([...state.played, ...state.hands[p], ...state.trick.map((t) => t.id)]);
    return GZ.newDeck().filter((c) => !known.has(c));
  }

  const pigOut = (state) => state.played.includes(PIG) || state.trick.some((t) => t.id === PIG);

  /** 一墩目前的「價值」（對收下的人而言） */
  function trickValue(trick) {
    let v = 0;
    for (const t of trick) v += t.id === TRANSFORMER ? -25 : GZ.cardPoints(t.id);
    return v;
  }

  function decideExpose(state, p, personaKey) {
    const persona = PERSONA[personaKey] || PERSONA.arale;
    const hand = state.hands[p];
    const bySuit = (s) => hand.filter((c) => suitOf(c) === s);
    const out = [];
    for (const id of GZ.exposableFor(state, p)) {
      const suit = bySuit(suitOf(id));
      const low = suit.filter((c) => rankOf(c) <= 9).length;
      let want = 0;
      if (id === PIG) want = suit.length >= 5 && low >= 3 ? 0.8 : suit.length >= 4 && low >= 3 ? 0.35 : 0;
      if (id === SHEEP) {
        const high = suit.filter((c) => rankOf(c) > 11).length;
        want = high >= 2 ? 0.75 : suit.length >= 5 && high >= 1 ? 0.45 : 0;
      }
      if (id === TRANSFORMER) want = suit.length >= 5 && low >= 3 ? 0.5 : 0.05;
      if (id === HEART_ACE) want = suit.length <= 2 ? 0.55 : suit.length <= 3 ? 0.25 : 0;
      if (Math.random() < want * (0.6 + persona.expose * 0.8)) out.push(id);
    }
    return out;
  }

  /** 選一張牌。回傳 { id, why }，why 是給阿拉蕾講解用的短句 */
  function choose(state, p, personaKey) {
    const persona = PERSONA[personaKey] || PERSONA.arale;
    const legal = GZ.legalPlays(state, p);
    if (legal.length === 1) return { id: legal[0], why: '只剩這張可以出，沒得選啦～' };
    const hand = state.hands[p];
    const trick = state.trick;
    const others = unseen(state, p);
    const hasPig = hand.includes(PIG);
    const byRankDesc = (a, b) => rankOf(b) - rankOf(a);
    const byRankAsc = (a, b) => rankOf(a) - rankOf(b);

    // ---------- 領牌 ----------
    if (!trick.length) {
      // 手上的羊已經是最大方塊 → 自己收
      if (legal.includes(SHEEP) && !others.some((c) => suitOf(c) === 'D' && rankOf(c) > 11) &&
          others.some((c) => suitOf(c) === 'D')) {
        return { id: SHEEP, why: '方塊比羊大的牌都出完了，直接把羊領回家！' };
      }
      // 沒有豬、豬也還沒出 → 用小黑桃逼豬
      if (!hasPig && !pigOut(state)) {
        const smallS = legal.filter((c) => suitOf(c) === 'S' && rankOf(c) < 12).sort(byRankAsc);
        const pigHolderAlive = others.includes(PIG);
        if (smallS.length && pigHolderAlive && Math.random() < 0.55 + persona.risk * 0.4) {
          return { id: smallS[0], why: '出小黑桃「釣豬」，逼拿豬的人自己吃下去！' };
        }
      }
      let best = null, bestScore = -Infinity;
      for (const c of legal) {
        const s = suitOf(c), r = rankOf(c);
        const outSuit = others.filter((x) => suitOf(x) === s);
        const higher = outSuit.filter((x) => rankOf(x) > r).length;
        const mySuitLen = hand.filter((x) => suitOf(x) === s).length;
        let score = higher * 3 - r * 0.4 - mySuitLen * 0.6;
        if (!outSuit.length) score -= 30;               // 別人都沒有 → 一定自己收、還會被墊分
        if (higher === 0) score -= 8 + GZ.cardPoints(c) * -0.2;
        if (c === PIG) score -= 100;
        if (c === SHEEP) score -= 15;
        if (c === TRANSFORMER) score -= 12;
        if (s === 'S' && r > 12 && !pigOut(state) && !hasPig) score -= 40;
        if (s === 'H') score -= r >= 10 ? 14 : 2;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      return { id: best, why: '先出這張，被別人壓過的機會比較大，比較安全。' };
    }

    const led = suitOf(trick[0].id);
    const followers = legal.filter((c) => suitOf(c) === led);
    const isLast = trick.length === 3;
    const winRank = Math.max(...trick.filter((t) => suitOf(t.id) === led).map((t) => rankOf(t.id)));
    const value = trickValue(trick);

    // ---------- 跟牌 ----------
    if (followers.length) {
      const below = followers.filter((c) => rankOf(c) < winRank).sort(byRankDesc);
      const above = followers.filter((c) => rankOf(c) > winRank).sort(byRankAsc);

      if (led === 'S' && legal.includes(PIG) && winRank > 12) {
        return { id: PIG, why: '有人出了黑桃 A 或 K，趁機把豬送給他！' };
      }
      if (led === 'D' && legal.includes(SHEEP) && rankOf(SHEEP) > winRank) {
        const higherOut = others.some((c) => suitOf(c) === 'D' && rankOf(c) > 11);
        if (isLast || !higherOut) return { id: SHEEP, why: '這墩用羊壓得住，自己的羊自己收！' };
      }
      const nonSpecial = (arr) => arr.filter((c) => c !== PIG && c !== SHEEP);
      const sheepHere = trick.some((t) => t.id === SHEEP);

      if (value > 0 && above.length) {
        const pick = isLast ? above[0] : above[above.length - 1];
        return { id: pick, why: sheepHere ? '羊在桌上！搶下來 +100！' : '這墩是正分，收下來划算。' };
      }
      if (isLast && value === 0 && above.length) {
        const pick = nonSpecial(above).sort(byRankDesc)[0] || above[0];
        return { id: pick, why: '最後一家、桌上沒分數，趁機丟掉大牌。' };
      }
      if (below.length) {
        let cand = below;
        if (led === 'S' && hasPig && below.length > 1) cand = below.filter((c) => c !== PIG);
        if (led === 'S' && !hasPig && !pigOut(state)) cand = cand.filter((c) => rankOf(c) < 12).concat(cand.filter((c) => rankOf(c) >= 12));
        return { id: cand[0], why: '出比桌上最大還小的牌，閃過這一墩。' };
      }
      // 一定會贏（目前）
      if (led === 'H') {
        return { id: above[0], why: isLast ? '這墩逃不掉了，出最小的紅心，少吃一點。' : '先出最小的紅心，說不定後面有人壓過去。' };
      }
      const safe = nonSpecial(above);
      if (isLast) return { id: (safe.sort(byRankDesc)[0] || above[0]), why: '反正要收，順手清掉大牌。' };
      if (led === 'S' && !hasPig && !pigOut(state)) {
        const sub = safe.filter((c) => rankOf(c) < 12);
        if (sub.length) return { id: sub[0], why: '小心豬！先別出黑桃 A、K。' };
      }
      return { id: (safe.sort(byRankDesc)[0] || above[0]), why: '壓不過也閃不掉，就出大的換主導權。' };
    }

    // ---------- 墊牌（沒有該花色） ----------
    const order = [];
    if (legal.includes(PIG)) order.push([PIG, '沒這花色，正好把豬墊出去！']);
    const highHearts = legal.filter((c) => suitOf(c) === 'H' && rankOf(c) >= 10).sort(byRankDesc);
    for (const h of highHearts) order.push([h, '墊大紅心，讓別人去扛分。']);
    if (!hasPig && !pigOut(state)) {
      for (const c of legal.filter((x) => suitOf(x) === 'S' && rankOf(x) > 12).sort(byRankDesc)) {
        order.push([c, '先丟掉黑桃 A、K，免得之後被豬咬到。']);
      }
    }
    if (legal.includes(TRANSFORMER) && value < 0) order.push([TRANSFORMER, '桌上是負分，丟變壓器讓收牌的人雙倍痛！']);
    if (order.length) return { id: order[0][0], why: order[0][1] };

    const rest = legal.filter((c) => c !== SHEEP && c !== TRANSFORMER);
    const pool = rest.length ? rest : legal;
    const suitLen = (s) => hand.filter((x) => suitOf(x) === s).length;
    pool.sort((a, b) => (suitLen(suitOf(a)) - suitLen(suitOf(b))) || (rankOf(b) - rankOf(a)));
    return { id: pool[0], why: '墊掉短門的大牌，早點斷門。' };
  }

  const AI = { PERSONA, choose, decideExpose, trickValue };
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  else root.AI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
