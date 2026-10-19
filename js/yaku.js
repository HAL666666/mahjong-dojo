/* 牌の理 — 役判定・和了点計算・向聴数（門前・副露の両対応）。Engine に依存。
 * ブラウザでは window.Yaku、Node では module.exports。
 * 手牌の入力：14枚の配列（門前）または { closed: [牌], melds: [{type:'pon'|'chi'|'minkan'|'ankan'|'kakan', tiles:[牌]}] }
 * closed には和了牌を含める。牌は種類番号 0..33（Engine と同じ）。 */
(function (root) {
  'use strict';
  var E = root.Engine || require('./engine.js');
  var YAO = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  var GREEN = [19, 20, 21, 23, 25, 32];
  var WIND_NAMES = ['東', '南', '西', '北'];
  var MELD_LABEL = { pon: 'ポン', chi: 'チー', minkan: '明槓', ankan: '暗槓', kakan: '加槓' };
  function isYao(t) { return E.isTerminalOrHonor(t); }
  function isHonor(t) { return t >= 27; }
  function suitOf(t) { return t >= 27 ? 3 : Math.floor(t / 9); }

  function doraFromIndicator(t) {
    if (t < 27) return t % 9 === 8 ? t - 8 : t + 1;
    if (t < 31) return t === 30 ? 27 : t + 1;
    return t === 33 ? 31 : t + 1;
  }
  function countDora(tiles, indicators) {
    var n = 0;
    (indicators || []).forEach(function (ind) { var d = doraFromIndicator(ind % 34); tiles.forEach(function (t) { if (t === d) n++; }); });
    return n;
  }

  // ---------- 向聴数 ----------
  function shantenRegular(c) {
    var best = 8, tiles = c.reduce(function (a, b) { return a + b; }, 0);
    var maxBlocks = Math.floor(tiles / 3);
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
  // nMelds > 0 のときは通常形のみ（七対子・国士は門前のみ）
  var memo = new Map();
  function shanten(counts, nMelds) {
    var key = String.fromCharCode.apply(null, counts) + (nMelds ? 1 : 0);
    var hit = memo.get(key);
    if (hit !== undefined) return hit;
    var r = shantenRegular(counts.slice());
    if (!nMelds) r = Math.min(r, shantenChiitoi(counts), shantenKokushi(counts));
    if (memo.size > 300000) memo.clear();
    memo.set(key, r);
    return r;
  }
  function toCounts(tiles) { var c = new Array(34).fill(0); tiles.forEach(function (t) { c[t % 34]++; }); return c; }
  function waits(tiles13, nMelds) {
    var c = toCounts(tiles13), out = [];
    for (var t = 0; t < 34; t++) { if (c[t] >= 4) continue; c[t]++; if (shanten(c, nMelds) === -1) out.push(t); c[t]--; }
    return out;
  }
  // 打牌候補ごとの向聴数と受け入れ。forbid: 打てない牌（喰い替え禁止）
  function discardOptions(tiles14, visible, nMelds, forbid) {
    var c = toCounts(tiles14), res = [];
    for (var d = 0; d < 34; d++) {
      if (!c[d] || (forbid && forbid.indexOf(d) >= 0)) continue;
      c[d]--;
      var s = shanten(c, nMelds), acc = [], total = 0;
      for (var t = 0; t < 34; t++) {
        if (c[t] >= 4) continue;
        c[t]++;
        if (shanten(c, nMelds) < s) { var left = Math.max(0, 4 - visible[t] + (t === d ? 1 : 0)); if (left > 0) { acc.push({ tile: t, left: left }); total += left; } }
        c[t]--;
      }
      c[d]++;
      res.push({ tile: d, shanten: s, ukeire: total, accept: acc });
    }
    res.sort(function (a, b) { return a.shanten - b.shanten || b.ukeire - a.ukeire; });
    return res;
  }

  // ---------- 分解 ----------
  function decomposeGroups(c, need) {
    var out = [];
    for (var p = 0; p < 34; p++) {
      if (c[p] < 2) continue;
      c[p] -= 2;
      (function rec(groups) {
        var f = -1;
        for (var i = 0; i < 34; i++) if (c[i] > 0) { f = i; break; }
        if (f < 0) { if (groups.length === need) out.push({ pair: p, groups: groups.slice() }); return; }
        if (groups.length >= need) return;
        if (c[f] >= 3) { c[f] -= 3; rec(groups.concat([{ type: 'triplet', tile: f }])); c[f] += 3; }
        if (f < 27 && f % 9 <= 6 && c[f + 1] && c[f + 2]) { c[f]--; c[f + 1]--; c[f + 2]--; rec(groups.concat([{ type: 'sequence', tile: f }])); c[f]++; c[f + 1]++; c[f + 2]++; }
      })([]);
      c[p] += 2;
    }
    return out;
  }
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
  function pairInfo(pair, seat, round) {
    if (pair < 27) return { fu: 0, label: '' };
    var fu = 0, why = [];
    if (pair >= 31) { fu += 2; why.push('三元牌'); }
    if (pair === 27 + seat) { fu += 2; why.push('自風'); }
    if (pair === 27 + round) { fu += 2; why.push('場風'); }
    return { fu: fu, label: E.name(pair) + (why.length ? '・' + why.join('＋') : '') };
  }
  function normMeld(m) {
    var tiles = m.tiles.map(function (t) { return E.parse(t) % 34; }).sort(function (a, b) { return a - b; });
    var kan = m.type === 'minkan' || m.type === 'ankan' || m.type === 'kakan';
    return { type: m.type === 'chi' ? 'sequence' : 'triplet', meld: m.type, tile: tiles[0], tiles: tiles, open: m.type !== 'ankan', kan: kan };
  }

  /* ctx: {winTile, method, seat, round, dealer, riichi, doubleRiichi, ippatsu, haitei, houtei, rinshan, chankan, tenhou, chiihou,
   *        doraIndicators, uraIndicators, red, honba, kyotaku}
   * 返り値: null（和了形でない）または {valid, yaku:[{name,han}], yakuman, han, fu, opt, calc, dora, ura, aka} */
  function evaluate(input, ctx) {
    var closed, melds;
    if (Array.isArray(input)) { closed = input.map(function (t) { return E.parse(t) % 34; }); melds = []; }
    else { closed = input.closed.map(function (t) { return E.parse(t) % 34; }); melds = (input.melds || []).map(normMeld); }
    var nm = melds.length;
    if (closed.length !== 14 - 3 * nm) return null;
    var menzen = melds.every(function (m) { return !m.open; });
    var c = toCounts(closed), win = E.parse(ctx.winTile) % 34;
    if (!c[win]) return null;
    var tsumo = ctx.method === 'tsumo';
    var all = closed.slice(); melds.forEach(function (m) { all = all.concat(m.tiles); });
    var allC = toCounts(all);
    var ymBase = [];
    if (ctx.tenhou) ymBase.push({ name: '天和', han: 13 });
    if (ctx.chiihou) ymBase.push({ name: '地和', han: 13 });
    function situational(list) {
      if (menzen && ctx.riichi) list.push({ name: ctx.doubleRiichi ? '両立直' : '立直', han: ctx.doubleRiichi ? 2 : 1 });
      if (menzen && ctx.riichi && ctx.ippatsu) list.push({ name: '一発', han: 1 });
      if (menzen && tsumo) list.push({ name: '門前清自摸和', han: 1 });
      if (ctx.haitei && tsumo && !ctx.rinshan) list.push({ name: '海底摸月', han: 1 });
      if (ctx.houtei && !tsumo) list.push({ name: '河底撈魚', han: 1 });
      if (ctx.rinshan && tsumo) list.push({ name: '嶺上開花', han: 1 });
      if (ctx.chankan && !tsumo) list.push({ name: '槍槓', han: 1 });
    }
    var allYao = all.every(isYao), allHonor = all.every(isHonor), noHonor = !all.some(isHonor);
    var suits = {}; all.forEach(function (t) { if (t < 27) suits[suitOf(t)] = 1; });
    var nSuits = Object.keys(suits).length;
    function colorYaku(y) {
      if (!all.some(isYao)) y.push({ name: '断幺九', han: 1 });
      if (nSuits === 1 && noHonor) y.push({ name: '清一色', han: menzen ? 6 : 5 });
      else if (nSuits === 1 && !noHonor) y.push({ name: '混一色', han: menzen ? 3 : 2 });
      if (allYao && !allHonor && !noHonor) y.push({ name: '混老頭', han: 2 });
    }
    var commonYM = [];
    if (allHonor) commonYM.push({ name: '字一色', han: 13 });
    if (all.every(function (t) { return GREEN.indexOf(t) >= 0; })) commonYM.push({ name: '緑一色', han: 13 });
    if (allYao && noHonor) commonYM.push({ name: '清老頭', han: 13 });
    var candidates = [];

    if (nm === 0 && isKokushi(c)) {
      var k = ymBase.concat([{ name: '国士無双', han: 13 }]);
      candidates.push({ yaku: k, yakuman: k.length, fu: 30, opt: { chiitoi: false, kokushi: true, groups: [], parts: [{ label: '役満のため符は計算しません', fu: 0 }], note: '役満', fu: 30, waitName: '—', waitFu: 0 } });
    }
    // 七対子
    if (nm === 0) {
      var pairs = 0, ok7 = true;
      c.forEach(function (v) { if (v === 2) pairs++; else if (v) ok7 = false; });
      if (ok7 && pairs === 7) {
        var y7 = [{ name: '七対子', han: 2 }], Y7 = ymBase.concat(commonYM.filter(function (x) { return x.name === '字一色'; }));
        colorYaku(y7); situational(y7);
        var fd7 = E.fuBreakdown({ chiitoi: true });
        candidates.push({ yaku: Y7.length ? Y7 : y7, yakuman: Y7.length, fu: 25,
          opt: { chiitoi: true, groups: [], pair: -1, waitName: '単騎', waitFu: 0, pinfuShape: false, fu: 25, raw: 25, parts: fd7.parts, note: fd7.note, special: fd7.special } });
      }
    }
    // 通常形
    decomposeGroups(c.slice(), 4 - nm).forEach(function (shape) {
      var locs = [];
      if (shape.pair === win) locs.push({ kind: 'pair', gi: -1 });
      shape.groups.forEach(function (g, gi) {
        if (g.type === 'triplet' ? g.tile === win : (win >= g.tile && win <= g.tile + 2)) locs.push({ kind: g.type, gi: gi });
      });
      locs.forEach(function (loc) { candidates.push(scoreShape(shape, loc)); });
    });

    function scoreShape(shape, loc) {
      var waitName = '双碰';
      if (loc.kind === 'pair') waitName = '単騎';
      else if (loc.kind === 'sequence') {
        var st = shape.groups[loc.gi].tile % 9, wr = win % 9;
        if (wr === st + 1) waitName = '嵌張';
        else if ((st === 0 && wr === 2) || (st === 6 && wr === 6)) waitName = '辺張';
        else waitName = '両面';
      }
      var waitFu = { '両面': 0, '双碰': 0, '嵌張': 2, '辺張': 2, '単騎': 2 }[waitName];
      var groups = shape.groups.map(function (g, gi) {
        var o = { type: g.type, tile: g.tile, tiles: g.type === 'triplet' ? [g.tile, g.tile, g.tile] : [g.tile, g.tile + 1, g.tile + 2], open: false, kan: false, meld: null };
        if (g.type === 'triplet') o.ronComplete = !tsumo && loc.kind === 'triplet' && loc.gi === gi;
        if (o.ronComplete) o.open = true;
        return o;
      }).concat(melds.map(function (m) { return { type: m.type, tile: m.tile, tiles: m.tiles, open: m.open, kan: m.kan, meld: m.meld }; }));
      groups.forEach(function (g) {
        g.fu = 0;
        if (g.type === 'triplet') {
          var yao = isYao(g.tile);
          g.fu = (yao ? 4 : 2) * (g.open ? 1 : 2) * (g.kan ? 4 : 1);
          g.label = (g.open ? '明' : '暗') + (g.kan ? '槓' : '刻') + '・' + (yao ? '幺九/字牌' : '中張牌') + '（' + E.name(g.tile) + '）' + (g.ronComplete ? '※ロンで完成→明刻扱い' : '') + (g.meld ? '［' + MELD_LABEL[g.meld] + '］' : '');
        }
      });
      var pi = pairInfo(shape.pair, ctx.seat || 0, ctx.round || 0);
      var trip = groups.filter(function (g) { return g.type === 'triplet'; });
      var seqs = groups.filter(function (g) { return g.type === 'sequence'; });
      var pinfuShape = menzen && nm === 0 && seqs.length === 4 && pi.fu === 0 && waitName === '両面';
      var fd = E.fuBreakdown({ method: ctx.method, closed: menzen, pairFu: pi.fu, pairLabel: pi.label, waitFu: waitFu, waitName: waitName,
        melds: trip, pinfuTsumo: pinfuShape && tsumo, chiitoi: false });
      var y = [], Y = ymBase.slice().concat(commonYM);
      if (isChuuren(c) && nm === 0) Y.push({ name: '九蓮宝燈', han: 13 });
      var concealed = trip.filter(function (g) { return !g.open; }).length;
      var kans = groups.filter(function (g) { return g.kan; }).length;
      var dragonsT = trip.filter(function (g) { return g.tile >= 31; }).length;
      var windsT = trip.filter(function (g) { return g.tile >= 27 && g.tile <= 30; }).length;
      if (concealed === 4) Y.push({ name: waitName === '単騎' ? '四暗刻単騎' : '四暗刻', han: 13 });
      if (dragonsT === 3) Y.push({ name: '大三元', han: 13 });
      if (windsT === 4) Y.push({ name: '大四喜', han: 13 });
      else if (windsT === 3 && shape.pair >= 27 && shape.pair <= 30) Y.push({ name: '小四喜', han: 13 });
      if (kans === 4) Y.push({ name: '四槓子', han: 13 });
      if (pinfuShape) y.push({ name: '平和', han: 1 });
      var sc = {}; seqs.forEach(function (g) { sc[g.tile] = (sc[g.tile] || 0) + 1; });
      if (menzen) {
        var peiko = 0; Object.keys(sc).forEach(function (k2) { peiko += Math.floor(sc[k2] / 2); });
        if (peiko >= 2) y.push({ name: '二盃口', han: 3 }); else if (peiko === 1) y.push({ name: '一盃口', han: 1 });
      }
      trip.forEach(function (g) {
        if (g.tile >= 31) y.push({ name: '役牌 ' + E.name(g.tile), han: 1 });
        if (g.tile === 27 + (ctx.round || 0)) y.push({ name: '場風 ' + WIND_NAMES[ctx.round || 0], han: 1 });
        if (g.tile === 27 + (ctx.seat || 0)) y.push({ name: '自風 ' + WIND_NAMES[ctx.seat || 0], han: 1 });
      });
      if (dragonsT === 2 && shape.pair >= 31) y.push({ name: '小三元', han: 2 });
      for (var r = 0; r < 7; r++) if (sc[r] && sc[r + 9] && sc[r + 18]) { y.push({ name: '三色同順', han: menzen ? 2 : 1 }); break; }
      for (var s = 0; s < 3; s++) if (sc[s * 9] && sc[s * 9 + 3] && sc[s * 9 + 6]) { y.push({ name: '一気通貫', han: menzen ? 2 : 1 }); break; }
      for (var r2 = 0; r2 < 9; r2++) if ([r2, r2 + 9, r2 + 18].every(function (t) { return trip.some(function (g) { return g.tile === t; }); })) { y.push({ name: '三色同刻', han: 2 }); break; }
      if (trip.length === 4) y.push({ name: '対々和', han: 2 });
      if (concealed === 3) y.push({ name: '三暗刻', han: 2 });
      if (kans === 3) y.push({ name: '三槓子', han: 2 });
      var allGroupsYao = isYao(shape.pair) && groups.every(function (g) { return g.type === 'triplet' ? isYao(g.tile) : (g.tile % 9 === 0 || g.tile % 9 === 6); });
      if (allGroupsYao && seqs.length > 0) y.push(noHonor ? { name: '純全帯幺九', han: menzen ? 3 : 2 } : { name: '混全帯幺九', han: menzen ? 2 : 1 });
      colorYaku(y); situational(y);
      var opt = { chiitoi: false, groups: groups, pair: shape.pair, waitName: waitName, waitFu: waitFu, pinfuShape: pinfuShape,
        fu: fd.fu, raw: fd.raw, parts: fd.parts, note: fd.note, special: fd.special, menzen: menzen };
      return Y.length ? { yaku: Y, yakuman: Y.length, fu: fd.fu, opt: opt } : { yaku: y, yakuman: 0, fu: fd.fu, opt: opt };
    }

    if (!candidates.length) return null;
    var dora = countDora(all, ctx.doraIndicators), ura = ctx.riichi && menzen ? countDora(all, ctx.uraIndicators) : 0, aka = ctx.red || 0;
    var best = null;
    candidates.forEach(function (cd) {
      var yakuHan = cd.yaku.reduce(function (sm, yy) { return sm + yy.han; }, 0);
      var res = { valid: yakuHan > 0, yaku: cd.yaku.slice(), yakuman: cd.yakuman, fu: cd.fu, opt: cd.opt, dora: 0, ura: 0, aka: 0, menzen: menzen };
      if (cd.yakuman) res.han = 13 * cd.yakuman;
      else {
        res.dora = dora; res.ura = ura; res.aka = aka; res.han = yakuHan + dora + ura + aka;
        if (dora) res.yaku.push({ name: 'ドラ', han: dora, dora: true });
        if (aka) res.yaku.push({ name: '赤ドラ', han: aka, dora: true });
        if (ura) res.yaku.push({ name: '裏ドラ', han: ura, dora: true });
      }
      res.calc = payment(res, ctx);
      if (!best || (res.valid && !best.valid) || (res.valid === best.valid && (res.calc.total > best.calc.total ||
          (res.calc.total === best.calc.total && (res.han > best.han || (res.han === best.han && res.fu > best.fu)))))) best = res;
    });
    return best;
  }

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
    doraFromIndicator: doraFromIndicator, countDora: countDora, MELD_LABEL: MELD_LABEL, isYao: isYao };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Yaku = api;
})(this);
