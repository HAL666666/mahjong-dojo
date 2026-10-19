/* 牌の理 — CPU の思考（初級／中級／上級）と、解説モード用の危険度・鳴き判断。
 * 入力は GameCore.publicView（自分の手牌と公開情報だけ）。他家の手牌や牌山は一切参照しない。 */
(function (root) {
  'use strict';
  var E = root.Engine || require('./engine.js');
  var Y = root.Yaku || require('./yaku.js');
  function T(id) { return id % 34; }
  var RED = [106, 115, 124];
  function isYao(t) { return E.isTerminalOrHonor(t); }

  function visible(v) {
    var c = Y.toCounts(v.hand);
    v.discards.forEach(function (d) { d.forEach(function (x) { if (!x.called) c[T(x.t)]++; }); });
    v.melds.forEach(function (ms) { ms.forEach(function (m) { m.ids.forEach(function (id) { c[T(id)]++; }); }); });
    v.doraIndicators.forEach(function (t) { c[T(t)]++; });
    return c;
  }
  function doras(v) { return v.doraIndicators.map(function (i) { return Y.doraFromIndicator(T(i)); }); }
  function redIn(v, ids) { return v.aka ? ids.filter(function (id) { return RED.indexOf(id) >= 0; }).length : 0; }

  // ---- 脅威の判定（公開情報のみ）----
  function threats(v, level) {
    var out = [];
    for (var q = 0; q < 4; q++) {
      if (q === v.me) continue;
      if (v.riichi[q]) { out.push({ p: q, kind: 'riichi', w: 1 }); continue; }
      if (level !== 'hard') continue;
      var ms = v.melds[q].filter(function (m) { return m.type !== 'ankan'; });
      if (ms.length < 2) continue;
      var dl = doras(v), doraN = 0, suits = {};
      v.melds[q].forEach(function (m) { m.ids.forEach(function (id) { if (dl.indexOf(T(id)) >= 0) doraN++; if (RED.indexOf(id) >= 0 && v.aka) doraN++; if (T(id) < 27) suits[Math.floor(T(id) / 9)] = 1; }); });
      var some = Object.keys(suits).length <= 1;
      var late = v.liveCount < 45;
      if (ms.length >= 3 || (late && (doraN >= 2 || some))) out.push({ p: q, kind: some ? 'some' : 'open', w: ms.length >= 3 ? 0.8 : 0.6, suit: some ? +Object.keys(suits)[0] : null });
    }
    return out;
  }

  // ---- 危険度（0〜15）。genbutsu/スジ/壁/字牌の見え方で評価 ----
  function dangerVs(v, t, q, vis) {
    var safe = {};
    v.discards[q].forEach(function (x) { safe[T(x.t)] = 1; });
    if (v.riichi[q]) { // 立直後に誰かが捨てた牌も安全（見逃しはフリテン）
      var rs = v.riichiSeq[q];
      v.discards.forEach(function (d) { d.forEach(function (x) { if (x.seq > rs) safe[T(x.t)] = 1; }); });
    }
    var dora = doras(v).indexOf(t) >= 0 ? 3 : 0;
    if (safe[t]) return { d: 0, why: '現物' };
    if (t >= 27) {
      var n = vis[t];
      if (n >= 3) return { d: 1 + dora, why: '字牌・3枚見え（単騎のみ）' };
      if (n === 2) return { d: 3 + dora, why: '字牌・2枚見え' };
      if (n === 1) return { d: 6 + dora, why: '字牌・1枚見え' };
      return { d: 8 + dora, why: '字牌・生牌' };
    }
    var r = t % 9, base = t - r;
    var lo = r >= 3 ? safe[t - 3] : true, hi = r <= 5 ? safe[t + 3] : true;
    var suji = lo && hi;
    // 壁（ノーチャンス）：その牌を両面で待つ形の材料が4枚見えている
    var shapesOpen = 0;
    if (r >= 2 && vis[t - 1] < 4 && vis[t - 2] < 4) shapesOpen++;
    if (r <= 6 && vis[t + 1] < 4 && vis[t + 2] < 4) shapesOpen++;
    var kabe = shapesOpen === 0;
    var term = r === 0 || r === 8, edge = r === 1 || r === 7;
    if (suji) {
      if (term) return { d: 2 + dora, why: 'スジの端牌' };
      if (edge) return { d: 4 + dora, why: 'スジの2・8' };
      if (r === 2 || r === 6) return { d: 5 + dora, why: 'スジの3・7' };
      return { d: 6 + dora, why: '中スジ' };
    }
    if (kabe) return { d: (term ? 2 : 4) + dora, why: '壁（ノーチャンス）' };
    if (lo || hi) return { d: 9 + dora, why: '片スジ' };
    if (term) return { d: 8 + dora, why: '無スジの端牌' };
    if (edge) return { d: 10 + dora, why: '無スジの2・8' };
    return { d: 12 + dora, why: '無スジの中張牌' };
  }
  function danger(v, t, level, ths) {
    ths = ths || threats(v, level || 'hard');
    if (!ths.length) return { d: 0, why: '', level: null };
    var vis = visible(v), worst = { d: -1 };
    ths.forEach(function (th) {
      var x = dangerVs(v, t, th.p, vis);
      var d = x.d * th.w;
      if (th.kind === 'some' && th.suit != null && t < 27 && Math.floor(t / 9) !== th.suit) d = Math.min(d, 1);
      if (d > worst.d) worst = { d: d, why: x.why };
    });
    worst.level = worst.d <= 2 ? '安全' : worst.d <= 6 ? 'やや危険' : '危険';
    return worst;
  }

  // ---- 手の価値（ダマで和了ったときの最高打点。役がなければ 0）----
  function ctxOf(v, win, method) {
    return { winTile: win, method: method, seat: v.seat, round: v.round, dealer: v.dealer === v.me, doraIndicators: v.doraIndicators.map(T),
      red: redIn(v, v.hand) + v.melds[v.me].reduce(function (a, m) { return a + redIn(v, m.ids); }, 0), honba: 0, kyotaku: 0 };
  }
  function damaValue(v, closed13) {
    var ms = v.melds[v.me].map(function (m) { return { type: m.type, tiles: m.ids.map(T) }; });
    var best = 0, ws = Y.waits(closed13, ms.length);
    ws.forEach(function (w) {
      var r = Y.evaluate({ closed: closed13.map(T).concat([w]), melds: ms }, ctxOf(v, w, 'ron'));
      if (r && r.valid && r.calc.total > best) best = r.calc.total;
    });
    return best;
  }
  function waitsLeft(v, closed13) {
    var vis = visible(v), n = 0;
    Y.waits(closed13, v.melds[v.me].length).forEach(function (w) { n += Math.max(0, 4 - vis[w]); });
    return n;
  }

  // ---- 役の見込み（鳴いても役が残るか）----
  function yakuhaiTile(v, t) { return t >= 31 || t === 27 + v.seat || t === 27 + v.round; }
  function yakuPlan(v, closedTypes, meldsTypes) {
    // meldsTypes: [{type, tiles}]（新しい鳴きを含む）
    var plans = [], c = Y.toCounts(closedTypes);
    var trip = meldsTypes.filter(function (m) { return m.type !== 'chi'; });
    if (trip.some(function (m) { return yakuhaiTile(v, m.tiles[0]); })) plans.push('役牌');
    for (var t = 27; t < 34; t++) if (yakuhaiTile(v, t) && c[t] >= 3) { plans.push('役牌'); break; }
    var all = closedTypes.slice(); meldsTypes.forEach(function (m) { all = all.concat(m.tiles); });
    var meldYao = meldsTypes.some(function (m) { return m.tiles.some(isYao); });
    var closedYao = closedTypes.filter(isYao).length;
    if (!meldYao && closedYao <= 1) plans.push('断幺九');
    for (var s = 0; s < 3; s++) {
      var off = all.filter(function (x) { return x < 27 && Math.floor(x / 9) !== s; }).length;
      var meldOff = meldsTypes.some(function (m) { return m.tiles.some(function (x) { return x < 27 && Math.floor(x / 9) !== s; }); });
      if (!meldOff && off <= 1) { plans.push(all.some(function (x) { return x >= 27; }) ? '混一色' : '清一色'); break; }
    }
    if (meldsTypes.every(function (m) { return m.type !== 'chi'; })) {
      var pairs = 0; c.forEach(function (n) { if (n >= 2) pairs++; });
      if (pairs + trip.length >= 5) plans.push('対々和');
    }
    return plans;
  }
  function closedAfter(hand, removeTypes) {
    var rest = hand.slice();
    removeTypes.forEach(function (rt) { var i = rest.findIndex(function (x) { return T(x) === rt; }); if (i >= 0) rest.splice(i, 1); });
    return rest;
  }
  // 鳴いた場合の評価：{ok, plans, before, after, reason}
  function callAdvice(v, kind, tiles) {
    var t = T(v.pendingTile), own = v.melds[v.me].map(function (m) { return { type: m.type, tiles: m.ids.map(T) }; });
    var use = kind === 'chi' ? tiles.map(T) : kind === 'minkan' ? [t, t, t] : [t, t];
    var rest = closedAfter(v.hand, use);
    var newMeld = { type: kind === 'chi' ? 'chi' : kind === 'minkan' ? 'minkan' : 'pon', tiles: use.concat([t]).sort(function (a, b) { return a - b; }) };
    var melds = own.concat([newMeld]);
    var before = Y.shanten(Y.toCounts(v.hand), own.length);
    var plans = yakuPlan(v, rest.map(T), melds);
    var after;
    if (kind === 'minkan') after = Y.shanten(Y.toCounts(rest), melds.length);
    else {
      var ban = kind === 'chi' ? kuikaeBanTypes(t, use) : [t];
      var opts = Y.discardOptions(rest, visible(v), melds.length, ban);
      after = opts.length ? opts[0].shanten : 9;
    }
    var ok = plans.length > 0 && (after < before || (after === before && plans.indexOf('役牌') >= 0 && kind !== 'chi'));
    var reason;
    if (!plans.length) reason = '鳴くと役がなくなる可能性が高い（門前でないと立直・平和などが付かない）';
    else if (after < before) reason = '役（' + plans[0] + '）が残り、向聴数が ' + before + '→' + after + ' に進む';
    else if (ok) reason = '役牌を確定できる（向聴数は変わらない）';
    else reason = '役（' + plans[0] + '）は残るが向聴数が進まない（' + before + '→' + after + '）';
    return { ok: ok, plans: plans, before: before, after: after, reason: reason };
  }
  function kuikaeBanTypes(t, use) {
    var a = Math.min(use[0], use[1]), b = Math.max(use[0], use[1]), ban = [t];
    if (b === a + 1) { if (t === a - 1 && b % 9 !== 8) ban.push(b + 1); if (t === b + 1 && a % 9 !== 0) ban.push(a - 1); }
    return ban;
  }

  // ---- 打牌選択 ----
  function discardChoice(v, level) {
    var L = v.legal, nm = v.melds[v.me].length, vis = visible(v);
    var allowed = {}; L.discard.forEach(function (id) { allowed[T(id)] = 1; });
    var opts = Y.discardOptions(v.hand, vis, nm, null).filter(function (o) { return allowed[o.tile]; });
    if (!opts.length) return { tile: L.discard[0] };
    var best = opts[0];
    var ths = level === 'easy' ? threats(v, 'normal') : threats(v, level);
    var dl = doras(v);
    function tie(a, b) { // 同条件なら：ドラ・赤を残し、字牌・端牌から切る
      var da = dl.indexOf(a.tile) >= 0 ? 1 : 0, db = dl.indexOf(b.tile) >= 0 ? 1 : 0;
      if (da !== db) return da - db;
      return (isYao(b.tile) ? 1 : 0) - (isYao(a.tile) ? 1 : 0);
    }
    if (level === 'easy') {
      if (ths.length && best.shanten >= 2) {
        var safety = function (t) {
          if (ths.every(function (th) { return v.discards[th.p].some(function (x) { return T(x.t) === t; }); })) return 3;
          if (t >= 27 && vis[t] >= 3) return 2.5; if (t >= 27 && vis[t] >= 2) return 2; return isYao(t) ? 1 : 0;
        };
        return { tile: opts.slice().sort(function (a, b) { return safety(b.tile) - safety(a.tile) || a.shanten - b.shanten || b.ukeire - a.ukeire; })[0].tile };
      }
      return { tile: opts.filter(function (o) { return o.shanten === best.shanten && o.ukeire === best.ukeire; }).sort(tie)[0].tile };
    }
    if (!ths.length) {
      var cand = opts.filter(function (o) { return o.shanten === best.shanten && o.ukeire >= best.ukeire * (level === 'hard' ? 0.85 : 1); });
      if (level === 'hard' && v.liveCount < 20) { // 終盤は他家の副露・河も考え、危険な無スジを避ける
        cand.sort(function (a, b) { return b.ukeire - a.ukeire || tie(a, b); });
      } else cand.sort(function (a, b) { return b.ukeire - a.ukeire || tie(a, b); });
      return { tile: cand[0].tile };
    }
    var dang = {}; opts.forEach(function (o) { dang[o.tile] = danger(v, o.tile, level, ths).d; });
    var fold;
    if (level === 'normal') fold = best.shanten >= 2 || (best.shanten === 1 && v.liveCount < 20);
    else {
      // 上級：押し引き。手の価値と向聴数、残り枚数、相手の脅威で判断
      var value = 0, riichiTh = ths.filter(function (th) { return th.kind === 'riichi'; }).length;
      if (best.shanten === 0) {
        var r13 = closedAfter(v.hand, [best.tile]);
        value = damaValue(v, r13);
        if (!value && nm === 0 && v.legal.riichi.length) value = v.dealer === v.me ? 3900 : 2600;
        var wl = waitsLeft(v, r13);
        fold = wl === 0 || (!value && wl < 4);                                      // 役なし・待ちなしは降り
        if (riichiTh >= 2 && value < 3900 && wl <= 2) fold = true;
      } else if (best.shanten === 1) {
        var est = estimateValue(v);
        if (!riichiTh) fold = v.liveCount < 12;                                     // 副露の脅威だけなら1向聴は押す
        else fold = riichiTh >= 2 || v.liveCount < 18 || (est < 2600 && best.ukeire < 12);
      } else fold = riichiTh > 0 || v.liveCount < 20;
      if (v.riichiMe) fold = false;
    }
    if (fold) {
      var sorted = opts.slice().sort(function (a, b) { return dang[a.tile] - dang[b.tile] || a.shanten - b.shanten || b.ukeire - a.ukeire; });
      return { tile: sorted[0].tile, fold: true };
    }
    // 押す：向聴数を落とさない範囲で危険度の低いものを選ぶ
    var keep = opts.filter(function (o) { return o.shanten === best.shanten; });
    keep.sort(function (a, b) { return (dang[a.tile] - dang[b.tile]) * (level === 'hard' ? 1 : 0.5) + (b.ukeire - a.ukeire) * 0.3; });
    if (level === 'hard') {
      var maxU = Math.max.apply(null, keep.map(function (o) { return o.ukeire; }));
      keep = keep.filter(function (o) { return o.ukeire >= maxU * 0.6; });
      keep.sort(function (a, b) { return dang[a.tile] - dang[b.tile] || b.ukeire - a.ukeire; });
    }
    return { tile: keep[0].tile };
  }
  function estimateValue(v) {
    var all = v.hand.slice(); v.melds[v.me].forEach(function (m) { all = all.concat(m.ids); });
    var dl = doras(v), d = 0; all.forEach(function (id) { if (dl.indexOf(T(id)) >= 0) d++; if (v.aka && RED.indexOf(id) >= 0) d++; });
    var han = d + (v.melds[v.me].length === 0 ? 1 : 0) + 1;
    var base = Math.min(2000, 30 * Math.pow(2, han + 2));
    return Math.ceil(base * (v.dealer === v.me ? 6 : 4) / 100) * 100;
  }

  function decide(v, level) {
    level = level || 'normal';
    var L = v.legal;
    if (L.ron) return { type: 'ron' };
    if (v.phase === 'call') return decideCall(v, level);
    if (v.phase !== 'turn') return { type: 'skip' };
    if (L.tsumo) return { type: 'tsumo' };
    if (L.kyuushu && level !== 'easy') {
      var c = Y.toCounts(v.hand), kinds = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33].filter(function (t) { return c[t]; }).length;
      if (level === 'normal' || kinds < 11) return { type: 'kyuushu' };
    }
    if (level !== 'easy') {
      var ths = threats(v, level);
      if (L.ankan.length && (v.riichiMe || !ths.length)) {
        var t = L.ankan[0];
        // 暗槓で向聴数が悪化しないときだけ
        var rest = v.hand.filter(function (id) { return T(id) !== t; });
        if (v.riichiMe || Y.shanten(Y.toCounts(rest), v.melds[v.me].length + 1) <= Y.shanten(Y.toCounts(v.hand), v.melds[v.me].length) || isYao(t)) return { type: 'ankan', tile: t };
      }
      if (L.kakan.length && !ths.length && level === 'hard') return { type: 'kakan', tile: L.kakan[0] };
    }
    if (v.riichiMe) return { type: 'discard', tile: v.drawn };
    var ch = discardChoice(v, level);
    var tile = T(ch.tile), riichi = false;
    var canR = L.riichi.some(function (id) { return T(id) === tile; });
    if (canR) {
      var r13 = closedAfter(v.hand, [tile]);
      if (level === 'easy') riichi = true;
      else {
        var wl = waitsLeft(v, r13), dv = damaValue(v, r13);
        if (level === 'normal') riichi = wl > 0;
        else {
          var thr = v.dealer === v.me ? 11600 : 7700;
          if (dv >= thr && wl >= 1) riichi = false;                                   // 役ありで高打点：ダマ
          else if (dv > 0 && wl <= 2 && v.liveCount < 20) riichi = false;               // 終盤の悪形は役があればダマ
          else riichi = wl >= 1;
          if (ch.fold && !dv) riichi = false;
        }
      }
    }
    return { type: 'discard', tile: tile, riichi: riichi };
  }
  function decideCall(v, level) {
    var L = v.legal;
    if (level === 'easy') return { type: 'skip' };
    var ths = threats(v, level);
    var cur = Y.shanten(Y.toCounts(v.hand), v.melds[v.me].length);
    if (L.pon) {
      var a = callAdvice(v, 'pon');
      var t = T(v.pendingTile);
      var good = a.ok && (!ths.length || a.after <= (level === 'hard' ? 1 : 0) || (yakuhaiTile(v, t) && a.after <= 2));
      if (level === 'normal' && !(yakuhaiTile(v, t) || a.after <= 2)) good = false;
      if (good) {
        if (L.minkan && level === 'hard' && !ths.length && yakuhaiTile(v, t) && cur <= 1) return { type: 'minkan' };
        return { type: 'pon' };
      }
    }
    if (L.chi && L.chi.length) {
      var best = null;
      L.chi.forEach(function (c) {
        var adv = callAdvice(v, 'chi', c);
        if (adv.ok && (!best || adv.after < best.adv.after || (adv.after === best.adv.after && RED.indexOf(c[0]) < 0 && RED.indexOf(c[1]) < 0))) best = { c: c, adv: adv };
      });
      var rich = best && best.adv.plans.some(function (pl) { return pl === '混一色' || pl === '清一色' || pl === '役牌'; });
      if (best && (best.adv.after <= (level === 'hard' && rich ? 2 : 1)) && (!ths.length || best.adv.after === 0)) return { type: 'chi', tiles: best.c };
    }
    return { type: 'skip' };
  }

  var api = { decide: decide, danger: danger, threats: threats, callAdvice: callAdvice, damaValue: damaValue, waitsLeft: waitsLeft, visible: visible, yakuPlan: yakuPlan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CPU = api;
})(this);
