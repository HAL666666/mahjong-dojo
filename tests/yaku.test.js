// 実行: node tests/yaku.test.js — 役判定と和了点の総合テスト
const E = require('../js/engine.js');
const Y = require('../js/yaku.js');
let pass = 0, fail = 0;
function eq(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log('✗ ' + label + ' — got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); }
}
// "123m456p11z" 形式を牌番号の配列へ
function H(s) {
  const out = []; let buf = [];
  for (const ch of s.replace(/\s/g, '')) {
    if (/\d/.test(ch)) buf.push(ch);
    else { buf.forEach(d => out.push(E.parse(d + ch))); buf = []; }
  }
  return out;
}
const T = (s) => E.parse(s);
// 既定は 東場・南家（子）・ロン・ドラなし
function ev(hand, win, o = {}) {
  const ctx = Object.assign({ winTile: T(win), method: 'ron', seat: 1, round: 0, dealer: false, doraIndicators: [], uraIndicators: [] }, o);
  if (ctx.seat === 0) ctx.dealer = true;
  const tiles = H(hand); if (tiles.length === 13) tiles.push(T(win));
  return Y.evaluate(tiles, ctx);
}
function names(r) { return r.yaku.filter(y => !y.dora).map(y => y.name).sort(); }
function check(label, hand, win, o, want) {
  const r = ev(hand, win, o);
  if (!r) { fail++; console.log('✗ ' + label + ' — 和了形として認識されない'); return; }
  if (want.yaku) eq(label + ' 役', names(r), want.yaku.slice().sort());
  if (want.han != null) eq(label + ' 翻', r.han, want.han);
  if (want.fu != null) eq(label + ' 符', r.fu, want.fu);
  if (want.total != null) eq(label + ' 点', r.calc.total, want.total);
  if (want.pay) eq(label + ' 支払い', [r.calc.childPay, r.calc.dealerPay], want.pay);
  if (want.valid != null) eq(label + ' 成立', r.valid, want.valid);
  if (want.gain != null) eq(label + ' 収入', r.calc.gain, want.gain);
}

// ---- 1翻〜 ----
check('平和ツモ', '234567m789p55s234s', '4s', { method: 'tsumo' }, { yaku: ['平和', '門前清自摸和'], han: 2, fu: 20, pay: [400, 700], total: 1500 });
check('立直平和断幺九ロン', '234m567m345p678s55p', '8s', { riichi: true }, { yaku: ['立直', '平和', '断幺九'], han: 3, fu: 30, total: 3900 });
check('一盃口', '223344m567p678s99p', '5p', { riichi: true }, { yaku: ['立直', '平和', '一盃口'], han: 3, fu: 30, total: 3900 });
check('二盃口（七対子より高い方）', '223344m667788p55s', '5s', {}, { yaku: ['二盃口', '断幺九'], han: 4, fu: 40, total: 8000 });
check('七対子', '1199m3377p2255s11z', '1z', { riichi: true }, { yaku: ['七対子', '立直'], han: 3, fu: 25, total: 3200 });
check('七対子断幺九', '224466m3355p7788s', '8s', {}, { yaku: ['七対子', '断幺九'], han: 3, fu: 25, total: 3200 });
check('三色同順', '123m123p123s789p55s', '1m', {}, { yaku: ['三色同順', '平和'], han: 3, fu: 30, total: 3900 });
check('一気通貫', '123456789m234p55s', '9m', {}, { yaku: ['一気通貫', '平和'], han: 3, fu: 30, total: 3900 });
check('混全帯幺九＋場風', '123m99m789p789s111z', '7p', {}, { yaku: ['混全帯幺九', '場風 東'], han: 3, fu: 40, total: 5200 });
check('純全帯幺九', '123m789m123p789s11s', '3p', {}, { yaku: ['純全帯幺九'], han: 3, fu: 40, total: 5200 });
check('混一色', '123m345m777m111z99m', '9m', {}, { yaku: ['混一色', '場風 東'], han: 4, fu: 50, total: 8000 });
check('清一色', '123345567789m22m', '2m', {}, { han: 6, total: 12000 });
check('対々和＋三暗刻＋中（シャンポンロン）', '111m999p555s77z22s', '7z', {}, { yaku: ['対々和', '三暗刻', '役牌 中'], han: 5, total: 8000 });
check('三暗刻ツモ', '111m234m555p777s99p', '4m', { method: 'tsumo' }, { yaku: ['三暗刻', '門前清自摸和'], han: 3, fu: 40, pay: [1300, 2600] });
check('小三元＋混全帯（跳満）', '555z666z77z123m789s', '9s', {}, { yaku: ['役牌 白', '役牌 發', '小三元', '混全帯幺九'], han: 6, total: 12000 });
check('小三元のみ（断么九なし）', '555z666z77z234m567p', '7p', {}, { yaku: ['役牌 白', '役牌 發', '小三元'], han: 4, fu: 50, total: 8000 });
check('混老頭＋対々和＋三暗刻', '111m999p111z99s55z', '5z', {}, { yaku: ['対々和', '三暗刻', '混老頭', '役牌 白', '場風 東'], han: 8, total: 16000 });
check('自風・場風（ダブ東の親）', '111z234m567m345p88s', '8s', { seat: 0 }, { yaku: ['場風 東', '自風 東'], han: 2, fu: 40, total: 3900 });
// ---- 状況役 ----
const NOYAKU = '234m567m345p68s99m'; // 7s 嵌張待ち。役なし形
check('役なし（ロン不可）', NOYAKU + '7s', '7s', {}, { valid: false });
check('役なし＋ドラでも不可', NOYAKU + '7s', '7s', { doraIndicators: [T('8m')] }, { valid: false, gain: 0 });
check('ツモ＋海底', NOYAKU + '7s', '7s', { method: 'tsumo', haitei: true }, { yaku: ['門前清自摸和', '海底摸月'], han: 2, fu: 30, pay: [500, 1000] });
check('河底', NOYAKU + '7s', '7s', { houtei: true }, { yaku: ['河底撈魚'], han: 1, fu: 40, total: 1300 });
check('立直一発裏ドラ2', NOYAKU + '7s', '7s', { riichi: true, ippatsu: true, uraIndicators: [T('8m')] }, { yaku: ['立直', '一発'], han: 4, fu: 40, total: 8000 });
check('裏ドラは立直時のみ', NOYAKU + '7s', '7s', { houtei: true, uraIndicators: [T('8m')] }, { han: 1 });
check('ドラ1（表示牌1萬→2萬）', '234m567m345p678s55p', '8s', { riichi: true, doraIndicators: [T('1m')] }, { han: 4, total: 7700 });
check('ドラ表示牌 9→1・北→東・中→白', '111z555z234m567p88s', '8s', { doraIndicators: [T('4z'), T('7z')] }, { han: 2 + 3 + 3 });
check('本場・供託', '234m567m345p678s55p', '8s', { riichi: true, honba: 2, kyotaku: 1 }, { total: 3900, gain: 3900 + 600 + 1000 });
check('親ロン満貫', '123m345m777m111z99m', '9m', { seat: 0 }, { total: 12000 });
// ---- 役満 ----
check('四暗刻ツモ', '111m999p555s77z22s', '7z', { method: 'tsumo' }, { yaku: ['四暗刻'], total: 32000, pay: [8000, 16000] });
check('四暗刻単騎ロン', '111m999p555s777z2s', '2s', {}, { yaku: ['四暗刻単騎'], total: 32000 });
check('大三元', '555z666z777z123m99p', '3m', {}, { yaku: ['大三元'], total: 32000 });
check('国士無双', '19m19p19s1234567z1m', '1m', {}, { yaku: ['国士無双'], total: 32000 });
check('国士無双（親）', '19m19p19s1234567z1m', '7z', { seat: 0 }, { total: 48000 });
check('字一色（シャンポン）', '111z222z333z55z66z', '5z', {}, { yaku: ['字一色'], total: 32000 });
check('字一色（七対子形）', '11223344556677z', '7z', {}, { yaku: ['字一色'], total: 32000 });
check('緑一色', '234s234s666s888s66z', '8s', {}, { yaku: ['緑一色'], total: 32000 });
check('清老頭', '111m999m111p99p99s', '9p', {}, { yaku: ['清老頭'], total: 32000 });
check('九蓮宝燈', '1112345678999m5m', '5m', {}, { yaku: ['九蓮宝燈'], total: 32000 });
check('小四喜', '111z222z333z44z123m', '3m', {}, { yaku: ['小四喜'], total: 32000 });
check('大四喜＋四暗刻単騎＝ダブル役満', '111z222z333z444z5m5m', '5m', {}, { yaku: ['四暗刻単騎', '大四喜'], total: 64000 });
check('天和（親）', '234567m789p55s234s', '4s', { method: 'tsumo', seat: 0, tenhou: true }, { yaku: ['天和'], pay: [16000, 16000], total: 48000 });
check('地和（子）', '234567m789p55s234s', '4s', { method: 'tsumo', chiihou: true }, { yaku: ['地和'], total: 32000 });
check('数え役満（清一色＋立直＋ドラ…13翻）', '123345567789m22m', '2m', { riichi: true, method: 'tsumo', doraIndicators: [T('1m'), T('1m')] }, { total: 32000 });
eq('非和了形は null', ev('123m456m789m123p4s5s', '5s'), null);

// ---- 向聴数 ----
const S = (s) => Y.shanten(Y.toCounts(H(s)));
eq('和了形 -1', S('234567m789p55s234s'), -1);
eq('聴牌 0', S('123456789m123p5s'), 0);
eq('一向聴', S('123456789m13p58s'), 1);
eq('七対子一向聴', S('1199m3377p225s13z'), 1);
eq('国士聴牌', S('19m19p19s1234567z'), 0);
eq('バラバラ', S('147m147p147s1234z'), 6);
eq('待ち 14s', Y.waits(H('234567m789p55s23s')), [T('1s'), T('4s')]);
eq('九蓮の9面待ち', Y.waits(H('1112345678999m')).length, 9);
const vis = Y.toCounts(H('234567m789p55s23s9z'.replace('9z', '1z')));
const opts = Y.discardOptions(H('234567m789p55s23s1z'), vis);
eq('最善打牌は東（聴牌維持・受け入れ8枚）', [E.code(opts[0].tile), opts[0].shanten, opts[0].ukeire], ['1z', 0, 8]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
