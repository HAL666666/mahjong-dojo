/* 点数道場 — 対局エンジン（東風戦・鳴きなし）。UI から独立した純粋なロジック。
 * 公平性：各局の開始時に crypto.getRandomValues による Fisher–Yates で牌山を一度だけシャッフルする。
 * 配牌・ツモの重み付けや、手牌を見た後の牌山操作は一切しない。CPU は自分の手牌と公開情報だけで判断する。 */
(function (root) {
  'use strict';
  var E = root.Engine || require('./engine.js');
  var Y = root.Yaku || require('./yaku.js');
  var NAMES = ['あなた', 'CPU 下家', 'CPU 対面', 'CPU 上家'];

  // ---- 乱数（暗号論的乱数・剰余バイアスなし） ----
  function cryptoObj() { return (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : require('crypto').webcrypto; }
  function randInt(n) { // 0..n-1 一様
    var c = cryptoObj(), buf = new Uint32Array(1), limit = Math.floor(0x100000000 / n) * n;
    do { c.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  }
  function shuffledWall() {
    var w = []; for (var i = 0; i < 136; i++) w.push(i >> 2); // 牌の種類（赤ドラなし）
    for (var j = w.length - 1; j > 0; j--) { var k = randInt(j + 1), t = w[j]; w[j] = w[k]; w[k] = t; }
    return w;
  }

  function newGame() {
    var s = { version: 1, scores: [25000, 25000, 25000, 25000], oya0: randInt(4), kyoku: 0, honba: 0, kyotaku: 0, handNo: 0, phase: 'init', log: [] };
    startHand(s);
    return s;
  }
  function dealerOf(s) { return (s.oya0 + s.kyoku) % 4; }
  function seatWind(s, p) { return (p - dealerOf(s) + 4) % 4; }

  function startHand(s) {
    var wall = shuffledWall(); // この局で一度だけ
    s.dead = wall.slice(122);   // 王牌14枚
    s.live = wall.slice(0, 122);
    s.doraIndicators = [s.dead[4]];
    s.uraIndicators = [s.dead[9]];
    s.hands = [[], [], [], []];
    var d = dealerOf(s);
    for (var r = 0; r < 3; r++) for (var i = 0; i < 4; i++) { var p = (d + i) % 4; for (var k = 0; k < 4; k++) s.hands[p].push(s.live.shift()); }
    for (var i2 = 0; i2 < 4; i2++) s.hands[(d + i2) % 4].push(s.live.shift());
    s.discards = [[], [], [], []];
    s.riichi = [false, false, false, false]; s.doubleRiichi = [false, false, false, false];
    s.ippatsu = [false, false, false, false];
    s.furitenTemp = [false, false, false, false]; s.furitenRiichi = [false, false, false, false];
    s.firstDraw = [true, true, true, true];
    s.anyDiscard = false;
    s.pending = null; s.result = null; s.handNo++;
    s.hands.forEach(sortHand);
    draw(s, d);
  }
  function sortHand(h) { h.sort(function (a, b) { return a - b; }); }

  function draw(s, p) {
    if (!s.live.length) return ryuukyoku(s);
    var t = s.live.shift();
    s.hands[p].push(t);
    s.drawn = t; s.turn = p; s.phase = 'turn';
  }

  function ctxFor(s, p, winTile, method) {
    var dealer = dealerOf(s) === p;
    return { winTile: winTile, method: method, seat: seatWind(s, p), round: 0, dealer: dealer, riichi: s.riichi[p], doubleRiichi: s.doubleRiichi[p],
      ippatsu: s.ippatsu[p], haitei: method === 'tsumo' && s.live.length === 0, houtei: method === 'ron' && s.live.length === 0,
      tenhou: method === 'tsumo' && dealer && s.firstDraw[p] && !s.anyDiscard, chiihou: method === 'tsumo' && !dealer && s.firstDraw[p],
      doraIndicators: s.doraIndicators, uraIndicators: s.uraIndicators, honba: s.honba, kyotaku: s.kyotaku };
  }

  function tsumoResult(s, p) {
    if (s.phase !== 'turn' || s.turn !== p) return null;
    if (Y.shanten(Y.toCounts(s.hands[p])) !== -1) return null;
    var r = Y.evaluate(s.hands[p], ctxFor(s, p, s.drawn, 'tsumo'));
    return r && r.valid ? r : null;
  }
  function isFuriten(s, p, waits) {
    if (s.furitenTemp[p] || s.furitenRiichi[p]) return true;
    return s.discards[p].some(function (d) { return waits.indexOf(d.t) >= 0; });
  }
  function ronResult(s, p, tile) {
    var w = Y.waits(s.hands[p]);
    if (w.indexOf(tile) < 0 || isFuriten(s, p, w)) return null;
    var r = Y.evaluate(s.hands[p].concat([tile]), ctxFor(s, p, tile, 'ron'));
    return r && r.valid ? r : null;
  }
  // 立直できる打牌（聴牌を維持する牌）
  function riichiTiles(s, p) {
    if (s.riichi[p] || s.scores[p] < 1000 || s.live.length < 4 || s.phase !== 'turn' || s.turn !== p) return [];
    var h = s.hands[p], out = [];
    for (var i = 0; i < h.length; i++) {
      if (out.indexOf(h[i]) >= 0) continue;
      var rest = h.slice(); rest.splice(i, 1);
      if (Y.shanten(Y.toCounts(rest)) === 0) out.push(h[i]);
    }
    return out;
  }
  function legal(s, p) {
    var a = { discard: [], riichi: [], tsumo: false, ron: false };
    if (s.phase === 'turn' && s.turn === p) {
      a.tsumo = !!tsumoResult(s, p);
      a.discard = s.riichi[p] ? [s.drawn] : s.hands[p].filter(function (t, i, arr) { return arr.indexOf(t) === i; });
      a.riichi = riichiTiles(s, p);
    } else if (s.phase === 'ron' && s.pending && s.pending.waiting === p) a.ron = true;
    return a;
  }

  function act(s, p, action) {
    if (action.type === 'next') { if (s.phase === 'handEnd') nextHand(s); return true; }
    if (action.type === 'tsumo') {
      var r = tsumoResult(s, p); if (!r) return false;
      settleWin(s, p, null, 'tsumo', r, s.drawn); return true;
    }
    if (action.type === 'discard') {
      if (s.phase !== 'turn' || s.turn !== p) return false;
      var t = action.tile, h = s.hands[p], idx = h.lastIndexOf(t);
      if (idx < 0) return false;
      if (s.riichi[p] && t !== s.drawn) return false;
      var declaring = !!action.riichi;
      if (declaring && riichiTiles(s, p).indexOf(t) < 0) return false;
      if (s.riichi[p]) s.ippatsu[p] = false; // 立直後の次の打牌で一発消滅
      h.splice(idx, 1); sortHand(h);
      if (declaring) { s.riichi[p] = true; s.ippatsu[p] = true; if (s.firstDraw[p] && !s.anyDiscardCalls) s.doubleRiichi[p] = s.firstDraw[p]; }
      s.discards[p].push({ t: t, riichi: declaring, tsumogiri: t === s.drawn && idx === h.length });
      s.firstDraw[p] = false; s.anyDiscard = true; s.drawn = null;
      if (!s.riichi[p] || declaring) s.furitenTemp[p] = false; // 同巡フリテンは自分の打牌で解消（立直後は除く）
      s.pending = { tile: t, from: p, riichi: declaring, order: [], waiting: null };
      for (var k = 1; k < 4; k++) {
        var q = (p + k) % 4;
        var w = Y.waits(s.hands[q]);
        if (w.indexOf(t) >= 0) {
          if (ronResult(s, q, t)) s.pending.order.push(q);
          else { s.furitenTemp[q] = true; if (s.riichi[q]) s.furitenRiichi[q] = true; } // 和了できない待ち牌もフリテン扱い
        }
      }
      advancePending(s); return true;
    }
    if (action.type === 'ron' || action.type === 'skip') {
      if (s.phase !== 'ron' || !s.pending || s.pending.waiting !== p) {
        if (action.type === 'skip' && s.phase === 'turn') return true; // ツモ見送り
        return false;
      }
      if (action.type === 'ron') { var rr = ronResult(s, p, s.pending.tile); settleWin(s, p, s.pending.from, 'ron', rr, s.pending.tile); return true; }
      s.furitenTemp[p] = true; if (s.riichi[p]) s.furitenRiichi[p] = true;
      s.pending.order.shift(); advancePending(s); return true;
    }
    return false;
  }
  function advancePending(s) {
    var pd = s.pending;
    if (pd.order.length) { s.phase = 'ron'; pd.waiting = pd.order[0]; return; }
    if (pd.riichi) { s.scores[pd.from] -= 1000; s.kyotaku++; }
    s.pending = null;
    draw(s, (pd.from + 1) % 4);
  }

  function settleWin(s, w, from, method, r, winTile) {
    var d = dealerOf(s), deltas = [0, 0, 0, 0], c = r.calc, hb = s.honba;
    if (method === 'ron') { var pay = c.total + hb * 300; deltas[from] -= pay; deltas[w] += pay; }
    else {
      for (var q = 0; q < 4; q++) {
        if (q === w) continue;
        var amt = (w === d ? c.dealerPay : (q === d ? c.dealerPay : c.childPay)) + hb * 100;
        deltas[q] -= amt; deltas[w] += amt;
      }
    }
    deltas[w] += s.kyotaku * 1000;
    for (var i = 0; i < 4; i++) s.scores[i] += deltas[i];
    var hand = s.hands[w].slice(); if (method === 'ron') hand.push(winTile);
    s.result = { type: 'win', winner: w, from: from, method: method, winTile: winTile, hand: hand, yaku: r.yaku, han: r.han, fu: r.fu, yakuman: r.yakuman,
      opt: r.opt, calc: c, deltas: deltas, honba: hb, kyotaku: s.kyotaku, dealer: w === d, ura: s.riichi[w] ? s.uraIndicators.slice() : [], scores: s.scores.slice() };
    s.kyotaku = 0;
    if (w === d) s.honba++; else { s.honba = 0; s.kyoku++; }
    s.log.push({ hand: s.handNo, type: 'win', winner: w, method: method, gain: deltas[w] });
    s.phase = 'handEnd'; s.pending = null;
  }
  function ryuukyoku(s) {
    var d = dealerOf(s), ten = [0, 1, 2, 3].map(function (p) { return Y.shanten(Y.toCounts(s.hands[p])) === 0; });
    var n = ten.filter(Boolean).length, deltas = [0, 0, 0, 0];
    if (n > 0 && n < 4) for (var p = 0; p < 4; p++) deltas[p] = ten[p] ? 3000 / n : -3000 / (4 - n);
    for (var i = 0; i < 4; i++) s.scores[i] += deltas[i];
    s.result = { type: 'draw', tenpai: ten, deltas: deltas, scores: s.scores.slice(), hands: s.hands.map(function (h) { return h.slice(); }) };
    s.honba++;
    if (!ten[d]) s.kyoku++;
    s.log.push({ hand: s.handNo, type: 'draw', tenpai: ten });
    s.phase = 'handEnd'; s.pending = null; s.drawn = null;
  }
  function nextHand(s) {
    if (s.kyoku >= 4 || s.scores.some(function (x) { return x < 0; }) || s.handNo >= 40) { s.phase = 'gameEnd'; s.ranking = ranking(s); return; }
    startHand(s);
  }
  function ranking(s) {
    // 同点は起家に近い順
    return [0, 1, 2, 3].sort(function (a, b) { return s.scores[b] - s.scores[a] || ((a - s.oya0 + 4) % 4) - ((b - s.oya0 + 4) % 4); });
  }

  // ---- CPU：公開情報だけを渡す ----
  function publicView(s, p) {
    return { me: p, hand: s.hands[p].slice(), drawn: s.turn === p ? s.drawn : null, riichiMe: s.riichi[p],
      discards: s.discards.map(function (d) { return d.map(function (x) { return { t: x.t, riichi: x.riichi }; }); }),
      riichi: s.riichi.slice(), doraIndicators: s.doraIndicators.slice(), liveCount: s.live.length, scores: s.scores.slice(),
      legal: legal(s, p) };
  }
  function visibleCounts(v) {
    var c = Y.toCounts(v.hand);
    v.discards.forEach(function (d) { d.forEach(function (x) { c[x.t]++; }); });
    v.doraIndicators.forEach(function (t) { c[t]++; });
    return c;
  }
  function cpuDecide(v) {
    var L = v.legal;
    if (L.ron) return { type: 'ron' };
    if (L.tsumo) return { type: 'tsumo' };
    if (v.riichiMe) return { type: 'discard', tile: v.drawn };
    var opts = Y.discardOptions(v.hand, visibleCounts(v));
    var threats = [0, 1, 2, 3].filter(function (q) { return q !== v.me && v.riichi[q]; });
    var pick = opts[0];
    if (threats.length && opts[0].shanten >= 2) {
      var safety = function (t) {
        var genbutsu = threats.every(function (q) { return v.discards[q].some(function (x) { return x.t === t; }); });
        if (genbutsu) return 3;
        var seen = visibleCounts(v)[t];
        if (t >= 27 && seen >= 3) return 2.5;
        if (t >= 27 && seen >= 2) return 2;
        if (E.isTerminalOrHonor(t)) return 1;
        return 0;
      };
      pick = opts.slice().sort(function (a, b) { return safety(b.tile) - safety(a.tile) || a.shanten - b.shanten || b.ukeire - a.ukeire; })[0];
    } else {
      // 同じ向聴・受け入れなら字牌・端牌から切る
      var ties = opts.filter(function (o) { return o.shanten === opts[0].shanten && o.ukeire === opts[0].ukeire; });
      ties.sort(function (a, b) { return (E.isTerminalOrHonor(b.tile) ? 1 : 0) - (E.isTerminalOrHonor(a.tile) ? 1 : 0); });
      pick = ties[0];
    }
    var riichi = pick.shanten === 0 && L.riichi.indexOf(pick.tile) >= 0;
    return { type: 'discard', tile: pick.tile, riichi: riichi };
  }
  // 自動進行（CPU と、オートプレイ時は人間側も）
  function autoStep(s, humanAuto) {
    if (s.phase === 'turn') { if (s.turn === 0 && !humanAuto) return false; return act(s, s.turn, cpuDecide(publicView(s, s.turn))); }
    if (s.phase === 'ron') { var q = s.pending.waiting; if (q === 0 && !humanAuto) return false; return act(s, q, cpuDecide(publicView(s, q))); }
    return false;
  }

  var api = { NAMES: NAMES, newGame: newGame, startHand: startHand, act: act, legal: legal, dealerOf: dealerOf, seatWind: seatWind,
    publicView: publicView, cpuDecide: cpuDecide, autoStep: autoStep, visibleCounts: visibleCounts, tsumoResult: tsumoResult, riichiTiles: riichiTiles,
    ranking: ranking, randInt: randInt, shuffledWall: shuffledWall };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GameCore = api;
})(this);
