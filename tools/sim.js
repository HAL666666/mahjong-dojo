// 実行: node tools/sim.js [半荘数] [席の構成 例 hard,easy,easy,easy]
const G = require('../js/game-core.js');
function runGame(levels, rules, stats, check) {
  const s = G.newGame(Object.assign({}, rules || {}), { levels });
  let guard = 0;
  while (s.phase !== 'gameEnd' && guard++ < 50000) {
    if (check) {
      const n = G.tileCount(s);
      if (n !== 136) throw new Error('牌の枚数 ' + n + ' phase=' + s.phase);
      const pts = s.scores.reduce((a, b) => a + b, 0) + s.kyotaku * 1000;
      if (pts !== 100000) throw new Error('点数合計 ' + pts);
      if (s.phase === 'turn') { const p = s.turn; const n2 = s.hands[p].length + 3 * s.melds[p].length; if (n2 !== 14) throw new Error('手牌 ' + n2); }
    }
    if (s.phase === 'handEnd') {
      const r = s.result; stats.hands++;
      if (r.type === 'win') {
        r.wins.forEach(w => { stats.win[levels[w.winner]] = (stats.win[levels[w.winner]] || 0) + 1; w.yaku.forEach(y => stats.yaku[y.name] = (stats.yaku[y.name] || 0) + 1); if (w.melds.some(m => m.type !== 'ankan')) stats.openWins++; });
        if (r.wins.length > 1) stats.doubleRon++;
        if (r.method === 'ron') stats.dealin[levels[r.from]] = (stats.dealin[levels[r.from]] || 0) + 1;
      } else if (r.type === 'abort') stats.abort[r.reason] = (stats.abort[r.reason] || 0) + 1;
      else stats.draws++;
      G.act(s, 0, { type: 'next' }); continue;
    }
    if (s.phase === 'call') stats.callPrompts++;
    const mBefore = s.melds.reduce((a, m) => a + m.length, 0);
    if (!G.autoStep(s, true)) throw new Error('進行不能 ' + s.phase);
    const mAfter = s.melds.reduce((a, m) => a + m.length, 0);
    if (mAfter > mBefore) stats.calls++;
  }
  if (s.phase !== 'gameEnd') throw new Error('終わらない');
  stats.games++; stats.ends[s.endReason] = (stats.ends[s.endReason] || 0) + 1;
  s.ranking.forEach((p, i) => { const lv = levels[p]; (stats.rank[lv] = stats.rank[lv] || []).push(i + 1); stats.seats[lv] = (stats.seats[lv] || 0) + 1; stats.score[lv] = (stats.score[lv] || 0) + s.scores[p]; });
  return s;
}
function newStats() { return { games: 0, hands: 0, draws: 0, win: {}, dealin: {}, rank: {}, seats: {}, score: {}, yaku: {}, abort: {}, ends: {}, calls: 0, callPrompts: 0, openWins: 0, doubleRon: 0 }; }
function report(st, title) {
  console.log('== ' + title + ' : ' + st.games + '半荘 / ' + st.hands + '局');
  Object.keys(st.rank).forEach(lv => {
    const r = st.rank[lv], n = r.length, hpp = st.hands * n / st.games;
    console.log(`  ${lv.padEnd(6)} 平均順位 ${(r.reduce((a, b) => a + b, 0) / n).toFixed(2)}  トップ率 ${(100 * r.filter(x => x === 1).length / n).toFixed(1)}%  ラス率 ${(100 * r.filter(x => x === 4).length / n).toFixed(1)}%  和了率 ${(100 * (st.win[lv] || 0) / hpp).toFixed(1)}%  放銃率 ${(100 * (st.dealin[lv] || 0) / hpp).toFixed(1)}%  平均終局点 ${Math.round(st.score[lv] / n)}`);
  });
  console.log('  流局', st.draws, '途中流局', JSON.stringify(st.abort), '鳴き', st.calls, '副露和了', st.openWins, 'ダブロン', st.doubleRon, '終了理由', JSON.stringify(st.ends));
}
module.exports = { runGame, newStats, report };
if (require.main === module) {
  const N = +(process.argv[2] || 10);
  const mode = process.argv[3] || 'mixed';
  const t0 = Date.now();
  if (mode === 'mixed') {
    // 上級1・初級3、上級1・中級3、中級1・初級3 を席を回して比較
    [['hard', 'easy'], ['hard', 'normal'], ['normal', 'easy']].forEach(([a, b]) => {
      const st = newStats();
      for (let g = 0; g < N; g++) { const lv = [b, b, b, b]; lv[g % 4] = a; runGame(lv, {}, st, true); }
      report(st, a + '×1 vs ' + b + '×3');
    });
  } else {
    const st = newStats();
    for (let g = 0; g < N; g++) runGame([mode, mode, mode, mode], {}, st, true);
    report(st, mode + '×4');
    console.log('  役', Object.entries(st.yaku).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + v).join(' '));
  }
  console.log('time', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
