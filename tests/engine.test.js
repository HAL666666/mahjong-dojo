// 実行: node tests/engine.test.js
const E = require('../js/engine.js');
const Q = require('../js/questions.js');
let pass = 0, fail = 0;
function eq(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; }
  else { fail++; console.log('✗ ' + label + ' — got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); }
}
const C = E.calculate;
// --- 点数表の既知値 ---
eq('30符4翻 子ロン', C(4, 30, 'ron', false).ron, 7700);
eq('30符4翻 子ロン 満貫扱いしない', C(4, 30, 'ron', false).limit, '');
eq('40符3翻 子ロン', C(3, 40, 'ron', false).ron, 5200);
eq('40符3翻 親ロン', C(3, 40, 'ron', true).ron, 7700);
eq('30符3翻 親ツモ（2,000オール）', C(3, 30, 'tsumo', true).dealerPay, 2000);
eq('30符3翻 親ツモ 合計', C(3, 30, 'tsumo', true).total, 6000);
eq('40符3翻 親ツモ', C(3, 40, 'tsumo', true).dealerPay, 2600);
eq('90符2翻 親ツモ 2,900オール', C(2, 90, 'tsumo', true).dealerPay, 2900);
eq('平和ツモ20符2翻 子', [C(2, 20, 'tsumo', false).childPay, C(2, 20, 'tsumo', false).dealerPay], [400, 700]);
eq('七対子25符2翻 子ロン', C(2, 25, 'ron', false).ron, 1600);
eq('七対子25符3翻 子ロン', C(3, 25, 'ron', false).ron, 3200);
eq('70符2翻 子ロン', C(2, 70, 'ron', false).ron, 4500);
eq('30符1翻 子ロン', C(1, 30, 'ron', false).ron, 1000);
eq('30符1翻 子ツモ', E.paymentText(1, 30, 'tsumo', false), '300/500点');
eq('30符2翻 子ロン', C(2, 30, 'ron', false).ron, 2000);
eq('40符2翻 子ロン', C(2, 40, 'ron', false).ron, 2600);
eq('110符1翻 子ロン', C(1, 110, 'ron', false).ron, 3600);
eq('60符3翻 子ロン（基本点1,920）', C(3, 60, 'ron', false).ron, 7700);
eq('70符3翻 子ロン→満貫', [C(3, 70, 'ron', false).ron, C(3, 70, 'ron', false).limit], [8000, 'mangan']);
eq('40符4翻 子ロン→満貫', C(4, 40, 'ron', false).ron, 8000);
eq('満貫5翻 子ロン', C(5, 30, 'ron', false).ron, 8000);
eq('満貫 親ロン', C(5, 30, 'ron', true).ron, 12000);
eq('満貫 子ツモ', E.paymentText(5, 30, 'tsumo', false), '2,000/4,000点');
eq('満貫 親ツモ', E.paymentText(5, 30, 'tsumo', true), '4,000点オール');
eq('跳満6翻 子ロン', C(6, 30, 'ron', false).ron, 12000);
eq('跳満7翻 親ロン', C(7, 30, 'ron', true).ron, 18000);
eq('倍満8翻 子ロン', C(8, 30, 'ron', false).ron, 16000);
eq('倍満10翻 子ツモ', E.paymentText(10, 20, 'tsumo', false), '4,000/8,000点');
eq('三倍満11翻 子ロン', C(11, 30, 'ron', false).ron, 24000);
eq('三倍満12翻 親ロン', C(12, 30, 'ron', true).ron, 36000);
eq('役満13翻 子ロン', C(13, 30, 'ron', false).ron, 32000);
eq('役満 親ロン', C(13, 30, 'ron', true).ron, 48000);
eq('役満 子ツモ', E.paymentText(13, 30, 'tsumo', false), '8,000/16,000点');
eq('0翻は不成立', C(0, 30, 'ron', false).total, 0);
// --- 符の丸め・特例 ---
eq('34符→40', E.fuFromRaw(34), 40);
eq('20符(通常)→30', E.fuFromRaw(20), 30);
eq('平和ツモ20', E.fuFromRaw(22, true), 20);
eq('七対子25', E.fuFromRaw(30, false, true), 25);
eq('62符→70', E.fuFromRaw(62), 70);
// --- 手牌解析（符） ---
const A = (tiles, o) => E.analyze(tiles, o).best;
const pinfu = ['2m','3m','4m','5m','6m','7m','7p','8p','9p','5s','5s','2s','3s','4s'];
eq('平和ツモ形 20符', A(pinfu, { winTile: '4s', method: 'tsumo', closed: true, seat: 1 }).fu, 20);
eq('平和ロン形 30符', A(pinfu, { winTile: '4s', method: 'ron', closed: true, seat: 1 }).fu, 30);
eq('鳴き平和形ロン 30符', A(pinfu, { winTile: '4s', method: 'ron', closed: false, seat: 1 }).fu, 30);
eq('嵌張ツモ 30符(20+2+2)', A(pinfu, { winTile: '3s', method: 'tsumo', closed: true, seat: 1 }).raw, 24);
eq('七対子 25符', A(['1m','1m','2m','2m','3m','3m','4p','4p','5p','5p','6s','6s','1z','1z'], { winTile: '1z', method: 'ron', closed: true }).fu, 25);
const sanko = ['1m','1m','1m','9p','9p','9p','7z','7z','7z','2s','3s','4s','5m','5m'];
eq('幺九暗刻×3 単騎ロン 20+10+24+2=56→60', A(sanko, { winTile: '5m', method: 'ron', closed: true }).fu, 60);
eq('暗槓扱い(1m) 20+10+32+16+2=80', A(sanko, { winTile: '5m', method: 'ron', closed: true, kans: ['1m','9p'] }).raw, 20 + 10 + 32 + 32 + 8 + 2);
eq('双碰ロン→明刻扱い', A(['1m','1m','1m','2p','3p','4p','5s','6s','7s','5p','5p','5p','8m','8m'], { winTile: '5p', method: 'ron', closed: true }).raw, 20 + 10 + 8 + 2);
eq('連風牌雀頭 4符', A(['1z','1z','2m','3m','4m','5p','6p','7p','3s','4s','5s','6s','7s','8s'], { winTile: '8s', method: 'ron', closed: true, seat: 0, round: 0 }).raw, 34);
eq('5枚目は不可', E.analyze(['1m','1m','1m','1m','1m','2m','3m','4m','5m','6m','7m','8m','9m','9m'], { winTile: '1m', method: 'ron' }).valid, false);
eq('非和了形は不可', E.analyze(['1m','3m','5m','7m','9m','2p','4p','6p','8p','1s','3s','5s','7s','9s'], { winTile: '1m', method: 'ron' }).valid, false);
// --- 受け入れ（v2用） ---
const vis = new Array(34).fill(0); vis[E.parse('1s')] = 1; vis[E.parse('4s')] = 1;
eq('受け入れ 1s/4s 6枚', E.ukeire(['2m','3m','4m','5m','6m','7m','7p','8p','9p','5s','5s','2s','3s'], vis).total, 6);
// --- クイズ問題をすべてエンジンで検証 ---
Q.forEach((q, i) => {
  const a = E.analyze(q.tiles, { winTile: q.win, method: q.method, closed: q.closed, seat: q.seat, round: q.round, openTriplets: q.open || [] });
  const han = q.yaku.reduce((s, y) => s + y[1], 0) + q.dora;
  eq('Q' + (i + 1) + ' ' + q.title + ' 和了形', a.valid, true);
  if (!a.valid) return;
  eq('Q' + (i + 1) + ' 翻', han, q.expect.han);
  eq('Q' + (i + 1) + ' 符', a.best.fu, q.expect.fu);
  eq('Q' + (i + 1) + ' 点数', E.paymentText(han, a.best.fu, q.method, q.dealer), q.expect.pay);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
