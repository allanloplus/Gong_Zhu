// 自動對局測試：node tests/simulate.js
const GZ = require('../js/engine.js');
const AI = require('../js/ai.js');
const assert = require('assert');

// 計分單元測試
const ex = [];
assert.strictEqual(GZ.scoreTaken(['S12'], ex).total, -100);
assert.strictEqual(GZ.scoreTaken(['S12'], ['S12']).total, -200);
assert.strictEqual(GZ.scoreTaken(['D11', 'C10'], ex).total, 200);
assert.strictEqual(GZ.scoreTaken(['C10', 'S3'], ex).total, 50);
assert.strictEqual(GZ.scoreTaken(['C10'], ['C10']).total, 100);
assert.strictEqual(GZ.scoreTaken(['C10', 'H2'], ex).total, 0);
assert.strictEqual(GZ.scoreTaken(['C10', 'H14', 'S12'], ['C10']).total, -600);
assert.strictEqual(GZ.scoreTaken(['H14', 'H5', 'H3'], ['H14']).total, -120);
const allH = GZ.newDeck().filter((c) => c[0] === 'H');
assert.strictEqual(GZ.scoreTaken(allH, ex).total, 200);
assert.strictEqual(GZ.scoreTaken([...allH, 'S12'], ex).total, 300);
const slam = GZ.scoreTaken([...allH, 'S12', 'D11', 'C10'], ex);
assert.strictEqual(slam.total, 800); assert.ok(slam.grandSlam);
assert.strictEqual(allH.reduce((s, c) => s + GZ.HEART_VALUE[GZ.rankOf(c)], 0), -200);

// 亮牌限制
const st = GZ.newHand(GZ.mulberry32(1));
st.hands[0] = ['S3', 'S12', 'H2']; st.exposed = ['S12']; st.turn = 0; st.trick = [];
assert.deepStrictEqual(GZ.legalPlays(st, 0).sort(), ['H2', 'S3']);
st.trick = [{ p: 3, id: 'S14' }];
assert.deepStrictEqual(GZ.legalPlays(st, 0), ['S3']);
st.ledSuits = ['S'];
assert.deepStrictEqual(GZ.legalPlays(st, 0).sort(), ['S12', 'S3']);

const personas = ['allan', 'hacker', 'arale', 'phishy'];
let games = 0, hands = 0, slams = 0, allReds = 0;
const sum = [0, 0, 0, 0];
for (let g = 0; g < 400; g++) {
  const rng = GZ.mulberry32(1000 + g);
  let totals = [0, 0, 0, 0], n = 0;
  while (!GZ.isGameOver(totals, n, { type: 'limit', limit: -1000 }) && n < 60) {
    const s = GZ.newHand(rng, totals);
    for (let p = 0; p < 4; p++) s.exposed.push(...AI.decideExpose(s, p, personas[p]));
    s.phase = 'play';
    for (let k = 0; k < 52; k++) {
      const p = s.turn;
      const { id } = AI.choose(s, p, personas[p]);
      assert.ok(GZ.legalPlays(s, p).includes(id), 'AI illegal ' + id);
      GZ.play(s, p, id);
    }
    assert.strictEqual(s.phase, 'scored');
    assert.strictEqual(s.taken.flat().length, 52);
    const sc = GZ.scoreHand(s);
    sc.forEach((r, i) => { totals[i] += r.total; sum[i] += r.total; if (r.grandSlam) slams++; if (r.allRed) allReds++; });
    n++; hands++;
  }
  games++;
}
console.log({ games, hands, avgHandsPerGame: (hands / games).toFixed(1), slams, allReds, avgPerHand: sum.map((x) => (x / hands).toFixed(1)) });
console.log('OK');
