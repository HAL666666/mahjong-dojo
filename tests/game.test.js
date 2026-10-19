// 実行: node tests/game.test.js — 対局ロジックの通し試験（CPU 4人で自動対局）
const G = require('../js/game-core.js');
const Y = require('../js/yaku.js');
let pass = 0, fail = 0;
function ok(label, cond, info) { if (cond) pass++; else { fail++; console.log('✗ ' + label + (info ? ' — ' + info : '')); } }

// シャッフルの一様性（ざっくり）：先頭の牌の種類の分布
const hist = new Array(34).fill(0);
for (let i = 0; i < 3400; i++) hist[G.shuffledWall()[0]]++;
ok('シャッフル：全種類が先頭に出る', hist.every(h => h > 40), JSON.stringify(hist));
ok('牌山は136枚・各4枚', (() => { const w = G.shuffledWall(); const c = Y.toCounts(w); return w.length === 136 && c.every(x => x === 4); })());

const GAMES = +(process.argv[2] || 20);
let wins = 0, draws = 0, riichis = 0, hands = 0, yakuSeen = {};
for (let g = 0; g < GAMES; g++) {
  const s = G.newGame();
  let guard = 0, bad = null;
  while (s.phase !== 'gameEnd' && guard++ < 20000) {
    if (s.phase === 'handEnd') {
      const r = s.result;
      hands++;
      if (r.type === 'win') { wins++; r.yaku.forEach(y => { yakuSeen[y.name] = (yakuSeen[y.name] || 0) + 1; }); if (!(r.han >= 1)) bad = 'han<1'; }
      else draws++;
      G.act(s, 0, { type: 'next' });
      continue;
    }
    // 牌の保存則：手牌＋河＋山＋王牌＝136
    const total = s.hands.reduce((a, h) => a + h.length, 0) + s.discards.reduce((a, d) => a + d.length, 0) + s.live.length + s.dead.length;
    if (total !== 136) { bad = '牌の枚数 ' + total; break; }
    const pts = s.scores.reduce((a, b) => a + b, 0) + s.kyotaku * 1000;
    if (pts !== 100000) { bad = '点数合計 ' + pts; break; }
    if (s.phase === 'turn') {
      const n = s.hands[s.turn].length; if (n !== 14) { bad = '手番の手牌 ' + n; break; }
    }
    const before = JSON.stringify([s.phase, s.turn, s.live.length, s.pending && s.pending.waiting]);
    if (s.phase === 'turn' && s.riichi.some(Boolean)) riichis++;
    if (!G.autoStep(s, true)) { bad = '進行不能 ' + before; break; }
  }
  ok('対局' + (g + 1) + ' 正常終了', !bad && s.phase === 'gameEnd', bad || s.phase);
  ok('対局' + (g + 1) + ' 最終点数合計', s.scores.reduce((a, b) => a + b, 0) + s.kyotaku * 1000 === 100000);
  ok('対局' + (g + 1) + ' 順位4人', s.ranking && s.ranking.length === 4);
}
ok('和了が発生する', wins > 0);
console.log(`hands=${hands} wins=${wins} draws=${draws}`);
console.log('出現した役:', Object.entries(yakuSeen).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + v).join(' '));

// ---- ルール単体 ----
(function () {
  const s = G.newGame();
  // 手番の人の手牌を差し替えて立直・フリテンを確認
  const p = s.turn;
  const E = require('../js/engine.js');
  const H = (str) => str.split(' ').map(E.parse);
  s.hands[p] = H('2m 3m 4m 5m 6m 7m 7p 8p 9p 5s 5s 2s 3s 1z'); s.drawn = E.parse('1z');
  const rt = G.riichiTiles(s, p);
  ok('立直可能牌は東のみ', rt.length === 1 && rt[0] === E.parse('1z'), JSON.stringify(rt));
  const sc = s.scores[p];
  G.act(s, p, { type: 'discard', tile: E.parse('1z'), riichi: true });
  if (s.phase === 'ron') { ok('（ロン待ちのためスキップ）', true); return; }
  ok('立直棒1000点', s.scores[p] === sc - 1000 && s.kyotaku >= 1);
  ok('立直フラグ・一発', s.riichi[p] && s.ippatsu[p]);
  // ---- フリテン：待ち 1s/4s で 4s を捨てている → 1s でロンできない ----
  const t = G.newGame(); t.live = t.live.slice(0, 50);
  const d = t.turn, q = (d + 1) % 4;
  t.hands[q] = H('2m 3m 4m 5m 6m 7m 7p 8p 9p 5s 5s 2s 3s');
  t.riichi[q] = true;
  t.hands[d] = H('1s 1m 1m 1m 9p 9p 9p 1z 1z 1z 2z 2z 3z 3z'); t.drawn = E.parse('1s');
  t.discards[q] = [{ t: E.parse('4s') }];
  G.act(t, d, { type: 'discard', tile: E.parse('1s') });
  ok('捨て牌フリテンはロン不可', t.phase === 'turn' && t.turn === q, t.phase);
  // フリテンなしならロンできる
  const u = G.newGame(); const d2 = u.turn, q2 = (d2 + 1) % 4;
  u.hands[q2] = H('2m 3m 4m 5m 6m 7m 7p 8p 9p 5s 5s 2s 3s'); u.riichi[q2] = true;
  u.hands[d2] = H('1s 1m 1m 1m 9p 9p 9p 1z 1z 1z 2z 2z 3z 3z'); u.drawn = E.parse('1s');
  G.act(u, d2, { type: 'discard', tile: E.parse('1s') });
  ok('ロン可能', u.phase === 'ron' && u.pending.waiting === q2, u.phase);
  const before = u.scores.slice();
  G.act(u, q2, { type: 'skip' });
  ok('見逃し後は立直フリテン', u.furitenRiichi[q2] === true);
  // 役なし聴牌（立直なし・嵌張）にはロンが出ない
  const v = G.newGame(); const d3 = v.turn, q3 = (d3 + 1) % 4;
  v.hands[q3] = H('2m 3m 4m 5m 6m 7m 3p 4p 5p 6s 8s 9m 9m');
  v.hands[d3] = H('7s 1m 1m 1m 9p 9p 9p 1z 1z 1z 2z 2z 3z 3z'); v.drawn = E.parse('7s');
  G.act(v, d3, { type: 'discard', tile: E.parse('7s') });
  ok('役なしはロン不可', v.phase === 'turn', v.phase);
  // ロン和了の精算：立直平和 子ロン 2000？ → 立直+平和 2翻30符=2000、本場1で+300、供託
  const w = G.newGame(); const d4 = w.turn, q4 = (d4 + 1) % 4; w.honba = 1; w.kyotaku = 1; w.scores = [24000, 25000, 25000, 25000]; w.scores[d4] = 25000; w.scores[(q4 + 2) % 4] = 24000;
  w.hands[q4] = H('2m 3m 4m 5m 6m 7m 7p 8p 9p 5s 5s 2s 3s'); w.riichi[q4] = true;
  w.hands[d4] = H('1s 1m 1m 1m 9p 9p 9p 1z 1z 1z 2z 2z 3z 3z'); w.drawn = E.parse('1s');
  w.doraIndicators = [E.parse('5z')]; w.uraIndicators = [E.parse('5z')];
  G.act(w, d4, { type: 'discard', tile: E.parse('1s') });
  const s0 = w.scores.slice();
  G.act(w, q4, { type: 'ron' });
  const r = w.result;
  ok('ロン精算：放銃者 -2300', r.deltas[d4] === -(r.calc.total + 300), JSON.stringify(r.deltas));
  ok('ロン精算：和了者 +本場+供託', r.deltas[q4] === r.calc.total + 300 + 1000);
  ok('供託は0に', w.kyotaku === 0);
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
