// 実行: node tools/pair.js 強い側 弱い側 半荘数 [開始番号] [--json]  — 1人 vs 3人を席を回して比較
const sim = require('./sim.js');
const [a, b, n, off] = [process.argv[2], process.argv[3], +(process.argv[4] || 20), +(process.argv[5] || 0)];
const st = sim.newStats(); const t0 = Date.now();
for (let g = 0; g < n; g++) { const lv = [b, b, b, b]; lv[(g + off) % 4] = a; sim.runGame(lv, {}, st, true); }
if (process.argv.includes('--json')) console.log(JSON.stringify(st));
else { sim.report(st, a + '×1 vs ' + b + '×3'); console.log('time', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
