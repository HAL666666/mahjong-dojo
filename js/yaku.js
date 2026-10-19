/* 点数道場 — 役判定・和了点計算・向聴数（門前のみ）。Engine に依存。
 * ブラウザでは window.Yaku、Node では module.exports。 */
(function (root) {
  'use strict';
  var E = root.Engine || require('./engine.js');
  var YAO = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  var GREEN = [19, 20, 21, 23, 25, 32];
  var WIND_NAMES = ['東', '南', '西', '北'];
  function isYao(t) { return E.isTerminalOrHonor(t); }
  function isHonor(t) { return t >= 27; }
  function suitOf(t) { return t >= 27 ? 3 : Math.floor(t / 9); }

  // ドラ表示牌 → ドラ
  function doraFromIndicator(t) {
    if (t < 27) return t % 9 === 8 ? t - 8 : t + 1;
    if (t < 31) return t === 30 ? 27 : t + 1;
    return t === 33 ? 31 : t + 1;
  }
  function countDora(tiles, indicators) {
    var n = 0;
    (indicators || []).forEach(function (ind) { var d = doraFromIndicator(ind); tiles.forEach(function (t) { if (t === d) n++; }); });
    return n;
  }

  // ---------- 向聴数 ----------
  function shantenRegular(c) {
    var best = 8, tiles = c.reduce(function (a, b) { return a + b; }, 0);
    var maxBlocks = Math.floor(tiles / 3); // 13→4, 14→4
    function rec(i, m, t, p) {
      while (i < 34 && c[i] === 0) i++;
      if (i >= 34) {
        var tt = Math.min(t, maxBlocks - m);
        var s = 2 * (maxBlocks - m) - tt - p;
        if (s < best) best = s;
        return;
      }
      if (c[i] >= 3) { c[i] -= 3; rec(i, m + 1, t, p); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; rec(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++; }
      if (c[i] >= 2) {
        if (!p) { c[i] -= 2; rec(i, m, t, 1); c[i] += 2; }
        c[i] -= 2; rec(i, m, t + 1, p); c[i] += 2;
      }
      if (i < 27 && i % 9 <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; rec(i, m, t + 1, p); c[i]++; c[i + 1]++; }
      if (i < 27 && i % 9 <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; rec(i, m, t + 1, p); c[i]++; c[i + 2]++; }
      var keep = c[i]; c[i] = 0; rec(i + 1, m, t, p); c[i] = keep;
    }
    rec(0, 0, 0, 0);
    return best;
  }
  function shantenChiitoi(c) {
    var pairs = 0, kinds = 0;
    c.forEach(function (v) { if (v >= 1) kinds++; if (v >= 2) pairs++; });
    return 6 - pairs + Math.max(0, 7 - kinds);
  }
  function shantenKokushi(c) {
    var kinds = 0, pair = 0;
    YAO.forEach(function (t) { if (c[t]) kinds++; if (c[t] >= 2) pair = 1; });
    return 13 - kinds - pair;
  }
  function shanten(counts) {
    var c = counts.slice();
    return Math.min(shantenRegular(c), shantenChiitoi(counts), shantenKokushi(counts));
  }
  function toCounts(tiles) { var c = new Array(34).fill(0); tiles.forEach(function (t) { c[t]++; }); return c; }
  // 13枚の待ち牌
  function waits(tiles13) {
    var c = toCounts(tiles13), out = [];
    for (var t = 0; t < 34; t++) { if (c[t] >= 4) continue; c[t]++; if (shanten(c) === -1) out.push(t); c[t]--; }
    return out;
  }
  // 打牌候補ごとの向聴数と受け入れ（visible: 見えている牌の枚数[34]、自分の手牌を含める）
  function discardOptions(tiles14, visible) {
    var c = toCounts(tiles14), res = [];
    for (var d = 0; d < 34; d++) {
      if (!c[d]) continue;
      c[d]--;
      var s = shanten(c), acc = [], total = 0;
      for (var t = 0; t < 34; t++) {
        if (c[t] >= 4) continue;
        c[t]++;
        if (shanten(c) < s) { var left = Math.max(0, 4 - visible[t] + (t === d ? 1 : 0)); if (left > 0) { acc.push({ tile: t, left: left }); total += left; } }
        c[t]--;
      }
      c[d]++;
      res.push({ tile: d, shanten: s, ukeire: total, accept: acc });
    }
    res.sort(function (a, b) { return a.shanten - b.shanten || b.ukeire - a.ukeire; });
    return res;
  }

  // ---------- 役判定 ----------
  function isKokushi(c) {
    var pair = false;
    for (var i = 0; i < YAO.length; i++) { if (!c[YAO[i]]) return false; if (c[YAO[i]] === 2) pair = true; }
    return pair && c.reduce(function (a, b) { return a + b; }, 0) === 14;
  }
  function isChuuren(c) {
    for (var s = 0; s < 3; s++) {
      var b = s * 9, sum = 0;
      for (var i = 0; i < 9; i++) sum += c[b + i];
      if (sum !== 14) continue;
      if (c[b] < 3 || c[b + 8] < 3) return false;
      for (var j = 1; j < 8; j++) if (!c[b + j]) return false;
      return true;
    }
    return false;
  }

  /* ctx: {winTile, method, seat, round, dealer, riichi, ippatsu, haitei, houtei, tenhou, chiihou, doraIndicators, uraIndicators, honba, kyotaku}
   * 返り値: null（和了形でない）または {valid, yaku:[{name,han}], yakuman, han, fu, opt, calc, dora, ura} */
  function evaluate(tiles, ctx) {
    tiles = tiles.map(E.parse);
    if (tiles.length !== 14) return null;
    var c = toCounts(tiles), win = E.parse(ctx.winTile);
    if (!c[win]) return null;
    var tsumo = ctx.method === 'tsumo';
    var common = [], ym = [];
    if (ctx.tenhou) ym.push({ name: '天和', han: 13 });
    if (ctx.chiihou) ym.push({ name: '地和', han: 13 });
    function situational(list) {
      if (ctx.riichi) list.push({ name: ctx.doubleRiichi ? '両立直' : '立直', han: ctx.doubleRiichi ? 2 : 1 });
      if (ctx.riichi && ctx.ippatsu) list.push({ name: '一発', han: 1 });
      if (tsumo) list.push({ name: '門前清自摸和', han: 1 });
      if (ctx.haitei && tsumo) list.push({ name: '海底摸月', han: 1 });
      if (ctx.houtei && !tsumo) list.push({ name: '河底撈魚', han: 1 });
    }
    var allYao = tiles.every(isYao), allHonor = tiles.every(isHonor), noHonor = !tiles.some(isHonor);
    var suits = {}; tiles.forEach(function (t) { if (t < 27) suits[suitOf(t)] = 1; });
    var nSuits = Object.keys(suits).length;
    var candidates = [];

    if (isKokushi(c)) {
      var k = ym.concat([{ name: '国士無双', han: 13 }]);
      candidates.push({ yaku: k, yakuman: k.length, fu: 30, opt: { chiitoi: false, kokushi: true, groups: [], parts: [{ label: '役満のため符は計算しません', fu: 0 }], note: '役満', fu: 30, waitName: '—', waitFu: 0 } });
    } else {
      var a = E.analyze(tiles, { winTile: win, method: ctx.method, closed: true, seat: ctx.seat, round: ctx.round });
      if (!a.valid) return null;
      a.options.forEach(function (o) {
        var y = [], Y = ym.slice();
        if (allHonor) Y.push({ name: '字一色', han: 13 });
        if (tiles.every(function (t) { return GREEN.indexOf(t) >= 0; })) Y.push({ name: '緑一色', han: 13 });
        if (allYao && noHonor) Y.push({ name: '清老頭', han: 13 });
        if (isChuuren(c)) Y.push({ name: '九蓮宝燈', han: 13 });
        if (o.chiitoi) {
          y.push({ name: '七対子', han: 2 });
        } else {
          var trip = o.groups.filter(function (g) { return g.type === 'triplet'; });
          var seqs = o.groups.filter(function (g) { return g.type === 'sequence'; });
          var concealed = trip.filter(function (g) { return !g.open; }).length;
          var dragonsT = trip.filter(function (g) { return g.tile >= 31; }).length;
          var windsT = trip.filter(function (g) { return g.tile >= 27 && g.tile <= 30; }).length;
          if (concealed === 4) Y.push({ name: o.waitName === '単騎' ? '四暗刻単騎' : '四暗刻', han: 13 });
          if (dragonsT === 3) Y.push({ name: '大三元', han: 13 });
          if (windsT === 4) Y.push({ name: '大四喜', han: 13 });
          else if (windsT === 3 && o.pair >= 27 && o.pair <= 30) Y.push({ name: '小四喜', han: 13 });
          if (o.pinfuShape) y.push({ name: '平和', han: 1 });
          // 一盃口・二盃口
          var sc = {}; seqs.forEach(function (g) { sc[g.tile] = (sc[g.tile] || 0) + 1; });
          var peiko = 0; Object.keys(sc).forEach(function (k) { peiko += Math.floor(sc[k] / 2); });
          if (peiko >= 2) y.push({ name: '二盃口', han: 3 }); else if (peiko === 1) y.push({ name: '一盃口', han: 1 });
          // 役牌
          trip.forEach(function (g) {
            if (g.tile >= 31) y.push({ name: '役牌 ' + E.name(g.tile), han: 1 });
            if (g.tile === 27 + ctx.round) y.push({ name: '場風 ' + WIND_NAMES[ctx.round], han: 1 });
            if (g.tile === 27 + ctx.seat) y.push({ name: '自風 ' + WIND_NAMES[ctx.seat], han: 1 });
          });
          if (dragonsT === 2 && o.pair >= 31) y.push({ name: '小三元', han: 2 });
          // 三色同順・一気通貫
          for (var r = 0; r < 7; r++) if (sc[r] && sc[r + 9] && sc[r + 18]) { y.push({ name: '三色同順', han: 2 }); break; }
          for (var s = 0; s < 3; s++) if (sc[s * 9] && sc[s * 9 + 3] && sc[s * 9 + 6]) { y.push({ name: '一気通貫', han: 2 }); break; }
          // 三色同刻（おまけ）
          for (var r2 = 0; r2 < 9; r2++) if ([r2, r2 + 9, r2 + 18].every(function (t) { return trip.some(function (g) { return g.tile === t; }); })) { y.push({ name: '三色同刻', han: 2 }); break; }
          if (trip.length === 4) y.push({ name: '対々和', han: 2 });
          if (concealed === 3) y.push({ name: '三暗刻', han: 2 });
          // チャンタ・純チャン
          var allGroupsYao = isYao(o.pair) && o.groups.every(function (g) { return g.type === 'triplet' ? isYao(g.tile) : (g.tile % 9 === 0 || g.tile % 9 === 6); });
          if (allGroupsYao && seqs.length > 0) y.push(noHonor ? { name: '純全帯幺九', han: 3 } : { name: '混全帯幺九', han: 2 });
        }
        if (allYao && !allHonor && !noHonor) y.push({ name: '混老頭', han: 2 });
        if (!tiles.some(isYao)) y.push({ name: '断幺九', han: 1 });
        if (nSuits === 1 && noHonor) y.push({ name: '清一色', han: 6 });
        else if (nSuits === 1 && !noHonor) y.push({ name: '混一色', han: 3 });
        situational(y);
        if (Y.length) candidates.push({ yaku: Y, yakuman: Y.length, fu: o.fu, opt: o });
        else candidates.push({ yaku: y, yakuman: 0, fu: o.fu, opt: o });
      });
    }
    // 各候補の点数を出して最高のものを選ぶ
    var dora = countDora(tiles, ctx.doraIndicators), ura = ctx.riichi ? countDora(tiles, ctx.uraIndicators) : 0;
    var best = null;
    candidates.forEach(function (cd) {
      var yakuHan = cd.yaku.reduce(function (s, y) { return s + y.han; }, 0);
      var res = { valid: yakuHan > 0, yaku: cd.yaku.slice(), yakuman: cd.yakuman, fu: cd.fu, opt: cd.opt, dora: 0, ura: 0 };
      if (cd.yakuman) { res.han = 13 * cd.yakuman; }
      else {
        res.dora = dora; res.ura = ura; res.han = yakuHan + dora + ura;
        if (dora) res.yaku.push({ name: 'ドラ', han: dora, dora: true });
        if (ura) res.yaku.push({ name: '裏ドラ', han: ura, dora: true });
      }
      res.calc = payment(res, ctx);
      if (!best || (res.valid && !best.valid) || (res.valid === best.valid && (res.calc.total > best.calc.total ||
          (res.calc.total === best.calc.total && (res.han > best.han || (res.han === best.han && res.fu > best.fu)))))) best = res;
    });
    return best;
  }

  // 支払い（役満の複合・本場・供託を含む）
  function payment(res, ctx) {
    var dealer = !!ctx.dealer, honba = ctx.honba || 0, kyotaku = ctx.kyotaku || 0;
    var mult = res.yakuman || 1;
    var c = E.calculate(res.yakuman ? 13 : res.han, res.fu, ctx.method, dealer);
    var r = { base: c.base * mult, limit: res.yakuman ? (mult > 1 ? mult + '倍役満' : '役満') : E.limitName(c.limit),
      ron: c.ron * mult, dealerPay: c.dealerPay * mult, childPay: c.childPay * mult, total: c.total * mult };
    r.honbaBonus = honba * 300; r.kyotakuBonus = kyotaku * 1000;
    r.gain = r.total + r.honbaBonus + r.kyotakuBonus;
    if (!res.valid) r.total = r.gain = 0;
    return r;
  }

  var api = { evaluate: evaluate, payment: payment, shanten: shanten, shantenRegular: function (c) { return shantenRegular(c.slice()); },
    shantenChiitoi: shantenChiitoi, shantenKokushi: shantenKokushi, waits: waits, discardOptions: discardOptions, toCounts: toCounts,
    doraFromIndicator: doraFromIndicator, countDora: countDora };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Yaku = api;
})(this);
