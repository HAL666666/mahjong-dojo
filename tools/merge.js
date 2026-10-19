// 実行: node tools/merge.js 題名 a.json b.json ... — pair.js --json の結果を合算して表示
const fs = require('fs'); const sim = require('./sim.js');
const [title, ...files] = process.argv.slice(2); const st = sim.newStats();
for (const f of files) {
  const x = JSON.parse(fs.readFileSync(f, 'utf8').trim().split('\n').pop());
  for (const k of ['games', 'hands', 'draws', 'calls', 'callPrompts', 'openWins', 'doubleRon']) st[k] += x[k];
  for (const k of ['win', 'dealin', 'seats', 'score', 'yaku', 'abort', 'ends']) for (const [kk, v] of Object.entries(x[k])) st[k][kk] = (st[k][kk] || 0) + v;
  for (const [kk, v] of Object.entries(x.rank)) st.rank[kk] = (st.rank[kk] || []).concat(v);
}
sim.report(st, title);
