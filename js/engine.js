/* 点数道場 — 採点エンジン（Godot版 score_engine.gd / hand_analyzer.gd からの移植）
 * ブラウザでは window.Engine、Node では module.exports として使える。 */
(function (root) {
  'use strict';
  // 牌コード: 0-8 萬子, 9-17 筒子, 18-26 索子, 27-30 東南西北, 31-33 白發中
  var KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var HONORS = ['東', '南', '西', '北', '白', '發', '中'];
  var SUITS = ['m', 'p', 's'];
  var SUIT_NAMES = ['萬', '筒', '索'];
  var WINDS = ['東', '南', '西', '北'];

  function code(i) { return i < 27 ? (i % 9 + 1) + SUITS[Math.floor(i / 9)] : (i - 26) + 'z'; }
  function parse(c) {
    if (typeof c === 'number') return c;
    var n = parseInt(c[0], 10), s = c[1];
    if (s === 'z') return 26 + n;
    return SUITS.indexOf(s) * 9 + n - 1;
  }
  function name(i) { return i < 27 ? KANJI[i % 9] + SUIT_NAMES[Math.floor(i / 9)] : HONORS[i - 27]; }
  function isTerminalOrHonor(i) { return i >= 27 || i % 9 === 0 || i % 9 === 8; }

  // ---- 符・点数 ----
  function roundUp10(v) { return Math.ceil(v / 10) * 10; }
  function roundUp100(v) { return Math.ceil(v / 100) * 100; }

  function fuFromRaw(raw, pinfuTsumo, chiitoi) {
    if (chiitoi) return 25;
    if (pinfuTsumo) return 20;
    return roundUp10(Math.max(30, raw)); // 通常手は最低30符
  }

  /* opts: {method, closed, pairFu, pairLabel, waitFu, waitName, melds:[{label, fu}], pinfuTsumo, chiitoi} */
  function fuBreakdown(o) {
    if (o.chiitoi) return { raw: 25, fu: 25, special: 'chiitoi', parts: [{ label: '七対子の特例', fu: 25 }], note: '七対子は25符固定（切り上げなし）' };
    if (o.pinfuTsumo) return { raw: 20, fu: 20, special: 'pinfuTsumo', parts: [{ label: '平和ツモの特例', fu: 20 }], note: '平和ツモはツモ符2を付けず20符固定' };
    var parts = [{ label: '副底', fu: 20 }], raw = 20;
    if (o.method === 'ron' && o.closed) { parts.push({ label: '門前ロン', fu: 10 }); raw += 10; }
    if (o.method === 'tsumo') { parts.push({ label: 'ツモ', fu: 2 }); raw += 2; }
    if (o.pairFu > 0) { parts.push({ label: '雀頭（' + (o.pairLabel || '役牌') + '）', fu: o.pairFu }); raw += o.pairFu; }
    if (o.waitFu > 0) { parts.push({ label: '待ち（' + (o.waitName || '') + '）', fu: o.waitFu }); raw += o.waitFu; }
    (o.melds || []).forEach(function (m) { if (m.fu > 0) { parts.push({ label: m.label, fu: m.fu }); raw += m.fu; } });
    var fu = fuFromRaw(raw);
    var note = '合計' + raw + '符 → 10符単位に切り上げて' + fu + '符';
    if (raw <= 20) note = '合計' + raw + '符 → 通常手は最低30符なので30符';
    else if (raw % 10 === 0) note = '合計' + raw + '符（ちょうど10符単位なのでそのまま）';
    return { raw: raw, fu: fu, special: '', parts: parts, note: note };
  }

  function basePoints(han, fu) {
    if (han < 1 || fu < 20) return { rawBase: 0, base: 0, limit: '' };
    var rawBase = fu * Math.pow(2, han + 2), base = rawBase, limit = '';
    if (han >= 13) { base = 8000; limit = 'yakuman'; }
    else if (han >= 11) { base = 6000; limit = 'sanbaiman'; }
    else if (han >= 8) { base = 4000; limit = 'baiman'; }
    else if (han >= 6) { base = 3000; limit = 'haneman'; }
    else if (han >= 5 || rawBase >= 2000) { base = 2000; limit = 'mangan'; }
    return { rawBase: rawBase, base: base, limit: limit };
  }

  function calculate(han, fu, method, dealer) {
    var b = basePoints(han, fu);
    var r = { han: han, fu: fu, method: method, dealer: dealer, rawBase: b.rawBase, base: b.base, limit: b.limit,
      ron: 0, dealerPay: 0, childPay: 0, total: 0 };
    if (b.base <= 0) return r;
    if (method === 'ron') { r.ron = roundUp100(b.base * (dealer ? 6 : 4)); r.total = r.ron; }
    else if (dealer) { r.childPay = r.dealerPay = roundUp100(b.base * 2); r.total = r.childPay * 3; }
    else { r.dealerPay = roundUp100(b.base * 2); r.childPay = roundUp100(b.base); r.total = r.dealerPay + r.childPay * 2; }
    return r;
  }

  function fmt(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var LIMIT_NAMES = { mangan: '満貫', haneman: '跳満', baiman: '倍満', sanbaiman: '三倍満', yakuman: '役満' };
  function limitName(l) { return LIMIT_NAMES[l] || ''; }

  function paymentText(han, fu, method, dealer) {
    var r = calculate(han, fu, method, dealer);
    if (r.base <= 0) return '—';
    if (method === 'ron') return fmt(r.ron) + '点';
    if (dealer) return fmt(r.dealerPay) + '点オール';
    return fmt(r.childPay) + '/' + fmt(r.dealerPay) + '点';
  }

  function equationLines(han, fu, method, dealer) {
    var r = calculate(han, fu, method, dealer), lines = [];
    if (r.base <= 0) return ['翻が0のため点数は成立しません（役が必要です）。'];
    lines.push('基本点 = ' + fu + '符 × 2^(' + han + '翻+2) = ' + fu + ' × ' + Math.pow(2, han + 2) + ' = ' + fmt(r.rawBase));
    if (r.limit) {
      var why = han >= 5 ? han + '翻なので' : '基本点が2,000を超えるので';
      lines.push(why + limitName(r.limit) + ' → 基本点 ' + fmt(r.base) + (han >= 5 ? '（符は無関係）' : ''));
    }
    if (method === 'ron') {
      var m = dealer ? 6 : 4;
      lines.push((dealer ? '親' : '子') + 'のロン：基本点 × ' + m + ' = ' + fmt(r.base * m) + ' → 100点単位に切り上げ ' + fmt(r.ron) + '点');
    } else if (dealer) {
      lines.push('親のツモ：子3人が 基本点 × 2 = ' + fmt(r.base * 2) + ' → 切り上げ ' + fmt(r.dealerPay) + '点ずつ（' + fmt(r.dealerPay) + '点オール、計' + fmt(r.total) + '点）');
    } else {
      lines.push('子のツモ：親は 基本点 × 2 = ' + fmt(r.base * 2) + ' → ' + fmt(r.dealerPay) + '点');
      lines.push('　　　　　子2人は 基本点 = ' + fmt(r.base) + ' → ' + fmt(r.childPay) + '点ずつ（' + fmt(r.childPay) + '/' + fmt(r.dealerPay) + '、計' + fmt(r.total) + '点）');
    }
    return lines;
  }

  // ---- 手牌の分解 ----
  function countsOf(tiles) {
    var c = new Array(34).fill(0);
    tiles.forEach(function (t) { c[parse(t)]++; });
    return c;
  }

  function decompose(counts) {
    var out = [], total = counts.reduce(function (a, b) { return a + b; }, 0);
    if (total !== 14) return out;
    var pairs = 0, chiitoi = true;
    counts.forEach(function (v) { if (v === 2) pairs++; else if (v !== 0) chiitoi = false; });
    if (chiitoi && pairs === 7) out.push({ chiitoi: true, pair: -1, groups: [] });
    for (var p = 0; p < 34; p++) {
      if (counts[p] < 2) continue;
      var rem = counts.slice(); rem[p] -= 2;
      search(rem, [], p, out);
    }
    return out;
  }
  function search(c, groups, pair, out) {
    var f = -1;
    for (var i = 0; i < 34; i++) if (c[i] > 0) { f = i; break; }
    if (f < 0) { if (groups.length === 4) out.push({ chiitoi: false, pair: pair, groups: groups.slice() }); return; }
    if (groups.length >= 4) return;
    if (c[f] >= 3) { c[f] -= 3; search(c, groups.concat([{ type: 'triplet', tile: f }]), pair, out); c[f] += 3; }
    if (f < 27 && f % 9 <= 6 && c[f + 1] > 0 && c[f + 2] > 0) {
      c[f]--; c[f + 1]--; c[f + 2]--;
      search(c, groups.concat([{ type: 'sequence', tile: f }]), pair, out);
      c[f]++; c[f + 1]++; c[f + 2]++;
    }
  }

  function pairInfo(pair, seat, round) {
    if (pair < 27) return { fu: 0, label: '' };
    var fu = 0, why = [];
    if (pair >= 31) { fu += 2; why.push('三元牌'); }
    if (pair === 27 + seat) { fu += 2; why.push('自風'); }
    if (pair === 27 + round) { fu += 2; why.push('場風'); }
    return { fu: fu, label: name(pair) + (why.length ? '・' + why.join('＋') : '') };
  }

  var WAIT_FU = { '両面': 0, '双碰': 0, '嵌張': 2, '辺張': 2, '単騎': 2 };

  /* 和了形を解析して符の候補を返す（役は判定しない）。
   * opts: {winTile, method:'ron'|'tsumo', closed:bool, seat:0-3, round:0-3,
   *        openTriplets:[tile], kans:[tile], waitOverride:'自動'|'両面'|...} */
  function analyze(tiles, opts) {
    if (tiles.length !== 14) return { valid: false, reason: '手牌を14枚にしてください（いま' + tiles.length + '枚）。', options: [] };
    var counts = countsOf(tiles);
    for (var i = 0; i < 34; i++) if (counts[i] > 4) return { valid: false, reason: '同じ牌は4枚までです。', options: [] };
    var win = opts.winTile == null ? -1 : parse(opts.winTile);
    if (win < 0 || counts[win] < 1) return { valid: false, reason: '和了牌（あがり牌）を手牌から1枚指定してください。', options: [] };
    var shapes = decompose(counts);
    if (!shapes.length) return { valid: false, reason: '和了形ではありません。4面子＋1雀頭、または七対子にしてください。', options: [] };
    var openT = (opts.openTriplets || []).map(parse), kans = (opts.kans || []).map(parse);
    var seat = opts.seat || 0, round = opts.round || 0, method = opts.method, closed = !!opts.closed;
    var override = opts.waitOverride && opts.waitOverride !== '自動' ? opts.waitOverride : null;
    var options = [];
    shapes.forEach(function (shape) {
      var locs = [];
      if (shape.chiitoi || shape.pair === win) locs.push({ kind: 'pair', gi: -1 });
      shape.groups.forEach(function (g, gi) {
        if (g.type === 'triplet' ? g.tile === win : (win >= g.tile && win <= g.tile + 2)) locs.push({ kind: g.type, gi: gi });
      });
      locs.forEach(function (loc) { options.push(scoreShape(shape, loc, win, method, closed, seat, round, openT, kans, override)); });
    });
    options.sort(function (a, b) { return b.fu - a.fu || b.raw - a.raw; });
    // 同じ結果の重複を除く
    var seen = {}, uniq = [];
    options.forEach(function (o) { var k = o.signature; if (!seen[k]) { seen[k] = 1; uniq.push(o); } });
    return { valid: true, reason: '', options: uniq, best: uniq[0] };
  }

  function scoreShape(shape, loc, win, method, closed, seat, round, openT, kans, override) {
    var waitName = '双碰';
    if (shape.chiitoi || loc.kind === 'pair') waitName = '単騎';
    else if (loc.kind === 'sequence') {
      var st = shape.groups[loc.gi].tile % 9, wr = win % 9;
      if (wr === st + 1) waitName = '嵌張';
      else if ((st === 0 && wr === 2) || (st === 6 && wr === 6)) waitName = '辺張';
      else waitName = '両面';
    }
    if (override) waitName = override;
    var waitFu = shape.chiitoi ? 0 : WAIT_FU[waitName];
    var groups = shape.groups.map(function (g, gi) {
      var o = { type: g.type, tile: g.tile, tiles: g.type === 'triplet' ? [g.tile, g.tile, g.tile] : [g.tile, g.tile + 1, g.tile + 2], fu: 0, label: '' };
      if (g.type === 'triplet') {
        var ronComplete = method === 'ron' && loc.kind === 'triplet' && loc.gi === gi && !override;
        var open = openT.indexOf(g.tile) >= 0 || ronComplete;
        var kan = kans.indexOf(g.tile) >= 0;
        var yao = isTerminalOrHonor(g.tile);
        var fu = (yao ? 4 : 2) * (open ? 1 : 2) * (kan ? 4 : 1);
        o.open = open; o.kan = kan; o.ronComplete = ronComplete; o.fu = fu;
        if (kan) o.tiles.push(g.tile);
        o.label = (open ? '明' : '暗') + (kan ? '槓' : '刻') + '・' + (yao ? '幺九/字牌' : '中張牌') + '（' + name(g.tile) + '）' + (ronComplete ? '※ロンで完成→明刻扱い' : '');
      }
      return o;
    });
    var pi = shape.chiitoi ? { fu: 0, label: '' } : pairInfo(shape.pair, seat, round);
    var pinfuShape = !shape.chiitoi && closed && groups.every(function (g) { return g.type === 'sequence'; }) && pi.fu === 0 && waitName === '両面';
    var pinfuTsumo = pinfuShape && method === 'tsumo';
    var fd = fuBreakdown({ method: method, closed: closed, pairFu: pi.fu, pairLabel: pi.label, waitFu: waitFu, waitName: waitName,
      melds: groups.filter(function (g) { return g.type === 'triplet'; }), pinfuTsumo: pinfuTsumo, chiitoi: shape.chiitoi });
    return { chiitoi: shape.chiitoi, pair: shape.pair, groups: groups, waitName: waitName, waitFu: waitFu, pinfuShape: pinfuShape,
      fu: fd.fu, raw: fd.raw, parts: fd.parts, note: fd.note, special: fd.special,
      signature: fd.fu + '|' + fd.raw + '|' + waitName + '|' + shape.pair + '|' + groups.map(function (g) { return g.type[0] + g.tile; }).join(',') };
  }

  // ---- v2 用：受け入れ・確率（移植済み、UI未使用）----
  function ukeire(tiles13, visible) {
    if (tiles13.length !== 13) return { tiles: [], total: 0 };
    var c = countsOf(tiles13), res = [], total = 0;
    for (var t = 0; t < 34; t++) {
      var remain = 4 - c[t] - ((visible && visible[t]) || 0);
      if (c[t] >= 4 || remain <= 0) continue;
      c[t]++;
      if (decompose(c).length) { res.push({ tile: t, remaining: remain }); total += remain; }
      c[t]--;
    }
    return { tiles: res, total: total };
  }
  function probabilityAtLeastOne(wall, outs, draws) {
    if (outs <= 0 || draws <= 0) return 0;
    if (outs >= wall || draws >= wall) return 1;
    var none = 1;
    for (var i = 0; i < draws; i++) none *= (wall - outs - i) / (wall - i);
    return 1 - none;
  }

  var Engine = { code: code, parse: parse, name: name, isTerminalOrHonor: isTerminalOrHonor, WINDS: WINDS,
    fuFromRaw: fuFromRaw, fuBreakdown: fuBreakdown, basePoints: basePoints, calculate: calculate,
    paymentText: paymentText, equationLines: equationLines, limitName: limitName, fmt: fmt,
    countsOf: countsOf, decompose: decompose, analyze: analyze, ukeire: ukeire, probabilityAtLeastOne: probabilityAtLeastOne };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine; else root.Engine = Engine;
})(this);
