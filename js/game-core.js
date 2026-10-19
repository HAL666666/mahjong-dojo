/* 牌の理 — 対局エンジン。UI から独立した純粋なロジック（Node でもテスト可能）。
 * 公平性：各局の開始時に crypto.getRandomValues による Fisher–Yates で牌山を一度だけシャッフルする。
 * 配牌・ツモの重み付けや、手牌を見た後の牌山操作は一切しない。CPU は自分の手牌と公開情報だけで判断する（js/cpu.js）。
 *
 * 牌ID：id = 種類(0..33) + 34 × コピー番号(0..3)。種類は id % 34。赤ドラ有効時はコピー3の5萬/5筒/5索（id 106/115/124）が赤。
 * 引数なしの newGame() は旧版互換のルール（東風戦・鳴きなし・赤なし・頭ハネ）。アプリは newGame(rules) で現行ルールを使う。 */
(function (root) {
  'use strict';
  var E = root.Engine || require('./engine.js');
  var Y = root.Yaku || require('./yaku.js');
  var NAMES = ['あなた', 'CPU 下家', 'CPU 対面', 'CPU 上家'];
  var ROUND = ['東', '南', '西', '北'];
  var RED_IDS = [106, 115, 124];
  var DEFAULT_RULES = { mode: 'hanchan', calls: true, aka: 3, doubleRon: true, westIn: false, agariYame: true, uma: '10-20', okaReturn: 30000, start: 25000 };
  var LEGACY_RULES = { mode: 'tonpuu', calls: false, aka: 0, doubleRon: false, westIn: false, agariYame: false, uma: 'off', okaReturn: 25000, start: 25000 };
  function T(id) { return id % 34; }
  function types(ids) { return ids.map(T); }

  // ---- 乱数（暗号論的乱数・剰余バイアスなし） ----
  function cryptoObj() { return (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : require('crypto').webcrypto; }
  function randInt(n) {
    var c = cryptoObj(), buf = new Uint32Array(1), limit = Math.floor(0x100000000 / n) * n;
    do { c.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  }
  function shuffledIds() {
    var w = []; for (var i = 0; i < 136; i++) w.push(i);
    for (var j = w.length - 1; j > 0; j--) { var k = randInt(j + 1), t = w[j]; w[j] = w[k]; w[k] = t; }
    return w;
  }
  function shuffledWall() { return types(shuffledIds()); } // 種類だけの牌山（テスト・表示用）

  function newGame(rules, extra) {
    var r = Object.assign({}, rules ? DEFAULT_RULES : LEGACY_RULES, rules || {});
    var s = { version: 2, rules: r, levels: (extra && extra.levels) || (rules ? ['hard', 'normal', 'normal', 'normal'] : ['easy', 'easy', 'easy', 'easy']),
      scores: [r.start, r.start, r.start, r.start], oya0: randInt(4), round: 0, kyoku: 0, honba: 0, kyotaku: 0, handNo: 0, phase: 'init', log: [], seq: 0 };
    startHand(s);
    return s;
  }
  function dealerOf(s) { return (s.oya0 + s.kyoku) % 4; }
  function seatWind(s, p) { return (p - dealerOf(s) + 4) % 4; }
  function isRed(s, id) { return s.rules.aka > 0 && RED_IDS.indexOf(id) >= 0; }
  function redCount(s, ids) { return ids.filter(function (id) { return isRed(s, id); }).length; }
  function lastRound(s) { return s.rules.mode === 'tonpuu' ? 0 : 1; }
  function roundName(s) { return ROUND[s.round] + (s.kyoku + 1) + '局'; }

  function startHand(s) {
    var wall = shuffledIds(); // この局で一度だけ
    s.dead = wall.slice(122);
    s.rinshanPile = s.dead.slice(0, 4);
    s.doraPile = s.dead.slice(4);
    s.deadExtra = [];
    s.live = wall.slice(0, 122);
    s.doraIndicators = [s.doraPile[0]];
    s.uraIndicators = [s.doraPile[1]];
    s.hands = [[], [], [], []]; s.melds = [[], [], [], []];
    var d = dealerOf(s);
    for (var r = 0; r < 3; r++) for (var i = 0; i < 4; i++) { var p = (d + i) % 4; for (var k = 0; k < 4; k++) s.hands[p].push(s.live.shift()); }
    for (var i2 = 0; i2 < 4; i2++) s.hands[(d + i2) % 4].push(s.live.shift());
    s.discards = [[], [], [], []];
    s.riichi = [false, false, false, false]; s.riichiSeq = [-1, -1, -1, -1]; s.doubleRiichi = [false, false, false, false];
    s.ippatsu = [false, false, false, false];
    s.furitenTemp = [false, false, false, false]; s.furitenRiichi = [false, false, false, false];
    s.firstDraw = [true, true, true, true];
    s.anyDiscard = false; s.anyCall = false; s.kanOwners = []; s.pao = [null, null, null, null];
    s.pending = null; s.result = null; s.handNo++; s.kuikae = null; s.rinshanFlag = false; s.abortAfterDiscard = null;
    s.hands.forEach(sortHand);
    draw(s, d);
  }
  function sortHand(h) { h.sort(function (a, b) { return T(a) - T(b) || a - b; }); }
  function removeType(h, t, n) { var out = []; for (var i = h.length - 1; i >= 0 && out.length < n; i--) if (T(h[i]) === t) out.push(h.splice(i, 1)[0]); return out; }
  function countType(h, t) { return h.filter(function (id) { return T(id) === t; }).length; }
  function meldTypes(m) { return types(m.ids); }
  function evalMelds(s, p) { return s.melds[p].map(function (m) { return { type: m.type, tiles: meldTypes(m) }; }); }
  function allIds(s, p) { var a = s.hands[p].slice(); s.melds[p].forEach(function (m) { a = a.concat(m.ids); }); return a; }
  function menzen(s, p) { return s.melds[p].every(function (m) { return m.type === 'ankan'; }); }

  function draw(s, p) {
    if (!s.live.length) return ryuukyoku(s);
    var t = s.live.shift();
    s.hands[p].push(t);
    s.drawn = t; s.turn = p; s.phase = 'turn'; s.kuikae = null; s.rinshanFlag = false;
  }

  function ctxFor(s, p, winTile, method, extra) {
    var dealer = dealerOf(s) === p;
    extra = extra || {};
    var ids = allIds(s, p).concat(method === 'ron' ? [winTile] : []);
    return { winTile: T(winTile), method: method, seat: seatWind(s, p), round: s.round, dealer: dealer, riichi: s.riichi[p], doubleRiichi: s.doubleRiichi[p],
      ippatsu: s.ippatsu[p], haitei: method === 'tsumo' && s.live.length === 0 && !s.rinshanFlag, houtei: method === 'ron' && s.live.length === 0 && !extra.chankan,
      rinshan: method === 'tsumo' && s.rinshanFlag, chankan: !!extra.chankan,
      tenhou: method === 'tsumo' && dealer && s.firstDraw[p] && !s.anyDiscard && !s.anyCall, chiihou: method === 'tsumo' && !dealer && s.firstDraw[p] && !s.anyCall,
      doraIndicators: types(s.doraIndicators), uraIndicators: types(s.uraIndicators), red: redCount(s, ids), honba: s.honba, kyotaku: s.kyotaku };
  }
  function evalHand(s, p, closedIds) { return { closed: types(closedIds), melds: evalMelds(s, p) }; }

  function tsumoResult(s, p) {
    if (s.phase !== 'turn' || s.turn !== p || s.drawn == null) return null;
    if (Y.shanten(Y.toCounts(s.hands[p]), s.melds[p].length) !== -1) return null;
    var r = Y.evaluate(evalHand(s, p, s.hands[p]), ctxFor(s, p, s.drawn, 'tsumo'));
    return r && r.valid ? r : null;
  }
  function waitsOf(s, p) { return Y.waits(s.hands[p], s.melds[p].length); }
  function isFuriten(s, p, w) {
    if (s.furitenTemp[p] || s.furitenRiichi[p]) return true;
    return s.discards[p].some(function (d) { return w.indexOf(T(d.t)) >= 0; });
  }
  function ronResult(s, p, tile, extra) {
    var w = waitsOf(s, p);
    if (w.indexOf(T(tile)) < 0 || isFuriten(s, p, w)) return null;
    var r = Y.evaluate(evalHand(s, p, s.hands[p].concat([tile])), ctxFor(s, p, tile, 'ron', extra));
    return r && r.valid ? r : null;
  }
  function riichiTiles(s, p) {
    if (s.riichi[p] || !menzen(s, p) || s.scores[p] < 1000 || s.live.length < 4 || s.phase !== 'turn' || s.turn !== p) return [];
    var h = s.hands[p], out = [], seen = {};
    for (var i = 0; i < h.length; i++) {
      if (seen[T(h[i])]) continue; seen[T(h[i])] = 1;
      var rest = h.slice(); rest.splice(i, 1);
      if (Y.shanten(Y.toCounts(rest), s.melds[p].length) === 0) out.push(h[i]);
    }
    return out;
  }
  function kanAllowed(s) {
    var total = s.kanOwners.length;
    return s.rules.calls && s.live.length > 0 && total < 4 && s.rinshanPile.length > 0;
  }
  function ankanOptions(s, p) {
    if (s.phase !== 'turn' || s.turn !== p || s.drawn == null || !kanAllowed(s)) return [];
    var c = Y.toCounts(s.hands[p]), out = [];
    for (var t = 0; t < 34; t++) {
      if (c[t] !== 4) continue;
      if (s.riichi[p]) { // 立直後：ツモ牌での暗槓かつ待ちが変わらない場合のみ
        if (T(s.drawn) !== t) continue;
        var before = Y.waits(s.hands[p].filter(function (id) { return id !== s.drawn; }), s.melds[p].length);
        var rest = s.hands[p].filter(function (id) { return T(id) !== t; });
        var after = Y.waits(rest, s.melds[p].length + 1);
        if (JSON.stringify(before) !== JSON.stringify(after) || !after.length) continue;
      }
      out.push(t);
    }
    return out;
  }
  function kakanOptions(s, p) {
    if (s.phase !== 'turn' || s.turn !== p || s.drawn == null || s.riichi[p] || !kanAllowed(s)) return [];
    return s.melds[p].filter(function (m) { return m.type === 'pon' && countType(s.hands[p], T(m.ids[0])) > 0; }).map(function (m) { return T(m.ids[0]); });
  }
  function kyuushuOk(s, p) {
    if (s.phase !== 'turn' || s.turn !== p || !s.firstDraw[p] || s.anyCall) return false;
    var c = Y.toCounts(s.hands[p]);
    return [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33].filter(function (t) { return c[t] > 0; }).length >= 9;
  }
  function discardable(s, p) {
    var h = s.hands[p];
    if (s.riichi[p] && s.drawn != null) return [s.drawn];
    var ban = s.kuikae || [], out = [], seen = {};
    h.forEach(function (id) { var key = id; if (ban.indexOf(T(id)) >= 0 || seen[key]) return; seen[key] = 1; out.push(id); });
    return out;
  }
  // 鳴きの候補（打牌 id に対して player q）
  // 喰い替え禁止の牌（called：鳴いた牌、a<b：手牌から出す2枚）
  function kuikaeBan(called, a, b) {
    var ban = [called];
    if (b === a + 1) {
      if (called === a - 1 && b % 9 !== 8) ban.push(b + 1);      // 例：3萬で[45]チー → 6萬も禁止
      if (called === b + 1 && a % 9 !== 0) ban.push(a - 1);      // 例：6萬で[45]チー → 3萬も禁止
    }
    return ban;
  }
  function callOptions(s, q, id) {
    var o = { pon: false, minkan: false, chi: [] };
    if (!s.rules.calls || s.riichi[q] || !s.live.length) return o;
    var t = T(id), h = s.hands[q], n = countType(h, t), from = s.pending.from;
    function leaves(banned, removeTypes) { // 鳴いた後に打てる牌が残るか
      var rest = h.slice(); removeTypes.forEach(function (rt) { var i = rest.findIndex(function (x) { return T(x) === rt; }); rest.splice(i, 1); });
      return rest.some(function (x) { return banned.indexOf(T(x)) < 0; });
    }
    if (n >= 2 && leaves([t], [t, t])) o.pon = true;
    if (n >= 3 && kanAllowed(s)) o.minkan = true;
    if (q === (from + 1) % 4 && t < 27) {
      var r = t % 9;
      [[-2, -1], [-1, 1], [1, 2]].forEach(function (d) {
        var a = t + d[0], b = t + d[1];
        if (r + d[0] < 0 || r + d[1] > 8) return;
        var ia = h.filter(function (x) { return T(x) === a; }), ib = h.filter(function (x) { return T(x) === b; });
        if (!ia.length || !ib.length) return;
        if (!leaves(kuikaeBan(t, a, b), [a, b])) return;
        // 赤ドラの有無で選択肢を分ける
        var pa = ia.some(function (x) { return isRed(s, x); }) && ia.some(function (x) { return !isRed(s, x); }) ? [ia.find(function (x) { return isRed(s, x); }), ia.find(function (x) { return !isRed(s, x); })] : [ia[0]];
        var pb = ib.some(function (x) { return isRed(s, x); }) && ib.some(function (x) { return !isRed(s, x); }) ? [ib.find(function (x) { return isRed(s, x); }), ib.find(function (x) { return !isRed(s, x); })] : [ib[0]];
        pa.forEach(function (x) { pb.forEach(function (y) { o.chi.push([x, y]); }); });
      });
    }
    return o;
  }
  function legal(s, p) {
    var a = { discard: [], riichi: [], tsumo: false, ron: false, ankan: [], kakan: [], kyuushu: false, pon: false, minkan: false, chi: [] };
    if (s.phase === 'turn' && s.turn === p) {
      a.tsumo = !!tsumoResult(s, p);
      a.discard = discardable(s, p);
      a.riichi = riichiTiles(s, p);
      a.ankan = ankanOptions(s, p); a.kakan = kakanOptions(s, p); a.kyuushu = kyuushuOk(s, p);
    } else if (s.phase === 'ron' && s.pending && s.pending.waiting === p) a.ron = true;
    else if (s.phase === 'call' && s.pending && s.pending.waiting === p) { var c = s.pending.callOpts[p]; a.pon = c.pon; a.minkan = c.minkan; a.chi = c.chi; }
    return a;
  }

  // ---- 行動 ----
  function act(s, p, action) {
    var ty = action.type;
    if (ty === 'next') { if (s.phase === 'handEnd') nextHand(s); return true; }
    if (s.phase === 'turn') {
      if (s.turn !== p) return false;
      if (ty === 'skip') return true;
      if (ty === 'tsumo') { var r = tsumoResult(s, p); if (!r) return false; settleWins(s, [{ p: p, r: r }], null, 'tsumo', s.drawn); return true; }
      if (ty === 'kyuushu') { if (!kyuushuOk(s, p)) return false; abort(s, '九種九牌'); return true; }
      if (ty === 'ankan') return doAnkan(s, p, T(action.tile));
      if (ty === 'kakan') return doKakan(s, p, T(action.tile));
      if (ty === 'discard') return doDiscard(s, p, action.tile, !!action.riichi);
      return false;
    }
    if (s.phase === 'ron') {
      if (!s.pending || s.pending.waiting !== p) return false;
      if (ty === 'ron') {
        var rr = ronResult(s, p, s.pending.tile, { chankan: s.pending.kind === 'kakan' });
        if (!rr) return false;
        s.pending.ronners.push({ p: p, r: rr });
        if (!s.rules.doubleRon) { s.pending.ronQueue = []; return resolveRon(s); } // 頭ハネ
      } else if (ty === 'skip') {
        s.furitenTemp[p] = true; if (s.riichi[p]) s.furitenRiichi[p] = true;
      } else return false;
      s.pending.ronQueue.shift();
      if (s.pending.ronQueue.length) { s.pending.waiting = s.pending.ronQueue[0]; return true; }
      return resolveRon(s);
    }
    if (s.phase === 'call') {
      if (!s.pending || s.pending.waiting !== p) return false;
      var co = s.pending.callOpts[p];
      if (ty === 'pon' && co.pon) return doPon(s, p);
      if (ty === 'minkan' && co.minkan) return doMinkan(s, p);
      if (ty === 'chi') {
        var ok = co.chi.some(function (c) { return (c[0] === action.tiles[0] && c[1] === action.tiles[1]) || (T(c[0]) === T(action.tiles[0]) && T(c[1]) === T(action.tiles[1])); });
        if (!ok) return false;
        return doChi(s, p, action.tiles);
      }
      if (ty === 'skip') {
        s.pending.callQueue.shift();
        if (s.pending.callQueue.length) { s.pending.waiting = s.pending.callQueue[0]; return true; }
        finishDiscard(s); return true;
      }
      return false;
    }
    return false;
  }

  function doDiscard(s, p, tile, declaring) {
    var h = s.hands[p], idx = h.indexOf(tile);
    if (idx < 0) idx = h.findIndex(function (x) { return T(x) === T(tile) && !isRed(s, x); });
    if (idx < 0) idx = h.findIndex(function (x) { return T(x) === T(tile); });
    if (idx < 0) return false;
    var id = h[idx];
    if (s.riichi[p] && id !== s.drawn) return false;
    if (s.kuikae && s.kuikae.indexOf(T(id)) >= 0) return false;
    if (declaring && riichiTiles(s, p).map(T).indexOf(T(id)) < 0) return false;
    if (s.riichi[p]) s.ippatsu[p] = false;
    var tsumogiri = id === s.drawn;
    h.splice(idx, 1); sortHand(h);
    if (declaring) { s.riichi[p] = true; s.ippatsu[p] = true; s.riichiSeq[p] = s.seq; s.doubleRiichi[p] = s.firstDraw[p] && !s.anyCall; }
    s.discards[p].push({ t: id, riichi: declaring, tsumogiri: tsumogiri, seq: s.seq++ });
    s.firstDraw[p] = false; s.anyDiscard = true; s.drawn = null; s.kuikae = null; s.rinshanFlag = false;
    if (!s.riichi[p] || declaring) s.furitenTemp[p] = false;
    s.pending = { tile: id, from: p, kind: 'discard', riichi: declaring, ronQueue: [], ronners: [], callQueue: [], callOpts: {}, waiting: null };
    collectRon(s, p, id, false);
    if (s.pending.ronQueue.length) { s.phase = 'ron'; s.pending.waiting = s.pending.ronQueue[0]; return true; }
    proceedCalls(s); return true;
  }
  function collectRon(s, p, id, chankan) {
    for (var k = 1; k < 4; k++) {
      var q = (p + k) % 4, w = waitsOf(s, q);
      if (w.indexOf(T(id)) < 0) continue;
      if (ronResult(s, q, id, { chankan: chankan })) s.pending.ronQueue.push(q);
      else { s.furitenTemp[q] = true; if (s.riichi[q]) s.furitenRiichi[q] = true; }
    }
  }
  function resolveRon(s) {
    var pd = s.pending;
    if (pd.ronners.length) {
      if (pd.ronners.length === 3) { abort(s, '三家和'); return true; }
      if (pd.kind === 'discard' && pd.riichi) { /* 立直宣言牌でのロン：立直不成立（供託なし） */ }
      settleWins(s, pd.ronners, pd.from, 'ron', pd.tile);
      return true;
    }
    if (pd.kind === 'kakan') { completeKakan(s, pd.from, pd.tile); return true; }
    proceedCalls(s); return true;
  }
  function proceedCalls(s) {
    var pd = s.pending, p = pd.from, id = pd.tile;
    pd.callQueue = []; pd.callOpts = {};
    if (s.rules.calls && s.live.length) {
      var ponner = null, chier = null;
      for (var k = 1; k < 4; k++) {
        var q = (p + k) % 4, o = callOptions(s, q, id);
        pd.callOpts[q] = o;
        if (o.pon || o.minkan) ponner = q;
        if (o.chi.length) chier = q;
      }
      if (ponner != null) pd.callQueue.push(ponner);
      if (chier != null && chier !== ponner) pd.callQueue.push(chier);
    }
    if (pd.callQueue.length) { s.phase = 'call'; pd.waiting = pd.callQueue[0]; return; }
    finishDiscard(s);
  }
  function establishRiichi(s, pd) {
    if (pd.riichi) { s.scores[pd.from] -= 1000; s.kyotaku++; pd.riichi = false; }
  }
  function finishDiscard(s) {
    var pd = s.pending;
    establishRiichi(s, pd);
    s.pending = null;
    if (s.riichi.every(Boolean)) return abort(s, '四家立直');
    if (!s.anyCall && s.discards.every(function (d) { return d.length === 1; })) {
      var w = T(s.discards[0][0].t);
      if (w >= 27 && w <= 30 && s.discards.every(function (d) { return T(d[0].t) === w; })) return abort(s, '四風連打');
    }
    if (s.abortAfterDiscard) return abort(s, s.abortAfterDiscard);
    draw(s, (pd.from + 1) % 4);
  }
  function takeCalled(s) {
    var pd = s.pending, d = s.discards[pd.from];
    d[d.length - 1].called = true;
    establishRiichi(s, pd);
    s.anyCall = true; s.ippatsu = [false, false, false, false];
    s.firstDraw = [false, false, false, false];
    return pd;
  }
  function checkPao(s, q, from) {
    var trip = s.melds[q].filter(function (m) { return m.type !== 'chi'; }).map(function (m) { return T(m.ids[0]); });
    var dragons = trip.filter(function (t) { return t >= 31; }).length, winds = trip.filter(function (t) { return t >= 27 && t <= 30; }).length;
    if (dragons === 3 && !s.pao[q]) s.pao[q] = { yaku: '大三元', liable: from };
    if (winds === 4 && (!s.pao[q] || s.pao[q].yaku !== '大四喜')) s.pao[q] = { yaku: '大四喜', liable: from };
  }
  function doPon(s, q) {
    var pd = takeCalled(s), t = T(pd.tile), own = removeType(s.hands[q], t, 2);
    s.melds[q].push({ type: 'pon', ids: own.concat([pd.tile]), from: pd.from, called: pd.tile });
    checkPao(s, q, pd.from);
    s.pending = null; s.turn = q; s.phase = 'turn'; s.drawn = null; s.kuikae = [t]; s.rinshanFlag = false;
    return true;
  }
  function doChi(s, q, tiles) {
    var pd = takeCalled(s), h = s.hands[q], own = [];
    tiles.forEach(function (want) { var i = h.indexOf(want); if (i < 0) i = h.findIndex(function (x) { return T(x) === T(want); }); own.push(h.splice(i, 1)[0]); });
    var a = Math.min(T(own[0]), T(own[1])), b = Math.max(T(own[0]), T(own[1]));
    s.melds[q].push({ type: 'chi', ids: own.concat([pd.tile]), from: pd.from, called: pd.tile });
    s.pending = null; s.turn = q; s.phase = 'turn'; s.drawn = null; s.kuikae = kuikaeBan(T(pd.tile), a, b); s.rinshanFlag = false;
    return true;
  }
  function doMinkan(s, q) {
    var pd = takeCalled(s), t = T(pd.tile), own = removeType(s.hands[q], t, 3);
    s.melds[q].push({ type: 'minkan', ids: own.concat([pd.tile]), from: pd.from, called: pd.tile });
    checkPao(s, q, pd.from);
    s.pending = null;
    kanDraw(s, q);
    return true;
  }
  function doAnkan(s, p, t) {
    if (ankanOptions(s, p).indexOf(t) < 0) return false;
    var own = removeType(s.hands[p], t, 4);
    s.melds[p].push({ type: 'ankan', ids: own, from: p, called: null });
    s.anyCall = true; s.ippatsu = [false, false, false, false];
    s.firstDraw = [false, false, false, false];
    kanDraw(s, p);
    return true;
  }
  function doKakan(s, p, t) {
    if (kakanOptions(s, p).indexOf(t) < 0) return false;
    var id = s.hands[p].find(function (x) { return T(x) === t; }); // 槍槓の確認が終わるまで手牌に残す（牌の保存則）
    // 槍槓の確認
    s.pending = { tile: id, from: p, kind: 'kakan', riichi: false, ronQueue: [], ronners: [], callQueue: [], callOpts: {}, waiting: null };
    collectRon(s, p, id, true);
    if (s.pending.ronQueue.length) { s.phase = 'ron'; s.pending.waiting = s.pending.ronQueue[0]; return true; }
    completeKakan(s, p, id); return true;
  }
  function completeKakan(s, p, id) {
    var i = s.hands[p].indexOf(id); if (i >= 0) s.hands[p].splice(i, 1);
    s.drawn = null;
    var m = s.melds[p].find(function (x) { return x.type === 'pon' && T(x.ids[0]) === T(id); });
    m.type = 'kakan'; m.ids.push(id);
    s.pending = null; s.anyCall = true; s.ippatsu = [false, false, false, false];
    kanDraw(s, p);
  }
  function kanDraw(s, p) {
    s.kanOwners.push(p);
    // カンドラ・カン裏は即めくり（即乗り）
    var k = s.kanOwners.length;
    if (s.doraPile[2 * k] != null) { s.doraIndicators.push(s.doraPile[2 * k]); s.uraIndicators.push(s.doraPile[2 * k + 1]); }
    if (s.live.length) s.deadExtra.push(s.live.pop()); // 王牌を14枚に保つ（海底側から1枚補充）
    var id = s.rinshanPile.shift();
    s.hands[p].push(id); s.drawn = id; s.turn = p; s.phase = 'turn'; s.kuikae = null; s.rinshanFlag = true;
    var owners = {}; s.kanOwners.forEach(function (o) { owners[o] = 1; });
    if (s.kanOwners.length === 4 && Object.keys(owners).length > 1) s.abortAfterDiscard = '四槓散了';
  }

  // ---- 精算 ----
  function settleWins(s, wins, from, method, winTile) {
    var d = dealerOf(s), deltas = [0, 0, 0, 0], hb = s.honba, details = [];
    // 本場・供託は放銃者から見て一番近い和了者（上家取り）
    wins.sort(function (a, b) { return ((a.p - (from == null ? a.p : from) + 4) % 4) - ((b.p - (from == null ? b.p : from) + 4) % 4); });
    wins.forEach(function (w, wi) {
      var r = w.r, c = r.calc, dl = [0, 0, 0, 0], first = wi === 0, hbHere = first ? hb : 0;
      var pao = s.pao[w.p] && r.yaku.some(function (y) { return y.name === s.pao[w.p].yaku; }) ? s.pao[w.p] : null;
      if (method === 'ron') {
        var pay = c.total + hbHere * 300;
        if (pao && pao.liable !== from) { var half = Math.round(c.total / 2 / 100) * 100; dl[from] -= c.total - half + hbHere * 300; dl[pao.liable] -= half; }
        else dl[from] -= pay;
        dl[w.p] += pay;
      } else if (pao) {
        var all = c.total + hbHere * 300; dl[pao.liable] -= all; dl[w.p] += all;
      } else {
        for (var q = 0; q < 4; q++) {
          if (q === w.p) continue;
          var amt = (w.p === d ? c.dealerPay : (q === d ? c.dealerPay : c.childPay)) + hbHere * 100;
          dl[q] -= amt; dl[w.p] += amt;
        }
      }
      if (first) dl[w.p] += s.kyotaku * 1000;
      for (var i = 0; i < 4; i++) deltas[i] += dl[i];
      var hand = s.hands[w.p].slice(); if (method === 'ron') hand.push(winTile);
      details.push({ winner: w.p, hand: hand, melds: s.melds[w.p].map(function (m) { return { type: m.type, ids: m.ids.slice(), called: m.called }; }),
        yaku: r.yaku, han: r.han, fu: r.fu, yakuman: r.yakuman, opt: r.opt, calc: c, deltas: dl, honba: hbHere, kyotaku: first ? s.kyotaku : 0,
        dealer: w.p === d, ura: s.riichi[w.p] ? s.uraIndicators.slice() : [], pao: pao });
    });
    for (var i2 = 0; i2 < 4; i2++) s.scores[i2] += deltas[i2];
    var f = details[0];
    s.result = Object.assign({ type: 'win', from: from, method: method, winTile: winTile, wins: details, scores: s.scores.slice() }, f, { deltas: deltas });
    s.kyotaku = 0;
    var dealerWon = wins.some(function (w) { return w.p === d; });
    s.log.push({ hand: s.handNo, type: 'win', winners: wins.map(function (w) { return w.p; }), from: from, method: method, gains: wins.map(function (w, i) { return details[i].deltas[w.p]; }) });
    advance(s, dealerWon, dealerWon ? 'dealerWin' : 'win');
  }
  function ryuukyoku(s) {
    var d = dealerOf(s), ten = [0, 1, 2, 3].map(function (p) { return Y.shanten(Y.toCounts(s.hands[p]), s.melds[p].length) === 0; });
    var n = ten.filter(Boolean).length, deltas = [0, 0, 0, 0];
    if (n > 0 && n < 4) for (var p = 0; p < 4; p++) deltas[p] = ten[p] ? 3000 / n : -3000 / (4 - n);
    for (var i = 0; i < 4; i++) s.scores[i] += deltas[i];
    s.result = { type: 'draw', tenpai: ten, deltas: deltas, scores: s.scores.slice(), hands: s.hands.map(function (h) { return h.slice(); }) };
    s.log.push({ hand: s.handNo, type: 'draw', tenpai: ten });
    s.drawn = null;
    advance(s, ten[d], ten[d] ? 'dealerTenpai' : 'draw', true);
  }
  function abort(s, reason) {
    var pd = s.pending; if (pd && reason !== '三家和') establishRiichi(s, pd);
    s.result = { type: 'abort', reason: reason, deltas: [0, 0, 0, 0], scores: s.scores.slice(), hands: s.hands.map(function (h) { return h.slice(); }) };
    s.log.push({ hand: s.handNo, type: 'abort', reason: reason });
    s.drawn = null;
    advance(s, true, 'abort', true);
  }
  function advance(s, dealerStays, why, honbaUp) {
    var wasAllLast = s.round >= lastRound(s) && s.kyoku === 3;
    var d = dealerOf(s);
    if (dealerStays) s.honba++;
    else { s.honba = honbaUp ? s.honba + 1 : 0; s.kyoku++; if (s.kyoku === 4) { s.kyoku = 0; s.round++; } }
    s.phase = 'handEnd'; s.pending = null;
    // 終了判定
    var end = null, rk = ranking(s), top = Math.max.apply(null, s.scores), L = lastRound(s);
    if (s.scores.some(function (x) { return x < 0; })) end = 'トビ終了';
    else if (s.handNo >= 60) end = '局数上限';
    else if (s.rules.agariYame && wasAllLast && s.round <= L && (why === 'dealerWin' || why === 'dealerTenpai') && rk[0] === d) end = why === 'dealerWin' ? 'オーラス親の和了やめ' : 'オーラス親のテンパイやめ';
    else if (s.round > L) {
      if (!s.rules.westIn) end = '規定局数終了';
      else if (top >= s.rules.okaReturn) end = s.round === L + 1 && s.kyoku === 0 && wasAllLast ? '規定局数終了' : '西入後の終了（30000点到達）';
      else if (s.round > L + 1) end = '延長戦終了';
    }
    s.endReason = end;
  }
  function nextHand(s) {
    if (s.endReason) {
      // 終局時に残った供託はトップが受け取る（ウマ・オカの合計を0にするため）
      var rk0 = ranking(s); s.leftoverKyotaku = s.kyotaku; if (s.kyotaku) { s.scores[rk0[0]] += s.kyotaku * 1000; s.kyotaku = 0; }
      s.phase = 'gameEnd'; s.ranking = ranking(s); s.final = finalPoints(s); return;
    }
    startHand(s);
  }
  function ranking(s) {
    return [0, 1, 2, 3].sort(function (a, b) { return s.scores[b] - s.scores[a] || ((a - s.oya0 + 4) % 4) - ((b - s.oya0 + 4) % 4); });
  }
  var UMA = { 'off': [0, 0, 0, 0], '5-10': [10, 5, -5, -10], '10-20': [20, 10, -10, -20], '10-30': [30, 10, -10, -30] };
  function finalPoints(s) {
    var rk = ranking(s), uma = UMA[s.rules.uma] || UMA.off, ret = s.rules.okaReturn, oka = (ret - s.rules.start) * 4 / 1000, out = [0, 0, 0, 0];
    rk.forEach(function (p, i) { out[p] = Math.round(((s.scores[p] - ret) / 1000 + uma[i] + (i === 0 ? oka : 0)) * 10) / 10; });
    return { points: out, uma: uma, oka: oka, ret: ret, enabled: s.rules.uma !== 'off' };
  }

  // ---- 公開情報（CPU・解説用）----
  function publicView(s, p) {
    return { me: p, hand: s.hands[p].slice(), drawn: s.turn === p ? s.drawn : null, riichiMe: s.riichi[p], phase: s.phase,
      melds: s.melds.map(function (ms) { return ms.map(function (m) { return { type: m.type, ids: m.ids.slice(), from: m.from }; }); }),
      discards: s.discards.map(function (d) { return d.map(function (x) { return { t: x.t, riichi: x.riichi, called: !!x.called, seq: x.seq }; }); }),
      riichi: s.riichi.slice(), riichiSeq: s.riichiSeq.slice(), doraIndicators: s.doraIndicators.slice(), liveCount: s.live.length, scores: s.scores.slice(),
      dealer: dealerOf(s), seat: seatWind(s, p), round: s.round, honba: s.honba, kuikae: s.kuikae ? s.kuikae.slice() : null,
      pendingTile: s.pending ? s.pending.tile : null, pendingFrom: s.pending ? s.pending.from : null, aka: s.rules.aka,
      legal: legal(s, p) };
  }
  function visibleCounts(v) {
    var c = Y.toCounts(v.hand);
    v.discards.forEach(function (d) { d.forEach(function (x) { if (!x.called) c[T(x.t)]++; }); });
    v.melds.forEach(function (ms) { ms.forEach(function (m) { m.ids.forEach(function (id) { c[T(id)]++; }); }); });
    v.doraIndicators.forEach(function (t) { c[T(t)]++; });
    return c;
  }
  function cpuDecide(v, level) { var C = root.CPU || require('./cpu.js'); return C.decide(v, level || 'normal'); }
  function autoStep(s, humanAuto) {
    var who = s.phase === 'turn' ? s.turn : (s.phase === 'ron' || s.phase === 'call') ? s.pending.waiting : null;
    if (who == null) return false;
    if (who === 0 && !humanAuto) return false;
    var lv = s.levels[who] || 'normal';
    var a = cpuDecide(publicView(s, who), lv);
    if (act(s, who, a)) return true;
    // 念のため：不正な判断は安全な既定行動へ
    if (s.phase === 'turn') return act(s, who, { type: 'discard', tile: discardable(s, who)[0] });
    return act(s, who, { type: 'skip' });
  }
  // 牌の保存則チェック（テスト用）
  function tileCount(s) {
    var n = s.live.length + s.rinshanPile.length + s.doraPile.length + s.deadExtra.length;
    for (var p = 0; p < 4; p++) { n += s.hands[p].length; s.melds[p].forEach(function (m) { n += m.ids.length; }); n += s.discards[p].filter(function (d) { return !d.called; }).length; }
    return n;
  }

  // 保存データが現行版で再開できるか（旧版の対局は破棄して案内を出す）
  function canResume(st) { return !!(st && st.version === 2 && st.rules && st.melds && st.phase && st.phase !== 'gameEnd'); }

  var api = { canResume: canResume, NAMES: NAMES, ROUND: ROUND, DEFAULT_RULES: DEFAULT_RULES, newGame: newGame, startHand: startHand, act: act, legal: legal, dealerOf: dealerOf, seatWind: seatWind,
    publicView: publicView, cpuDecide: cpuDecide, autoStep: autoStep, visibleCounts: visibleCounts, tsumoResult: tsumoResult, riichiTiles: riichiTiles,
    ranking: ranking, finalPoints: finalPoints, randInt: randInt, shuffledWall: shuffledWall, shuffledIds: shuffledIds, isRed: isRed, T: T, roundName: roundName,
    callOptions: callOptions, kuikaeBan: kuikaeBan, tileCount: tileCount, waitsOf: waitsOf, UMA: UMA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GameCore = api;
})(this);
