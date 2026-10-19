/* 牌の理 — 対局画面（東風戦／半荘戦・鳴きあり） */
(function (root) {
  'use strict';
  var G = root.GameCore, Y = root.Yaku, E = root.Engine, C = root.CPU;
  var KEY = 'dojo.game', OPT_KEY = 'dojo.gameOpts';
  var WIND = ['東', '南', '西', '北'];
  var LEVEL_NAMES = { easy: '初級', normal: '中級', hard: '上級' };
  var state = null, sel = null, riichiMode = false, timer = null, active = false, migrated = false, kanPick = false;
  var opts = Object.assign({ explain: false, cpuLevel: 'normal', callConfirm: true,
    rules: { mode: 'hanchan', aka: 3, doubleRon: true, westIn: false, uma: '10-20', agariYame: true } }, load(OPT_KEY) || {});
  opts.rules = Object.assign({ mode: 'hanchan', aka: 3, doubleRon: true, westIn: false, uma: '10-20', agariYame: true }, opts.rules || {});
  var q = new URLSearchParams(location.search);
  var ap = q.get('autoplay') || '';
  var auto = ap === 'hand' ? 'hand' : ap.indexOf('until:') === 0 ? 'until' : ap ? 'full' : 'off';
  var until = ap.indexOf('until:') === 0 ? ap.slice(6) : null;
  var DELAY = auto === 'off' ? 450 : 12;
  if (q.get('explain')) opts.explain = true;
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save() { try { if (state) localStorage.setItem(KEY, JSON.stringify(state)); else localStorage.removeItem(KEY); localStorage.setItem(OPT_KEY, JSON.stringify(opts)); } catch (e) {} }
  function $(s) { return document.querySelector(s); }
  function U() { return root.DojoUI; }
  function T(id, o) { o = o || {}; if (state && typeof id === 'number' && G.isRed(state, id)) o.red = true; return U().tile(id, o); }
  function fmt(n) { return (n > 0 ? '+' : '') + E.fmt(n); }
  function nm(p) { return G.NAMES[p]; }

  // 保存データの移行：旧版（v1：鳴きなし）の対局は再開できないため破棄して案内する
  try {
    var raw = load(KEY);
    if (raw && raw.version === 2 && (G.canResume(raw) || raw.phase === 'gameEnd')) state = raw;
    else { migrated = !!raw; state = null; }
  } catch (e) { state = null; migrated = true; }
  if (state === null) save();

  function newGame() {
    var lv = opts.cpuLevel || 'normal';
    state = G.newGame(Object.assign({}, G.DEFAULT_RULES, opts.rules), { levels: ['hard', lv, lv, lv] });
    migrated = false; sel = null; riichiMode = false; kanPick = false;
  }
  function show() {
    active = true;
    if (auto !== 'off' && (!state || state.phase === 'gameEnd')) newGame();
    loop();
  }
  function hide() { active = false; clearTimeout(timer); }

  // ---------- 進行 ----------
  function stopAuto() { auto = 'off'; DELAY = 450; }
  function untilHit(s) {
    if (!until) return false;
    if (until === 'call') return s.phase === 'call' && s.pending.waiting === 0;
    if (until === 'danger') return s.phase === 'turn' && s.turn === 0 && !s.riichi[0] && s.riichi.some(Boolean) && s.drawn != null;
    if (until === 'melds') return s.phase === 'turn' && s.turn === 0 && s.melds[0].length > 0 && s.melds.filter(function (m) { return m.length; }).length >= 2;
    if (until === 'openwin') return s.phase === 'handEnd' && s.result.type === 'win' && s.result.wins.some(function (w) { return w.melds.some(function (m) { return m.type !== 'ankan'; }) && !w.yakuman; });
    if (until === 'openyaku') return s.phase === 'handEnd' && s.result.type === 'win' && s.result.wins.some(function (w) { return w.melds.some(function (m) { return m.type !== 'ankan'; }) && !w.yakuman && w.yaku.some(function (y) { return ['混一色', '清一色', '一気通貫', '三色同順', '混全帯幺九', '純全帯幺九', '対々和'].indexOf(y.name) >= 0; }); });
    return false;
  }
  function loop() {
    clearTimeout(timer);
    if (state && auto === 'until' && untilHit(state)) { stopAuto(); if (until === 'danger') opts.explain = true; }
    render(); save();
    if (!active || !state) return;
    var s = state, humanAuto = auto !== 'off';
    if (s.phase === 'turn' || s.phase === 'ron' || s.phase === 'call') {
      var who = s.phase === 'turn' ? s.turn : s.pending.waiting;
      if (who !== 0 || humanAuto) { timer = setTimeout(function () { G.autoStep(s, humanAuto); loop(); }, DELAY); return; }
      // 人間：鳴きの確認を出さない設定なら自動でスルー
      if (s.phase === 'call' && !opts.callConfirm) { timer = setTimeout(function () { G.act(s, 0, { type: 'skip' }); loop(); }, 10); return; }
      // 立直後はツモ和了・暗槓がなければ自動ツモ切り
      if (s.phase === 'turn' && s.riichi[0]) {
        var L = G.legal(s, 0);
        if ((!L.tsumo || s._noTsumo) && !L.ankan.length) timer = setTimeout(function () { s._noTsumo = false; G.act(s, 0, { type: 'discard', tile: s.drawn }); loop(); }, 600);
      }
    } else if (s.phase === 'gameEnd' && auto === 'until') {
      timer = setTimeout(function () { newGame(); loop(); }, 200);
    } else if (s.phase === 'handEnd' && (auto === 'full' || auto === 'until')) {
      timer = setTimeout(function () { G.act(s, 0, { type: 'next' }); loop(); }, 200);
    }
  }
  function humanAct(a) { if (!state) return; state._noTsumo = false; sel = null; riichiMode = false; kanPick = false; if (G.act(state, 0, a)) loop(); else render(); }

  // ---------- 描画 ----------
  function backTiles(n) { return '<span class="backs">' + new Array(n + 1).join('<i></i>') + '</span>'; }
  function pond(p, cls) {
    return '<div class="pond ' + (cls || '') + '">' + state.discards[p].map(function (d) {
      return '<span class="pw' + (d.riichi ? ' rot' : '') + (d.called ? ' called' : '') + '">' + T(d.t) + '</span>';
    }).join('') + '</div>';
  }
  // 副露：鳴いた牌を横向きに。上家から→左、対面→中央、下家→右（暗槓は両端を伏せる）
  function meldHTML(p, m) {
    var rel = (m.from - p + 4) % 4; // 1=下家, 2=対面, 3=上家
    if (m.type === 'ankan') return '<span class="meld">' + '<span class="tback"></span>' + T(m.ids[1]) + T(m.ids[2]) + '<span class="tback"></span></span>';
    var own = m.ids.filter(function (id) { return id !== m.called; });
    if (m.type === 'chi') own.sort(function (a, b) { return a % 34 - b % 34; });
    var calledHTML = '<span class="rotw">' + T(m.called, { rot: true }) + (m.type === 'kakan' ? T(own.pop(), { rot: true, cls: 'stack' }) : '') + '</span>';
    var parts = own.map(function (id) { return T(id); });
    var pos = rel === 3 ? 0 : rel === 2 ? 1 : parts.length;
    parts.splice(pos, 0, calledHTML);
    return '<span class="meld">' + parts.join('') + '</span>';
  }
  function melds(p) { return state.melds[p].length ? '<div class="melds">' + state.melds[p].map(function (m) { return meldHTML(p, m); }).join('') + '</div>' : ''; }
  function head(p) {
    var s = state, d = G.dealerOf(s);
    var lv = p ? '<small class="lv">' + (LEVEL_NAMES[s.levels[p]] || '') + '</small>' : '';
    return '<div class="ph' + (s.turn === p && s.phase === 'turn' ? ' on' : '') + '"><b>' + WIND[G.seatWind(s, p)] + '</b>' + (p === d ? '<em>親</em>' : '') +
      '<span>' + nm(p).replace('CPU ', '') + lv + '</span><span class="sc">' + E.fmt(s.scores[p]) + '</span>' + (s.riichi[p] ? '<span class="rb">リーチ</span>' : '') + '</div>';
  }
  function render() {
    var el = $('#game-body'); if (!el) return;
    if (!state) { el.innerHTML = intro(); return; }
    var s = state;
    if (s.phase === 'gameEnd') { el.innerHTML = results(); return; }
    var L = G.legal(s, 0);
    var h = '<div class="ginfo"><span>' + G.roundName(s) + ' ' + s.honba + '本場</span><span>供託 ' + s.kyotaku + '</span><span>残り ' + s.live.length + '</span>' +
      '<span class="dora">ドラ表示 ' + s.doraIndicators.map(function (t) { return T(t); }).join('') + '</span></div>';
    h += '<div class="cpus">' + [3, 2, 1].map(function (p) {
      return '<div class="cpu">' + head(p) + backTiles(s.hands[p].length) + melds(p) + pond(p, 'small') + '</div>';
    }).join('') + '</div>';
    h += '<div class="me">' + head(0) + pond(0) + '</div>';
    // 手牌（ツモ牌は右に離す）
    var hand = s.hands[0].slice(), drawn = null;
    if (s.phase === 'turn' && s.turn === 0 && s.drawn != null) { hand.splice(hand.lastIndexOf(s.drawn), 1); drawn = s.drawn; }
    var myTurn = s.phase === 'turn' && s.turn === 0 && !s.riichi[0];
    var allowedIds = riichiMode ? L.riichi : L.discard, allowedT = {};
    allowedIds.forEach(function (id) { allowedT[id % 34] = 1; });
    var hl = s.phase === 'call' && s.pending.waiting === 0 ? s.pending.tile % 34 : null;
    function ht(id, i, isDrawn) {
      var ok = s.phase === 'turn' && s.turn === 0 && (riichiMode ? allowedT[id % 34] : allowedIds.indexOf(id) >= 0 || (!s.riichi[0] && allowedT[id % 34]));
      return T(id, { button: true, idx: isDrawn ? 'd' : i, id: id, sel: sel === (isDrawn ? 'd' : i), disabled: s.phase === 'turn' && s.turn === 0 && !ok && !s.riichi[0], cls: hl != null && id % 34 === hl ? 'hl' : '' });
    }
    h += '<div class="hand ghand" id="g-hand">' + hand.map(function (t, i) { return ht(t, i, false); }).join('') +
      (drawn != null ? '<span class="gap"></span>' + ht(drawn, 0, true) : '') + '</div>' + melds(0);
    // 操作
    var btn = [], msg = '';
    if (s._noTsumo) L.tsumo = false;
    if (s.phase === 'call' && s.pending.waiting === 0) {
      msg = nm(s.pending.from) + ' の ' + E.name(s.pending.tile % 34) + ' を鳴けます';
      h += '<div class="callbar" id="g-call"><div class="ctile">' + T(s.pending.tile) + '</div><div class="cbtns">';
      if (L.pon) h += '<button class="btn primary" data-a="pon">ポン</button>';
      L.chi.forEach(function (c, i) { h += '<button class="btn primary chi" data-a="chi" data-c="' + i + '">チー ' + T(c[0], { sm: true }) + T(c[1], { sm: true }) + '</button>'; });
      if (L.minkan) h += '<button class="btn" data-a="minkan">カン</button>';
      h += '<button class="btn" data-a="skip">スルー</button></div>';
      if (opts.explain) h += callHint(s, L);
      h += '</div>';
    } else {
      if (L.tsumo) btn.push('<button class="btn primary" data-a="tsumo">ツモ</button>');
      if (L.ron) btn.push('<button class="btn primary" data-a="ron">ロン</button><button class="btn" data-a="skip">見逃す</button>');
      if (myTurn && L.riichi.length && !L.tsumo) btn.push('<button class="btn' + (riichiMode ? ' primary' : '') + '" data-a="riichi">' + (riichiMode ? 'リーチ：打牌を選択' : 'リーチ') + '</button>');
      var kans = L.ankan.map(function (t) { return { k: 'ankan', t: t }; }).concat(L.kakan.map(function (t) { return { k: 'kakan', t: t }; }));
      if (s.phase === 'turn' && s.turn === 0 && kans.length) {
        if (kans.length === 1) btn.push('<button class="btn" data-a="' + kans[0].k + '" data-t="' + kans[0].t + '">' + (kans[0].k === 'ankan' ? '暗槓 ' : '加槓 ') + E.name(kans[0].t) + '</button>');
        else btn.push(kanPick ? kans.map(function (x) { return '<button class="btn" data-a="' + x.k + '" data-t="' + x.t + '">' + (x.k === 'ankan' ? '暗槓 ' : '加槓 ') + E.name(x.t) + '</button>'; }).join('') : '<button class="btn" data-a="kanpick">カン…</button>');
      }
      if (s.phase === 'turn' && s.turn === 0 && s.riichi[0] && L.ankan.length) btn.push('<button class="btn" data-a="tsumogiri">ツモ切り</button>');
      if (L.kyuushu) btn.push('<button class="btn" data-a="kyuushu">九種九牌で流局</button>');
      if (L.tsumo) btn.push('<button class="btn" data-a="noTsumo">和了らない</button>');
      if (s.phase === 'turn' && s.turn === 0) msg = s.riichi[0] ? 'リーチ中：ツモ切りします' : L.tsumo ? 'ツモ和了できます' : s.drawn == null ? '鳴いた後の打牌を選んでください' + (s.kuikae && s.kuikae.length ? '（喰い替え禁止：' + s.kuikae.map(E.name).join('・') + '）' : '') : '切る牌をタップ → もう一度タップで打牌';
      else if (L.ron) msg = E.name(s.pending.tile % 34) + ' でロンできます' + (s.pending.kind === 'kakan' ? '（槍槓）' : '');
      else if (s.phase === 'call' || s.phase === 'ron') msg = nm(s.pending.waiting) + ' が考えています';
      else if (s.phase === 'turn') msg = nm(s.turn) + ' の番です';
      if (L.kyuushu) msg += '　九種九牌です。流局にもできます';
    }
    h += '<div class="gact"><span class="gmsg">' + msg + '</span>' + btn.join('') + '</div>';
    h += '<label class="gtoggle"><input type="checkbox" id="g-explain"' + (opts.explain ? ' checked' : '') + '> 解説（向聴数・受け入れ・危険度）を表示</label>';
    if (opts.explain && !(s.phase === 'call' && s.pending.waiting === 0)) h += explain(s);
    if (s.phase === 'handEnd') h += '<div class="modal" id="g-result"><div class="sheet">' + resultHTML(s.result) + '<button class="btn primary wide" data-a="next">' + (s.endReason ? '最終結果へ' : '次の局へ') + '</button></div></div>';
    el.innerHTML = h;
  }
  function callHint(s, L) {
    var v = G.publicView(s, 0), lines = [];
    if (L.pon) { var a = C.callAdvice(v, 'pon'); lines.push('<li><b>ポン</b>：' + (a.ok ? '◎ ' : '△ ') + a.reason + '</li>'); }
    L.chi.forEach(function (c) { var a = C.callAdvice(v, 'chi', c); lines.push('<li><b>チー ' + E.name(c[0] % 34) + E.name(c[1] % 34) + '</b>：' + (a.ok ? '◎ ' : '△ ') + a.reason + '</li>'); });
    if (L.minkan) { var b = C.callAdvice(v, 'minkan'); lines.push('<li><b>カン</b>：' + b.reason + '。カンドラが増え、相手の打点も上がります</li>'); }
    return '<div class="card explain hint"><p>💡 鳴きの判断（解説）</p><ul class="rl">' + lines.join('') + '</ul><p class="fine">鳴くと門前役（立直・平和・門前ツモなど）が付かなくなり、一部の役は1翻下がります（喰い下がり）。役がない形で鳴くと和了できません。</p></div>';
  }

  function explain(s) {
    var v = G.publicView(s, 0), vis = C.visible(v), unseen = 136 - vis.reduce(function (a, b) { return a + b; }, 0);
    var ths = C.threats(v, 'hard'), nmeld = s.melds[0].length;
    var h = '<div class="card explain">';
    if (s.phase === 'turn' && s.turn === 0 && s.hands[0].length % 3 === 2) {
      var allowed = {}; G.legal(s, 0).discard.forEach(function (id) { allowed[id % 34] = 1; });
      var op = Y.discardOptions(s.hands[0], vis, nmeld, null).filter(function (o) { return allowed[o.tile]; });
      if (!op.length) return '';
      var hasD = ths.length > 0;
      h += '<p>いまの手：<b>' + (op[0].shanten === -1 ? '和了形' : (op[0].shanten === 0 ? '聴牌できる' : op[0].shanten + '向聴にできる')) + '</b>　見えていない牌 ' + unseen + '枚</p>';
      if (hasD) h += '<p class="warn">⚠ ' + ths.map(function (t) { return nm(t.p) + (t.kind === 'riichi' ? 'がリーチ' : t.kind === 'some' ? 'が染め手の気配' : 'が副露で高そう'); }).join('、') + '。危険度を確認しましょう。</p>';
      h += '<table class="qt"><tr><th>打牌</th><th>向聴</th><th>受け入れ</th><th>次で引く</th>' + (hasD ? '<th>危険度</th>' : '') + '</tr>';
      op.slice(0, hasD ? 9 : 6).forEach(function (o) {
        var dg = hasD ? C.danger(v, o.tile, 'hard', ths) : null;
        h += '<tr><td>' + T(o.tile, { sm: true }) + '</td><td>' + (o.shanten === 0 ? '聴牌' : o.shanten) + '</td><td>' + o.ukeire + '枚<small>' + o.accept.map(function (a) { return E.name(a.tile); }).join(' ') + '</small></td><td>' + (unseen ? (o.ukeire / unseen * 100).toFixed(1) + '%' : '—') + '</td>' +
          (hasD ? '<td><span class="dg ' + ({ '安全': 'safe', 'やや危険': 'mid', '危険': 'bad' })[dg.level] + '">' + dg.level + '</span><small>' + dg.why + '</small></td>' : '') + '</tr>';
      });
      h += '</table><p class="fine">受け入れ＝向聴数が進む牌の残り枚数（自分の手牌・全員の河・副露・ドラ表示牌を除いた目安）。確率は「見えていない牌が均等に残っている」と仮定した1回のツモの目安です。' +
        (hasD ? '危険度は公開情報だけの目安：現物（相手が捨てた牌・リーチ後に通った牌）＝安全、スジ・壁・見えている字牌＝やや安全、無スジの中張牌やドラ＝危険。シャンポン・単騎・嵌張待ちには当たることがあります。' : '') + '</p>';
    } else {
      var sh = Y.shanten(Y.toCounts(s.hands[0]), nmeld);
      h += '<p>いまの手：' + (sh === 0 ? '<b>聴牌</b>　待ち：' + Y.waits(s.hands[0], nmeld).map(E.name).join('・') : sh + '向聴') + '</p>';
    }
    return h + '</div>';
  }

  function winHTML(r, w, i, n) {
    var s = state, h = '';
    h += '<h2>' + (n > 1 ? '（' + (i + 1) + '）' : '') + nm(w.winner) + ' の' + (r.method === 'ron' ? 'ロン' : 'ツモ') + '和了' + (r.method === 'ron' ? '（' + nm(r.from) + 'から）' : '') + '</h2>';
    h += '<div class="hand winhand">' + w.hand.map(function (t, j) { return T(t, { win: j === w.hand.length - 1 }); }).join('') +
      (w.melds.length ? '<span class="gap"></span>' + w.melds.map(function (m) { return '<span class="meld">' + m.ids.map(function (id) { return T(id, { rot: id === m.called }); }).join('') + '</span>'; }).join('') : '') + '</div>';
    if (w.melds.length) h += '<p class="fine">副露：' + w.melds.map(function (m) { return Y.MELD_LABEL[m.type] + ' ' + E.name(m.ids[0] % 34); }).join('・') + (w.melds.some(function (m) { return m.type !== 'ankan'; }) ? '（鳴きあり：門前役なし・喰い下がりあり）' : '（暗槓のみ：門前扱い）') + '</p>';
    if (i === 0) h += '<div class="row gap fine indic">ドラ表示牌 ' + s.doraIndicators.map(function (t) { return T(t, { sm: true }); }).join('') + (w.ura.length ? '　裏ドラ表示牌 ' + w.ura.map(function (t) { return T(t, { sm: true }); }).join('') : '') + '</div>';
    var yk = w.yaku.map(function (y) { return [y.name, y.han]; });
    if (w.yakuman || !w.opt || !w.opt.groups || w.opt.kokushi) {
      h += '<div class="ribbon"><span class="r-han">' + w.calc.limit + '</span><span class="r-pt">' + E.fmt(w.calc.total) + '点</span></div><p>' + yk.map(function (y) { return y[0]; }).join('・') + '</p>';
    } else h += U().breakdownHTML(w.opt, w.han, r.method, w.dealer, yk, 0);
    if (w.pao) h += '<p class="warn">包（パオ）：' + w.pao.yaku + 'の確定牌を鳴かせた ' + nm(w.pao.liable) + ' が' + (r.method === 'tsumo' ? '全額' : '半額') + 'を支払います。</p>';
    if (w.honba || w.kyotaku) h += '<p>本場 ' + w.honba + '（' + (r.method === 'ron' ? '+' + w.honba * 300 : '各+' + w.honba * 100) + '）　供託 ' + w.kyotaku * 1000 + '点も獲得</p>';
    return h;
  }
  function resultHTML(r) {
    var h = '';
    if (r.type === 'draw') {
      h += '<h2>流局</h2><p>' + [0, 1, 2, 3].map(function (p) { return nm(p) + '：' + (r.tenpai[p] ? '聴牌' : 'ノーテン') + '（' + fmt(r.deltas[p]) + '）'; }).join('<br>') + '</p>' +
        '<p class="fine">ノーテン罰符：場に3,000点を聴牌者で分け合います。親が聴牌なら連荘、本場が1つ増えます。</p>';
    } else if (r.type === 'abort') {
      h += '<h2>途中流局：' + r.reason + '</h2><p class="fine">' + ({ '九種九牌': '最初のツモで么九牌が9種類以上あったため流局を宣言しました。', '四風連打': '1巡目に4人全員が同じ風牌を捨てました。', '四家立直': '4人全員がリーチしました。', '四槓散了': '2人以上で合計4回カンしました。', '三家和': '3人が同時にロンしました。' })[r.reason] +
        '親はそのまま、本場が1つ増えます。リーチ棒は供託として残ります。</p>';
    } else {
      r.wins.forEach(function (w, i) { h += winHTML(r, w, i, r.wins.length); });
    }
    if (state.endReason) h += '<p class="gold">対局終了：' + state.endReason + '</p>';
    return h + scoreTable(r);
  }
  function scoreTable(r) {
    return '<table class="qt"><tr><th></th><th>増減</th><th>持ち点</th></tr>' + [0, 1, 2, 3].map(function (p) {
      return '<tr><th>' + nm(p) + '</th><td>' + fmt(r.deltas[p]) + '</td><td>' + E.fmt(r.scores[p]) + '</td></tr>';
    }).join('') + '</table>';
  }
  function optSeg(key, list) {
    var cur = key === 'cpuLevel' ? opts.cpuLevel : opts.rules[key];
    return '<div class="seg" data-gk="' + key + '">' + list.map(function (o) { return '<button data-v="' + o[0] + '" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function intro() {
    var r = opts.rules;
    return (migrated ? '<p class="notice">前のバージョンで途中だった対局は、新しいルール（鳴き・半荘）と保存形式が合わないため再開できませんでした。新しく対局を始めてください。（設定や学習の記録はそのままです）</p>' : '') +
      '<article class="card"><h2>対局</h2><ul class="rl"><li>あなた＋CPU 3人、25,000点持ち。親の和了・聴牌流局で連荘</li>' +
      '<li>ポン・チー・カン、リーチ、フリテン、ドラ／カンドラ／裏ドラ／赤ドラ、途中流局、包（パオ）に対応</li></ul>' +
      '<h3>ルール</h3>' +
      '<div class="srow"><span>対局</span>' + optSeg('mode', [['tonpuu', '東風戦'], ['hanchan', '半荘戦']]) + '</div>' +
      '<div class="srow"><span>赤ドラ</span>' + optSeg('aka', [[0, 'なし'], [3, '3枚']]) + '</div>' +
      '<div class="srow"><span>ダブロン</span>' + optSeg('doubleRon', [[true, 'あり'], [false, 'なし（頭ハネ）']]) + '</div>' +
      '<div class="srow"><span>西入</span>' + optSeg('westIn', [[false, 'なし'], [true, 'あり']]) + '</div>' +
      '<div class="srow"><span>和了やめ</span>' + optSeg('agariYame', [[true, 'あり'], [false, 'なし']]) + '</div>' +
      '<div class="srow"><span>ウマ</span>' + optSeg('uma', [['off', '表示しない'], ['5-10', '5-10'], ['10-20', '10-20'], ['10-30', '10-30']]) + '</div>' +
      '<div class="srow"><span>CPU</span>' + optSeg('cpuLevel', [['easy', '初級'], ['normal', '中級'], ['hard', '上級']]) + '</div>' +
      '<p class="fine">ウマは30,000点返し（オカ +20 はトップへ）で最終結果に表示します。西入ありの場合、南4局終了時に誰も30,000点に届いていなければ西場へ（30,000点以上の人が出た時点で終了）。トビ（0点未満）で即終了。鳴きの確認の表示は設定画面で切り替えられます。</p>' +
      '<p class="fair">🎲 <b>公平性</b>：牌山は各局の開始時に暗号論的乱数（crypto.getRandomValues）で一度だけシャッフルします。配牌・ツモの操作や重み付けは一切ありません。CPUは自分の手牌と公開情報（河・副露・リーチ・ドラ表示牌）だけで判断し、あなたの手牌や山を見ません。どの難易度でも同じです。</p>' +
      '<button class="btn primary wide" data-a="new">対局開始</button></article>';
  }
  function results() {
    var s = state, rk = s.ranking || G.ranking(s), f = s.final || G.finalPoints(s);
    var h = '<article class="card"><h2>最終結果</h2><p class="fine">' + (s.rules.mode === 'hanchan' ? '半荘戦' : '東風戦') + '・' + (s.endReason || '') + '</p><table class="qt rank"><tr><th></th><th></th><th>持ち点</th>' + (f.enabled ? '<th>ウマオカ込み</th>' : '<th>収支</th>') + '</tr>';
    rk.forEach(function (p, i) {
      h += '<tr' + (p === 0 ? ' class="mine"' : '') + '><th>' + (i + 1) + '位</th><td>' + nm(p) + (p ? '<small class="lv">' + (LEVEL_NAMES[s.levels[p]] || '') + '</small>' : '') + '</td><td>' + E.fmt(s.scores[p]) + '点</td><td>' +
        (f.enabled ? '<b>' + (f.points[p] > 0 ? '+' : '') + f.points[p].toFixed(1) + '</b>' : fmt(s.scores[p] - 25000)) + '</td></tr>';
    });
    h += '</table>';
    if (s.leftoverKyotaku) h += '<p class="fine">残っていた供託 ' + s.leftoverKyotaku + '本（' + E.fmt(s.leftoverKyotaku * 1000) + '点）はトップが受け取りました。</p>';
    if (f.enabled) h += '<p class="fine">計算：（持ち点 − 30,000）÷ 1,000 ＋ ウマ（' + f.uma.map(function (u) { return (u > 0 ? '+' : '') + u; }).join(' / ') + '）＋ オカ（トップに +' + f.oka + '）。合計は0になります。</p>';
    var wins = s.log.filter(function (l) { return l.type === 'win'; }).length, draws = s.log.filter(function (l) { return l.type === 'draw'; }).length, aborts = s.log.filter(function (l) { return l.type === 'abort'; }).length;
    h += '<p class="fine">全' + s.handNo + '局。和了 ' + wins + '回・流局 ' + draws + '回' + (aborts ? '・途中流局 ' + aborts + '回' : '') + '。</p><button class="btn primary wide" data-a="new">もう一度対局</button></article>';
    return h;
  }

  // ---------- 入力 ----------
  document.addEventListener('click', function (e) {
    if (!active) return;
    var g = e.target.closest('#v-game .seg[data-gk] button');
    if (g) {
      var k0 = g.parentNode.dataset.gk, v = g.dataset.v; v = v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? +v : v;
      if (k0 === 'cpuLevel') opts.cpuLevel = v; else opts.rules[k0] = v;
      save(); render(); return;
    }
    var a = e.target.closest('#v-game [data-a]');
    if (a) {
      var k = a.dataset.a;
      if (k === 'new') { newGame(); loop(); window.scrollTo(0, 0); return; }
      if (k === 'riichi') { riichiMode = !riichiMode; sel = null; render(); return; }
      if (k === 'tsumogiri') { humanAct({ type: 'discard', tile: state.drawn }); return; }
      if (k === 'kanpick') { kanPick = !kanPick; render(); return; }
      if (k === 'noTsumo') { state._noTsumo = true; loop(); return; }
      if (k === 'next') { humanAct({ type: 'next' }); window.scrollTo(0, 0); return; }
      if (k === 'chi') { humanAct({ type: 'chi', tiles: G.legal(state, 0).chi[+a.dataset.c] }); return; }
      if (k === 'ankan' || k === 'kakan') { humanAct({ type: k, tile: +a.dataset.t }); return; }
      humanAct({ type: k }); return;
    }
    var t = e.target.closest('#g-hand .tile');
    if (t && !t.disabled && state && state.phase === 'turn' && state.turn === 0 && !state.riichi[0]) {
      var id = t.dataset.i === 'd' ? 'd' : +t.dataset.i;
      if (sel === id) humanAct({ type: 'discard', tile: +t.dataset.id, riichi: riichiMode });
      else { sel = id; render(); }
    }
  });
  document.addEventListener('change', function (e) { if (e.target.id === 'g-explain') { opts.explain = e.target.checked; save(); render(); } });

  root.GameUI = { show: show, hide: hide, get state() { return state; }, opts: opts, saveOpts: save, LEVEL_NAMES: LEVEL_NAMES,
    setAuto: function (m) { auto = m; DELAY = m === 'off' ? 450 : 12; loop(); } };
  root.__game = root.GameUI;
})(this);
