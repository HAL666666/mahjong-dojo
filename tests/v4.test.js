// 実行: node tests/v4.test.js — v4（鳴き・カン・半荘・途中流局・赤ドラ・ウマオカ）の試験
const E = require('../js/engine.js');
const Y = require('../js/yaku.js');
const G = require('../js/game-core.js');
const C = require('../js/cpu.js');
let pass = 0, fail = 0;
function ok(label, cond, info) { if (cond) pass++; else { fail++; console.log('✗ ' + label + (info !== undefined ? ' — ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); } }
function H(s) { const out = []; let buf = []; for (const ch of s.replace(/\s/g, '')) { if (/\d/.test(ch)) buf.push(ch); else { buf.forEach(d => out.push(E.parse(d + ch))); buf = []; } } return out; }
const T = (s) => E.parse(s);
const names = (r) => r.yaku.filter(y => !y.dora).map(y => y.name).sort();
const hanOf = (r, n) => (r.yaku.find(y => y.name === n) || {}).han;
function evo(closed, melds, win, o = {}) {
  const ctx = Object.assign({ winTile: T(win), method: 'ron', seat: 1, round: 0, dealer: false, doraIndicators: [], uraIndicators: [] }, o);
  if (ctx.seat === 0) ctx.dealer = true;
  const c = H(closed); c.push(T(win));
  return Y.evaluate({ closed: c, melds: melds.map(([type, t]) => ({ type, tiles: H(t) })) }, ctx);
}

// ===== 1. 副露手の役と符 =====
let r;
r = evo('234m567p88s 78s', [['chi', '345p']], '6s');
ok('食断（喰いタン）', r && r.valid && names(r).join() === '断幺九' && r.han === 1, r && names(r));
ok('副露の平和形ロンは30符', r.fu === 30 && r.calc.total === 1000, r && [r.fu, r.calc.total]);
r = evo('234m567p88s 78s', [['chi', '345p']], '6s', { method: 'tsumo' });
ok('副露の平和形ツモも30符（ツモ符2→切り上げ）', r.fu === 30 && !names(r).includes('門前清自摸和') && r.calc.childPay === 300 && r.calc.dealerPay === 500, r && [r.fu, r.calc]);
r = evo('123m 456m 11z 22z', [['chi', '789m']], '2z');
ok('混一色 副露は2翻', hanOf(r, '混一色') === 2, r && r.yaku);
ok('一気通貫 副露は1翻', hanOf(r, '一気通貫') === 1, r && r.yaku);
r = evo('123456m 999m 1m', [['chi', '789m']], '1m'); // 鳴いた清一色
ok('清一色 副露は5翻', r && hanOf(r, '清一色') === 5 && !names(r).includes('九蓮宝燈'), r && r.yaku);
r = evo('123m 123p 789m 9s', [['chi', '123s']], '9s');
ok('三色同順 副露は1翻・純全帯 副露は2翻', hanOf(r, '三色同順') === 1 && hanOf(r, '純全帯幺九') === 2, r && r.yaku);
r = evo('123m 789p 11z 9s9s', [['chi', '789s']], '1z');
ok('混全帯幺九 副露は1翻', hanOf(r, '混全帯幺九') === 1, r && r.yaku);
r = evo('234m 567p 8s', [['pon', '777z'], ['chi', '345s']], '8s');
ok('役牌 中（ポン）', r && r.valid && names(r).join() === '役牌 中', r && names(r));
ok('役牌ポン 明刻4符（中）＋単騎2符', r.opt.parts.some(p => p.fu === 4) && r.fu === 30, r && r.opt.parts);
r = evo('234m 567p 8s', [['chi', '789s'], ['chi', '345s']], '8s');
ok('役なしの副露手は不成立', r && r.valid === false, r && r.yaku);
r = evo('22m 33p 4s', [['pon', '555m'], ['pon', '999p'], ['pon', '111z']], '4s'); // 未完成
ok('未完成は null', r === null);
r = evo('4s', [['pon', '555m'], ['pon', '999p'], ['pon', '111z'], ['pon', '333p']], '4s');
ok('対々和（全てポン）', r && names(r).includes('対々和'), r && names(r));
r = evo('222m 444p 666s 8s', [['ankan', '1111z']], '8s', { seat: 2 });
ok('暗槓を含む四暗刻単騎', r && r.yakuman === 1 && names(r).join() === '四暗刻単騎', r && names(r));
r = evo('222m 444p 678s 8s', [['ankan', '1111z']], '8s', { seat: 2 });
ok('暗槓を含む三暗刻（場風東の暗槓は32符）', r && names(r).includes('三暗刻') && names(r).includes('場風 東') && r.opt.parts.some(p => p.fu === 32), r && [names(r), r.opt.parts]);
r = evo('345m 8s', [['ankan', '1111z'], ['minkan', '2222p'], ['kakan', '9999s']], '8s', { seat: 2 });
ok('三槓子 2翻', r && hanOf(r, '三槓子') === 2, r && r.yaku);
ok('明槓（中張）8符・加槓（幺九）16符', r.opt.parts.some(p => p.fu === 8) && r.opt.parts.some(p => p.fu === 16), r && r.opt.parts);
r = evo('8s', [['ankan', '1111z'], ['minkan', '2222p'], ['kakan', '9999s'], ['minkan', '4444m']], '8s');
ok('四槓子は役満', r && r.yakuman >= 1 && names(r).includes('四槓子'), r && names(r));
r = evo('55m 88s', [['pon', '555z'], ['pon', '666z'], ['pon', '777z']], '8s');
ok('副露の大三元', r && names(r).includes('大三元'));
r = evo('8s', [['pon', '111z'], ['pon', '222z'], ['pon', '333z'], ['pon', '444z']], '8s');
ok('大四喜', r && names(r).includes('大四喜'));
r = evo('234m 567p 678s 8s', [['chi', '345s']], '8s', { red: 2 });
ok('赤ドラ2は2翻のドラ（役ではない）', r && r.valid && hanOf(r, '赤ドラ') === 2 && r.han === 3, r && r.yaku);
r = evo('234m 567p 789s 8s', [['chi', '678s']], '8s', { red: 1 });
ok('赤ドラだけでは和了不可', r && !r.valid);
r = evo('123m 456p 78s 99s', [['ankan', '1111z']], '9s', { method: 'tsumo', rinshan: true, seat: 1 });
ok('嶺上開花', r && names(r).includes('嶺上開花') && names(r).includes('門前清自摸和'), r && names(r));
r = evo('123m 456p 789s 2p', [['pon', '555z']], '2p', { chankan: true });
ok('槍槓', r && names(r).includes('槍槓'), r && names(r));
r = evo('123m 456p 789s 2p', [['pon', '555z']], '2p', { riichi: true });
ok('副露手に立直は付かない', r && !names(r).includes('立直'));
r = evo('123m 456p 789s 2p', [['ankan', '9999m']], '2p', { riichi: true, uraIndicators: [T('8m')] });
ok('暗槓は門前扱い：立直・裏ドラ4（槓子）', r && names(r).includes('立直') && r.ura === 4, r && r.yaku);
r = evo('123m 456p 789s 2p', [['ankan', '9999m']], '2p', { doraIndicators: [T('8m'), T('1p')] });
ok('カンドラ：表示牌2枚でドラ6（9m×4＋2p×2）', r && r.dora === 6, r && r.dora);
ok('副露時は七対子を見ない', Y.shanten(Y.toCounts(H('1122m3344p55s6')), 1) > 0);

// ===== 2. 対局：鳴き =====
const FILL = '147m258p369s1234z'; // 面子・塔子・対子を作らない13枚
function ids(str, used) { return H(str).map(t => { for (let c = 0; c < 3; c++) { const id = t + 34 * c; if (!used.has(id)) { used.add(id); return id; } } const id = t + 102; used.add(id); return id; }); }
function table(spec, rules) {
  const s = G.newGame(Object.assign({ calls: true, aka: 0 }, rules || {}));
  const d = s.turn, used = new Set(), P = [d, (d + 1) % 4, (d + 2) % 4, (d + 3) % 4];
  for (let k = 0; k < 4; k++) s.hands[P[k]] = ids(spec[k] || FILL, used);
  s.discards = [[], [], [], []]; s.melds = [[], [], [], []];
  s.live = ids('8m8m8m6p6p6p', used).concat(s.live.filter(id => !used.has(id) && ![7, 15, 33].includes(id % 34)).slice(0, 40));
  s.drawn = s.hands[d][s.hands[d].length - 1]; s.firstDraw = [false, false, false, false]; s.anyDiscard = true;
  return { s, d, P, used };
}
// チーは上家からのみ・喰い替え禁止
let t = table(['147m258p369s123z 3m', '3456m 1p4p7p2s5s8s1z2z5z', '1p4p7p 2s5s8s 1z 4z 3z 6z 4m5m 7m', '1p4p7p 2s5s8s 1z 4z 3z 6z 4m5m 7m']);
G.act(t.s, t.d, { type: 'discard', tile: T('3m') });
ok('下家にチーの機会', t.s.phase === 'call' && t.s.pending.waiting === t.P[1], [t.s.phase, t.s.pending && t.s.pending.waiting]);
ok('チーの組み合わせは[4m5m]のみ', JSON.stringify(t.s.pending.callOpts[t.P[1]].chi.map(c => c.map(x => x % 34))) === '[[3,4]]', t.s.pending.callOpts[t.P[1]].chi);
ok('対面・上家は 4m5m を持っていてもチー不可', t.s.pending.callOpts[t.P[2]].chi.length === 0 && t.s.pending.callOpts[t.P[3]].chi.length === 0);
G.act(t.s, t.P[1], { type: 'chi', tiles: t.s.pending.callOpts[t.P[1]].chi[0] });
ok('チー後は鳴いた人の手番（ツモなし）', t.s.phase === 'turn' && t.s.turn === t.P[1] && t.s.drawn === null && t.s.hands[t.P[1]].length === 11);
ok('チーした牌は河で「鳴かれ」表示', t.s.discards[t.d][0].called === true);
ok('現物喰い替え禁止（3m）', !G.act(t.s, t.P[1], { type: 'discard', tile: T('3m') }));
ok('スジ喰い替え禁止（6m）', !G.act(t.s, t.P[1], { type: 'discard', tile: T('6m') }));
ok('他の牌は打てる', G.act(t.s, t.P[1], { type: 'discard', tile: T('1p') }));
ok('嵌張チーはスジ喰い替えなし', JSON.stringify(G.kuikaeBan(T('5m'), T('4m'), T('6m'))) === JSON.stringify([T('5m')]));
ok('端の牌では反対側の禁止なし（7m で[89m]）', JSON.stringify(G.kuikaeBan(T('7m'), T('8m'), T('9m'))) === JSON.stringify([T('7m')]));

// 優先順位：ロン ＞ ポン ＞ チー
t = table(['147m258p369s123z 5p', '4p6p 1m7m 3s6s9s 1z2z3z4z 8m 2m', '5p5p 1m4m7m 3s6s9s 1z2z3z 4z', '234m 567m 11s 789s 46p']);
t.s.riichi[t.P[3]] = true;
G.act(t.s, t.d, { type: 'discard', tile: T('5p') });
ok('最初はロンの確認（上家）', t.s.phase === 'ron' && t.s.pending.waiting === t.P[3], [t.s.phase, t.s.pending && t.s.pending.waiting]);
G.act(t.s, t.P[3], { type: 'skip' });
ok('ロン見送り後はポン（対面）が先', t.s.phase === 'call' && t.s.pending.waiting === t.P[2], [t.s.phase, t.s.pending && t.s.pending.waiting]);
G.act(t.s, t.P[2], { type: 'skip' });
ok('ポン見送り後にチー（下家）', t.s.phase === 'call' && t.s.pending.waiting === t.P[1]);
G.act(t.s, t.P[1], { type: 'skip' });
ok('全員見送りで次のツモ', t.s.phase === 'turn' && t.s.turn === t.P[1] && t.s.hands[t.P[1]].length === 14);
ok('ロン見送りで立直フリテン', t.s.furitenRiichi[t.P[3]]);
// ポン：同じ牌は打てない
t = table(['147m258p369s123z 5p', '', '5p5p 1m4m7m 3s6s9s 1z2z3z 5z 5p', '']);
G.act(t.s, t.d, { type: 'discard', tile: T('5p') });
ok('3枚持ちならポンと明槓の両方', t.s.pending.callOpts[t.P[2]].pon && t.s.pending.callOpts[t.P[2]].minkan);
G.act(t.s, t.P[2], { type: 'pon' });
ok('ポン：副露1・手牌11', t.s.melds[t.P[2]].length === 1 && t.s.hands[t.P[2]].length === 11 && t.s.melds[t.P[2]][0].from === t.d);
ok('ポンした牌（5p）の喰い替え禁止', !G.act(t.s, t.P[2], { type: 'discard', tile: T('5p') }));
ok('ポン後に別の牌は打てる', G.act(t.s, t.P[2], { type: 'discard', tile: T('1m') }));
ok('ポン後は次の人（ポンした人の下家）のツモ', t.s.turn === t.P[3]);
// 立直中は鳴けない
t = table(['147m258p369s123z 5p', '', '5p5p 1m4m7m 3s6s9s 1z2z3z 4z 5z', '']);
t.s.riichi[t.P[2]] = true;
G.act(t.s, t.d, { type: 'discard', tile: T('5p') });
ok('立直中はポンできない', t.s.phase === 'turn');

// ===== 3. カン・嶺上・カンドラ・槍槓 =====
t = table(['1111z 147m258p369s 2z', '', '', '']);
let L0 = t.s.live.length, rin = t.s.rinshanPile[0];
ok('暗槓の候補', G.legal(t.s, t.d).ankan.includes(27));
G.act(t.s, t.d, { type: 'ankan', tile: 27 });
ok('暗槓：嶺上牌をツモ', t.s.hands[t.d].includes(rin) && t.s.drawn === rin && t.s.rinshanFlag);
ok('暗槓：カンドラ表示牌が増える（即乗り）', t.s.doraIndicators.length === 2 && t.s.uraIndicators.length === 2);
ok('暗槓：王牌補充で山が1枚減る', t.s.live.length === L0 - 1 && t.s.deadExtra.length === 1);
ok('暗槓の副露表示データ', t.s.melds[t.d][0].type === 'ankan' && t.s.melds[t.d][0].ids.length === 4);
// 嶺上開花
t = table(['1111z 123m456p789s 5s', '', '', '']);
t.s.rinshanPile[0] = T('5s') + 34;
G.act(t.s, t.d, { type: 'ankan', tile: 27 });
ok('嶺上開花でツモ和了可能', G.legal(t.s, t.d).tsumo);
G.act(t.s, t.d, { type: 'tsumo' });
ok('嶺上開花が付く', t.s.result && t.s.result.yaku.some(y => y.name === '嶺上開花'), t.s.result && t.s.result.yaku);
// 加槓と槍槓
t = table(['147m258p369s123z 9m', '3s 1m4m7m 2p5p8p 1z2z3z4z 6m 9s', '', '1s2s 456m 789p 234m 99p']);
t.s.melds[t.P[1]] = [{ type: 'pon', ids: [T('3s'), T('3s') + 34, T('3s') + 68], from: t.d, called: T('3s') }];
t.s.hands[t.P[1]] = [T('3s') + 102].concat(ids('1m4m7m 2p5p8p 1z2z3z 4z', new Set()).slice(0, 10)).concat([T('6m')]);
t.s.turn = t.P[1]; t.s.drawn = T('6m'); t.s.riichi[t.P[3]] = true;
ok('加槓の候補', G.legal(t.s, t.P[1]).kakan.includes(T('3s')), G.legal(t.s, t.P[1]));
G.act(t.s, t.P[1], { type: 'kakan', tile: T('3s') });
ok('加槓で槍槓の確認', t.s.phase === 'ron' && t.s.pending.waiting === t.P[3] && t.s.pending.kind === 'kakan');
G.act(t.s, t.P[3], { type: 'ron' });
ok('槍槓で和了', t.s.result && t.s.result.yaku.some(y => y.name === '槍槓') && t.s.result.from === t.P[1], t.s.result && t.s.result.yaku);
// 槍槓なしなら加槓成立
t = table(['147m258p369s123z 9m', '', '', '']);
t.s.melds[t.P[1]] = [{ type: 'pon', ids: [T('3s'), T('3s') + 34, T('3s') + 68], from: t.d, called: T('3s') }];
t.s.hands[t.P[1]] = [T('3s') + 102].concat(ids('1m4m7m 2p5p8p 1z2z3z 4z', new Set()).slice(0, 10)).concat([T('6m')]);
t.s.turn = t.P[1]; t.s.drawn = T('6m');
G.act(t.s, t.P[1], { type: 'kakan', tile: T('3s') });
ok('加槓成立 → 嶺上ツモ・カンドラ', t.s.melds[t.P[1]][0].type === 'kakan' && t.s.melds[t.P[1]][0].ids.length === 4 && t.s.doraIndicators.length === 2 && t.s.phase === 'turn');
// 四槓散了・5回目のカン禁止
t = table(['1111z 147m258p369s 2z', '', '', '']);
t.s.kanOwners = [t.P[1], t.P[2], t.P[3]];
G.act(t.s, t.d, { type: 'ankan', tile: 27 });
ok('4つ目のカン（別の人）→ 打牌後に四槓散了', t.s.abortAfterDiscard === '四槓散了');
G.act(t.s, t.d, { type: 'discard', tile: t.s.hands[t.d].find(x => x % 34 === T('7m')) });
ok('四槓散了で流局', t.s.result && t.s.result.type === 'abort' && t.s.result.reason === '四槓散了', t.s.result);
t = table(['1111z 147m258p369s 2z', '', '', '']);
t.s.kanOwners = [t.d, t.d, t.d, t.d];
ok('5回目のカンはできない', G.legal(t.s, t.d).ankan.length === 0);

// ===== 4. 包（パオ）=====
t = table(['147m258p369s123z 7z', '', '7z7z 12m 9p9p 5m', '']);
t.s.melds[t.P[2]] = [{ type: 'pon', ids: ids('555z', t.used), from: t.P[1], called: 0 }, { type: 'pon', ids: ids('666z', t.used), from: t.P[3], called: 0 }];
G.act(t.s, t.d, { type: 'discard', tile: T('7z') });
G.act(t.s, t.P[2], { type: 'pon' });
ok('大三元の3つ目を鳴かせた人が包', t.s.pao[t.P[2]] && t.s.pao[t.P[2]].liable === t.d);
G.act(t.s, t.P[2], { type: 'discard', tile: T('5m') });
t.s.phase = 'turn'; t.s.turn = t.P[2]; const w4 = T('3m') + 34; t.s.hands[t.P[2]].push(w4); t.s.drawn = w4; t.s.pending = null;
G.act(t.s, t.P[2], { type: 'tsumo' });
ok('包のツモ：責任者が全額（32000）', t.s.result && t.s.result.deltas[t.d] === -32000 && t.s.result.deltas[t.P[2]] === 32000 && t.s.result.deltas[t.P[1]] === 0, t.s.result && t.s.result.deltas);
// 包のロン（別の人から）：折半
t = table(['147m258p369s123z 7z', '', '7z7z 12m 9p9p 5m', '1m 4m 7m 2p5p8p 3s6s9s 1z2z 3z 3m']);
t.s.melds[t.P[2]] = [{ type: 'pon', ids: ids('555z', t.used), from: t.P[1], called: 0 }, { type: 'pon', ids: ids('666z', t.used), from: t.P[3], called: 0 }];
G.act(t.s, t.d, { type: 'discard', tile: T('7z') });
G.act(t.s, t.P[2], { type: 'pon' });
G.act(t.s, t.P[2], { type: 'discard', tile: T('5m') });
// 対面が待つ 3m を上家が打つ
t.s.phase = 'turn'; t.s.turn = t.P[3]; t.s.drawn = t.s.hands[t.P[3]][t.s.hands[t.P[3]].length - 1]; t.s.pending = null;
G.act(t.s, t.P[3], { type: 'discard', tile: T('3m') });
ok('包者以外からのロン確認', t.s.phase === 'ron' && t.s.pending.waiting === t.P[2], t.s.phase);
G.act(t.s, t.P[2], { type: 'ron' });
ok('包のロン：放銃者と責任者で折半', t.s.result && t.s.result.deltas[t.P[3]] === -16000 && t.s.result.deltas[t.d] === -16000, t.s.result && t.s.result.deltas);

// ===== 5. ダブロン・頭ハネ =====
function dblron(doubleRon) {
  const t = table(['147m258p369s123z 3s', '1s2s 456m 789p 234m 99p', '4s5s 456m 789p 234m 99p', ''], { doubleRon });
  t.s.riichi[t.P[1]] = true; t.s.riichi[t.P[2]] = true; t.s.honba = 2; t.s.kyotaku = 1;
  t.s.scores = [25000, 25000, 25000, 24000];
  G.act(t.s, t.d, { type: 'discard', tile: T('3s') });
  G.act(t.s, t.P[1], { type: 'ron' });
  if (t.s.phase === 'ron') G.act(t.s, t.P[2], { type: 'ron' });
  return t;
}
t = dblron(true);
ok('ダブロン：2人とも和了', t.s.result && t.s.result.wins.length === 2, t.s.result && t.s.result.wins.length);
ok('ダブロン：本場と供託は放銃者に近い下家だけ', t.s.result.wins[0].winner === t.P[1] && t.s.result.wins[0].honba === 2 && t.s.result.wins[1].honba === 0 && t.s.result.wins[0].kyotaku === 1);
ok('ダブロン：点数合計は保存', t.s.scores.reduce((a, b) => a + b, 0) + t.s.kyotaku * 1000 === 100000, t.s.scores);
ok('ダブロン：放銃者は2人分を支払う', t.s.result.deltas[t.d] === -(t.s.result.wins[0].calc.total + 600 + t.s.result.wins[1].calc.total));
t = dblron(false);
ok('頭ハネ：上家取りで1人だけ', t.s.result && t.s.result.wins.length === 1 && t.s.result.winner === t.P[1]);

// ===== 6. 途中流局 =====
t = table(['19m19p19s1234z 2m3m 4m', '', '', '']);
t.s.firstDraw = [true, true, true, true]; t.s.anyDiscard = false;
ok('九種九牌の宣言が可能', G.legal(t.s, t.d).kyuushu);
let hb = t.s.honba, dl = G.dealerOf(t.s);
G.act(t.s, t.d, { type: 'kyuushu' });
ok('九種九牌で流局・親流れなし・本場+1', t.s.result.type === 'abort' && t.s.result.reason === '九種九牌' && t.s.honba === hb + 1);
G.act(t.s, 0, { type: 'next' });
ok('九種九牌の次局も同じ親', G.dealerOf(t.s) === dl);
t = table(['147m258p369s1234z 5z', '', '', '']);
t.s.firstDraw = [true, true, true, true]; t.s.anyDiscard = false;
for (let k = 0; k < 4; k++) { const p = t.P[k]; if (t.s.phase !== 'turn' || t.s.turn !== p) break; G.act(t.s, p, { type: 'discard', tile: 27 }); }
ok('四風連打', t.s.result && t.s.result.reason === '四風連打', t.s.result || t.s.phase);
t = table(['234m 567m 789p 55s 23s 1z', '', '', '']);
t.s.riichi = [true, true, true, true]; t.s.riichi[t.d] = false;
let ky = t.s.kyotaku;
G.act(t.s, t.d, { type: 'discard', tile: 27, riichi: true });
ok('四家立直で流局（供託は残る）', t.s.result && t.s.result.reason === '四家立直' && t.s.kyotaku === ky + 1, t.s.result || t.s.phase);
t = table(['147m258p369s123z 5z', '1s2s 456m 789p 234m 99p', '1s2s 456m 789p 234m 99p', '1s2s 456m 789p 234m 99p']);
['1s2s 456m 789p 234m 99p', '1s2s 456m 789p 234m 99p', '1s2s 456m 789p 234m 99p'].forEach((h, i) => { t.s.hands[t.P[i + 1]] = H(h).map((x, j) => x); t.s.riichi[t.P[i + 1]] = true; });
G.act(t.s, t.d, { type: 'discard', tile: T('7m') }); // 3s ではない
ok('（三家和は 3s でのみ）', t.s.phase === 'turn');

// ===== 7. 半荘・オーラス・トビ・西入 =====
function allLast(rules) {
  const s = G.newGame(Object.assign({ aka: 0 }, rules || {}));
  s.round = 1; s.kyoku = 3; s.handNo = 7; G.startHand(s);
  return s;
}
function forceTsumo(s, p, hand) { s.hands[p] = H(hand); s.turn = p; s.phase = 'turn'; s.drawn = s.hands[p][13]; s.firstDraw = [false, false, false, false]; s.anyDiscard = true; return G.act(s, p, { type: 'tsumo' }); }
let s = allLast(); let d = G.dealerOf(s);
s.scores = [20000, 20000, 20000, 20000]; s.scores[d] = 40000;
forceTsumo(s, d, '234m 567m 789p 55s 234s');
ok('オーラス：親がトップで和了 → 和了やめ', s.endReason === 'オーラス親の和了やめ', s.endReason);
G.act(s, 0, { type: 'next' });
ok('和了やめで対局終了', s.phase === 'gameEnd' && s.final && s.final.points.length === 4);
s = allLast(); d = G.dealerOf(s); s.scores = [30000, 30000, 30000, 30000]; s.scores[d] = 10000;
forceTsumo(s, d, '234m 567m 789p 55s 234s');
ok('親がトップでなければ連荘', !s.endReason && s.kyoku === 3 && s.honba === 1);
s = allLast({ agariYame: false }); d = G.dealerOf(s); s.scores = [20000, 20000, 20000, 20000]; s.scores[d] = 40000;
forceTsumo(s, d, '234m 567m 789p 55s 234s');
ok('和了やめ設定オフなら続行', !s.endReason);
s = allLast(); d = G.dealerOf(s);
forceTsumo(s, (d + 1) % 4, '234m 567m 789p 55s 234s');
ok('オーラス子の和了で終了（西入なし）', s.endReason === '規定局数終了');
s = allLast({ westIn: true }); d = G.dealerOf(s);
forceTsumo(s, (d + 1) % 4, '234m 567m 789p 55s 234s');
ok('西入あり：30000点未満なら西場へ', !s.endReason && s.round === 2, [s.endReason, s.round, s.scores]);
s = G.newGame({ mode: 'tonpuu', aka: 0 }); s.kyoku = 3; G.startHand(s); d = G.dealerOf(s);
forceTsumo(s, (d + 1) % 4, '234m 567m 789p 55s 234s');
ok('東風戦は東4局で終了', s.endReason === '規定局数終了');
s = G.newGame({ aka: 0 }); d = G.dealerOf(s); s.kyoku = 0;
forceTsumo(s, (d + 1) % 4, '234m 567m 789p 55s 234s');
ok('半荘の東1局 子和了 → 東2局へ', !s.endReason && s.kyoku === 1 && s.round === 0);
// トビ
t = table(['234m 567m 789p 55s 23s 1z', '', '', '']);
t.s.live = []; t.s.scores = [33500, 33500, 33000, 33000]; t.s.scores[t.P[1]] = 500; t.s.scores[t.d] = 32500;
G.act(t.s, t.d, { type: 'discard', tile: 27 });
ok('荒牌流局でノーテン罰符', t.s.result && t.s.result.type === 'draw' && t.s.result.deltas[t.d] === 3000);
ok('マイナスでトビ終了', t.s.endReason === 'トビ終了');
// ウマ・オカ
s = G.newGame({ uma: '10-20' }); s.scores = [40000, 30000, 20000, 10000];
let f = G.finalPoints(s);
ok('ウマ10-20・30000返し：+50 / +10 / -20 / -40', JSON.stringify(f.points) === '[50,10,-20,-40]', f.points);
ok('ウマオカ合計0', Math.abs(f.points.reduce((a, b) => a + b, 0)) < 1e-9);
s.rules.uma = '5-10'; s.scores = [35000, 35000, 20000, 10000]; s.oya0 = 1;
f = G.finalPoints(s);
ok('同点は起家に近い方が上位', f.points[1] > f.points[0], f.points);

// ===== 8. 赤ドラ =====
s = G.newGame({ aka: 3 });
ok('赤五は3枚（5m/5p/5s）', [0, 1, 2, 3].map(() => 0).length === 4 && [106, 115, 124].every(id => G.isRed(s, id)) && !G.isRed(s, 4) && !G.isRed(s, 38));
s = G.newGame({ aka: 0 });
ok('赤なし設定では赤扱いしない', !G.isRed(s, 106));
s = G.newGame({ aka: 3 }); d = G.dealerOf(s);
s.hands[(d + 1) % 4] = H('234m 67m 789p 55s 23s').concat([106, T('4s')]);
s.turn = (d + 1) % 4; s.phase = 'turn'; s.drawn = T('4s'); s.firstDraw = [false, false, false, false]; s.anyDiscard = true; s.doraIndicators = [T('1z')]; s.uraIndicators = [T('1z')];
G.act(s, s.turn, { type: 'tsumo' });
ok('赤5萬で 赤ドラ1', s.result && s.result.yaku.some(y => y.name === '赤ドラ' && y.han === 1), s.result && s.result.yaku);

// ===== 9. 保存データの移行 =====
ok('旧版（version 1）の対局は再開しない', G.canResume({ version: 1, phase: 'turn' }) === false);
ok('現行版は再開できる', G.canResume(G.newGame({})));
ok('壊れたデータでも例外なし', G.canResume(null) === false && G.canResume({}) === false);

// ===== 10. 危険度・鳴きの助言 =====
s = G.newGame({ aka: 0 });
let v = G.publicView(s, 0);
v.riichi = [false, true, false, false]; v.riichiSeq = [-1, 5, -1, -1];
v.discards = [[], [{ t: T('4m'), seq: 1 }, { t: T('2z'), seq: 5 }], [{ t: T('9s'), seq: 7 }], []];
v.hand = H('1m 4m 7m 5m 2p 9s 2z 3z 3z 5z 6z 7z 1p 1s'); v.melds = [[], [], [], []]; v.doraIndicators = [T('9p')];
const dg = (x) => C.danger(v, T(x), 'hard');
ok('現物は安全', dg('4m').level === '安全' && dg('4m').why === '現物');
ok('立直後の他家の捨て牌も安全', dg('9s').level === '安全');
ok('スジの1m・7mは比較的安全', dg('1m').d <= 2 && dg('7m').d <= 6, [dg('1m'), dg('7m')]);
ok('無スジの5mは危険', dg('5m').level === '危険');
ok('ドラ（1p）は危険度が上がる', dg('1p').d > dg('1s').d, [dg('1p'), dg('1s')]);
ok('立直がなければ危険度なし', C.danger(Object.assign({}, v, { riichi: [false, false, false, false] }), T('5m'), 'hard').level === null);
v = G.publicView(s, 0); v.hand = H('5z5z 23m 67p 1s 4s 7s 9m 2z 3z 4z'); v.pendingTile = T('5z'); v.melds = [[], [], [], []];
let adv = C.callAdvice(v, 'pon');
ok('役牌ポンは役が残る', adv.plans.includes('役牌') && adv.ok, adv);
v.hand = H('23m 67p 1s 4s 7s 9m 1z 2z 3z 4z 5z'); v.pendingTile = T('4m');
adv = C.callAdvice(v, 'chi', [T('2m'), T('3m')]);
ok('役のないチーは悪い鳴き', !adv.ok && /役がなくなる/.test(adv.reason), adv);

// ===== 11. CPU 同士の半荘（全難易度・保存則）=====
const sim = require('../tools/sim.js');
['easy', 'normal', 'hard'].forEach(lv => {
  const st = sim.newStats(); let err = null;
  try { for (let g = 0; g < 2; g++) sim.runGame([lv, lv, lv, lv], {}, st, true); } catch (e) { err = e.message; }
  ok(lv + '：半荘2回が保存則を満たして終了', !err && st.games === 2, err);
});
{
  const st = sim.newStats(); let err = null, maxRound = 0, noYaku = 0, s2;
  try {
    for (let g = 0; g < 3; g++) { s2 = sim.runGame(['hard', 'normal', 'normal', 'hard'], { aka: 3 }, st, true); maxRound = Math.max(maxRound, s2.round); }
  } catch (e) { err = e.message; }
  ok('混合卓：エラーなし', !err, err);
  ok('半荘は南場まで進む', maxRound >= 1 || Object.keys(st.ends).includes('トビ終了'), [maxRound, st.ends]);
  ok('鳴きが発生する', st.calls > 0, st.calls);
}

// ===== 12. 公開情報のみ・改名・SW =====
{
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  const s3 = G.newGame(Object.assign({}, G.DEFAULT_RULES), { levels: ['hard', 'hard', 'hard', 'hard'] });
  const v3 = G.publicView(s3, 1), keys = Object.keys(v3);
  ok('publicView に他家の手牌・牌山・裏ドラが含まれない', !['hands', 'live', 'dead', 'rinshanPile', 'doraPile', 'uraIndicators', 'wall'].some(k => keys.includes(k)), keys);
  ok('publicView の手牌は自分の手牌だけ', JSON.stringify(v3.hand) === JSON.stringify(s3.hands[1]));
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok('SW キャッシュは v5（v4＋引っ越しバックアップ）', /const CACHE = 'tensu-dojo-v5'/.test(sw));
  ok('SW が cpu.js をキャッシュする', sw.includes("'./js/cpu.js'"));
  const mf = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  ok('manifest の名前は牌の理', mf.name.startsWith('牌の理') && mf.short_name === '牌の理', mf);
  ok('manifest の start_url/scope は互換のまま', mf.start_url === './' && mf.scope === './');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok('index の title・見出しが牌の理', /<title>牌の理/.test(html) && /<h1 id="title">牌の理<\/h1>/.test(html));
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  ok('改名のお知らせは一度だけ（renameNoticeSeen）', app.includes('renameNoticeSeen') && html.includes('__dojoHadData'));
  ok('保存キーは dojo.* のまま', app.includes("'dojo.' + k"));
  const visible = ['index.html', 'manifest.json', 'js/game-ui.js', 'js/rules.js', 'js/lessons.js', 'js/questions.js'].filter(f => fs.readFileSync(path.join(root, f), 'utf8').includes('点数道場'));
  ok('旧名「点数道場」が画面に残っていない（お知らせ以外）', visible.length === 0, visible);
}

// 終局時の供託はトップへ・ウマオカ合計0
{
  const s4 = G.newGame(Object.assign({}, G.DEFAULT_RULES), { levels: ['hard', 'hard', 'hard', 'hard'] });
  s4.scores = [30000, 24000, 23000, 21000]; s4.kyotaku = 2; s4.phase = 'handEnd'; s4.endReason = '規定局数終了';
  G.act(s4, 0, { type: 'next' });
  const sum = s4.final.points.reduce((a, b) => a + b, 0);
  ok('終局時の供託2本はトップへ', s4.phase === 'gameEnd' && s4.scores[0] === 32000 && s4.kyotaku === 0 && s4.leftoverKyotaku === 2, [s4.phase, s4.scores, s4.kyotaku]);
  ok('供託が残ってもウマオカ合計は0', Math.abs(sum) < 1e-9, s4.final.points);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
