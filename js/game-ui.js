/* 点数道場 — 対局画面（東風戦・お試し版） */
(function (root) {
  'use strict';
  var G = root.GameCore, Y = root.Yaku, E = root.Engine;
  var KEY = 'dojo.game', OPT_KEY = 'dojo.gameOpts';
  var WIND = ['東', '南', '西', '北'];
  var state = null, sel = null, riichiMode = false, timer = null, active = false;
  var opts = load(OPT_KEY) || { explain: false };
  var q = new URLSearchParams(location.search);
  var auto = q.get('autoplay') === 'hand' ? 'hand' : q.get('autoplay') ? 'full' : 'off';
  var DELAY = auto === 'off' ? 450 : 15;
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save() { try { if (state) localStorage.setItem(KEY, JSON.stringify(state)); localStorage.setItem(OPT_KEY, JSON.stringify(opts)); } catch (e) {} }
  function $(s) { return document.querySelector(s); }
  function U() { return root.DojoUI; }
  function T(t, o) { return U().tile(t, o); }
  function fmt(n) { return (n > 0 ? '+' : '') + E.fmt(n); }

  state = load(KEY);
  if (state && state.version !== 1) state = null;

  function show() {
    active = true;
    if (auto !== 'off' && (!state || state.phase === 'gameEnd')) { state = G.newGame(); }
    loop();
  }
  function hide() { active = false; clearTimeout(timer); }

  // ---------- 進行 ----------
  function loop() {
    clearTimeout(timer);
    render(); save();
    if (!active || !state) return;
    var s = state, humanAuto = auto !== 'off';
    if (s.phase === 'turn' || s.phase === 'ron') {
      var who = s.phase === 'turn' ? s.turn : s.pending.waiting;
      if (who !== 0 || humanAuto) { timer = setTimeout(function () { G.autoStep(s, humanAuto); loop(); }, DELAY); return; }
      // 人間：立直後はツモ和了がなければ自動ツモ切り
      if (s.phase === 'turn' && s.riichi[0] && (!G.legal(s, 0).tsumo || s._noTsumo)) timer = setTimeout(function () { s._noTsumo = false; G.act(s, 0, { type: 'discard', tile: s.drawn }); loop(); }, 600);
    } else if (s.phase === 'handEnd' && auto === 'full') {
      timer = setTimeout(function () { G.act(s, 0, { type: 'next' }); loop(); }, 300);
    }
  }
  function humanAct(a) { if (!state) return; state._noTsumo = false; sel = null; riichiMode = false; if (G.act(state, 0, a)) loop(); else render(); }

  // ---------- 描画 ----------
  function backTiles(n) { return '<span class="backs">' + new Array(n + 1).join('<i></i>') + '</span>'; }
  function pond(p, cls) {
    return '<div class="pond ' + (cls || '') + '">' + state.discards[p].map(function (d) {
      return '<span class="pw' + (d.riichi ? ' rot' : '') + '">' + T(d.t) + '</span>';
    }).join('') + '</div>';
  }
  function head(p) {
    var s = state, d = G.dealerOf(s);
    return '<div class="ph' + (s.turn === p && s.phase === 'turn' ? ' on' : '') + '"><b>' + WIND[G.seatWind(s, p)] + '</b>' + (p === d ? '<em>親</em>' : '') +
      '<span>' + G.NAMES[p].replace('CPU ', '') + '</span><span class="sc">' + E.fmt(s.scores[p]) + '</span>' + (s.riichi[p] ? '<span class="rb">リーチ</span>' : '') + '</div>';
  }
  function render() {
    var el = $('#game-body'); if (!el) return;
    if (!state) { el.innerHTML = intro(); return; }
    var s = state;
    if (s.phase === 'gameEnd') { el.innerHTML = results(); return; }
    var L = G.legal(s, 0);
    var h = '<div class="ginfo"><span>東' + (s.kyoku + 1 > 4 ? 4 : s.kyoku + 1) + '局 ' + s.honba + '本場</span><span>供託 ' + s.kyotaku + '</span><span>残り ' + s.live.length + '</span>' +
      '<span class="dora">ドラ表示 ' + s.doraIndicators.map(function (t) { return T(t); }).join('') + '</span></div>';
    h += '<div class="cpus">' + [3, 2, 1].map(function (p) {
      return '<div class="cpu">' + head(p) + backTiles(s.hands[p].length) + pond(p, 'small') + '</div>';
    }).join('') + '</div>';
    h += '<div class="me">' + head(0) + pond(0) + '</div>';
    // 手牌（ツモ牌は右に離す）
    var hand = s.hands[0].slice(), drawn = null;
    if (s.phase === 'turn' && s.turn === 0 && s.drawn != null) { hand.splice(hand.lastIndexOf(s.drawn), 1); drawn = s.drawn; }
    var myTurn = s.phase === 'turn' && s.turn === 0 && !(s.riichi[0]);
    var allowed = riichiMode ? L.riichi : L.discard;
    function ht(t, i, isDrawn) {
      var dis = !(s.phase === 'turn' && s.turn === 0) || allowed.indexOf(t) < 0;
      return T(t, { button: true, idx: isDrawn ? 'd' : i, sel: sel === (isDrawn ? 'd' : i), disabled: dis && !s.riichi[0] });
    }
    h += '<div class="hand ghand" id="g-hand">' + hand.map(function (t, i) { return ht(t, i, false); }).join('') +
      (drawn != null ? '<span class="gap"></span>' + ht(drawn, 0, true) : '') + '</div>';
    // 操作
    var btn = [];
    if (s._noTsumo) L.tsumo = false;
    if (L.tsumo) btn.push('<button class="btn primary" data-a="tsumo">ツモ</button>');
    if (L.ron) btn.push('<button class="btn primary" data-a="ron">ロン</button><button class="btn" data-a="skip">スキップ</button>');
    if (myTurn && L.riichi.length && !L.tsumo) btn.push('<button class="btn' + (riichiMode ? ' primary' : '') + '" data-a="riichi">' + (riichiMode ? 'リーチ：打牌を選択' : 'リーチ') + '</button>');
    if (L.tsumo) btn.push('<button class="btn" data-a="noTsumo">和了らない</button>');
    var msg = '';
    if (s.phase === 'turn' && s.turn === 0) msg = s.riichi[0] ? 'リーチ中：ツモ切りします' : L.tsumo ? 'ツモ和了できます' : '切る牌をタップ → もう一度タップで打牌';
    else if (L.ron) msg = E.name(s.pending.tile) + ' でロンできます';
    else msg = G.NAMES[s.phase === 'ron' ? s.pending.waiting : s.turn] + ' の番です';
    h += '<div class="gact"><span class="gmsg">' + msg + '</span>' + btn.join('') + '</div>';
    h += '<label class="gtoggle"><input type="checkbox" id="g-explain"' + (opts.explain ? ' checked' : '') + '> 解説（向聴数・受け入れ）を表示</label>';
    if (opts.explain) h += explain(s);
    h += '<p class="fine">鳴き（ポン・チー・カン）はお試し版では使えません。</p>';
    if (s.phase === 'handEnd') h += '<div class="modal" id="g-result"><div class="sheet">' + resultHTML(s.result) + '<button class="btn primary wide" data-a="next">次へ</button></div></div>';
    el.innerHTML = h;
  }

  function explain(s) {
    var v = G.publicView(s, 0), vis = G.visibleCounts(v), unseen = 136 - vis.reduce(function (a, b) { return a + b; }, 0);
    var h = '<div class="card explain">';
    if (s.phase === 'turn' && s.turn === 0) {
      var op = Y.discardOptions(s.hands[0], vis);
      h += '<p>いまの手：<b>' + (op[0].shanten === -1 ? '和了形' : (op[0].shanten === 0 ? '聴牌できる' : op[0].shanten + '向聴にできる')) + '</b>　見えていない牌 ' + unseen + '枚</p><table class="qt"><tr><th>打牌</th><th>向聴</th><th>受け入れ</th><th>次で引く確率</th></tr>';
      op.slice(0, 6).forEach(function (o) {
        h += '<tr><td>' + T(o.tile, { sm: true }) + '</td><td>' + (o.shanten === 0 ? '聴牌' : o.shanten) + '</td><td>' + o.ukeire + '枚<small>' + o.accept.map(function (a) { return E.name(a.tile); }).join(' ') + '</small></td><td>' + (unseen ? (o.ukeire / unseen * 100).toFixed(1) + '%' : '—') + '</td></tr>';
      });
      h += '</table><p class="fine">受け入れ＝向聴数が進む牌の残り枚数（自分の手牌・全員の河・ドラ表示牌を除いて数えた目安）。確率は「見えていない牌が均等に残っている」と仮定した1回のツモの目安で、相手の手牌や山の並びは分かりません。</p>';
    } else {
      var sh = Y.shanten(Y.toCounts(s.hands[0]));
      h += '<p>いまの手：' + (sh === 0 ? '<b>聴牌</b>　待ち：' + Y.waits(s.hands[0]).map(E.name).join('・') : sh + '向聴') + '</p>';
    }
    return h + '</div>';
  }

  function resultHTML(r) {
    var s = state, h = '';
    if (r.type === 'draw') {
      h += '<h2>流局</h2><p>' + [0, 1, 2, 3].map(function (p) { return G.NAMES[p] + '：' + (r.tenpai[p] ? '聴牌' : 'ノーテン') + '（' + fmt(r.deltas[p]) + '）'; }).join('<br>') + '</p>' +
        '<p class="fine">ノーテン罰符：場に3,000点を聴牌者で分け合います。親が聴牌なら連荘、本場が1つ増えます。</p>';
      return h + scoreTable(r);
    }
    h += '<h2>' + G.NAMES[r.winner] + ' の' + (r.method === 'ron' ? 'ロン' : 'ツモ') + '和了' + (r.method === 'ron' ? '（' + G.NAMES[r.from] + 'から）' : '') + '</h2>';
    h += '<div class="hand">' + r.hand.map(function (t, i) { return T(t, { win: i === r.hand.length - 1 }); }).join('') + '</div>';
    h += '<div class="row gap fine indic">ドラ表示牌 ' + s.doraIndicators.map(function (t) { return T(t, { sm: true }); }).join('') + (r.ura.length ? '　裏ドラ表示牌 ' + r.ura.map(function (t) { return T(t, { sm: true }); }).join('') : '') + '</div>';
    var yk = r.yaku.map(function (y) { return [y.name, y.han]; });
    if (r.yakuman || !r.opt || !r.opt.groups || r.opt.kokushi) {
      h += '<div class="ribbon"><span class="r-han">' + (r.yakuman ? r.calc.limit : r.han + '翻') + '</span><span class="r-pt">' + E.fmt(r.calc.total) + '点</span></div><p>' + yk.map(function (y) { return y[0]; }).join('・') + '</p>';
    } else {
      h += U().breakdownHTML(r.opt, r.han, r.method, r.dealer, yk, 0);
    }
    if (r.honba || r.kyotaku) h += '<p>本場 ' + r.honba + '（' + (r.method === 'ron' ? '+' + r.honba * 300 : '各+' + r.honba * 100) + '）　供託 ' + r.kyotaku * 1000 + '点も獲得</p>';
    return h + scoreTable(r);
  }
  function scoreTable(r) {
    return '<table class="qt"><tr><th></th><th>増減</th><th>持ち点</th></tr>' + [0, 1, 2, 3].map(function (p) {
      return '<tr><th>' + G.NAMES[p] + '</th><td>' + fmt(r.deltas[p]) + '</td><td>' + E.fmt(r.scores[p]) + '</td></tr>';
    }).join('') + '</table>';
  }
  function intro() {
    var saved = load(KEY);
    return '<article class="card"><h2>対局（東風戦・お試し版）</h2><ul class="rl"><li>あなた＋CPU 3人、25,000点持ち、東1局〜東4局（親の和了・聴牌流局で連荘）</li>' +
      '<li>リーチ・ツモ・ロン・フリテン・流局（ノーテン罰符3,000）・本場300・供託・ドラ／裏ドラ。赤ドラなし</li>' +
      '<li><b>鳴き（ポン・チー・カン）はまだ使えません</b></li></ul>' +
      '<p class="fair">🎲 <b>公平性</b>：牌山は各局の開始時に暗号論的乱数（crypto.getRandomValues）で一度だけシャッフルします。配牌・ツモの操作や重み付けは一切ありません。CPUは自分の手牌と公開情報（河・リーチ・ドラ表示牌）だけで判断し、あなたの手牌や山を見ません。偏った配牌も普通に起こります。</p>' +
      '<button class="btn primary wide" data-a="new">対局開始</button></article>';
  }
  function results() {
    var s = state, rk = s.ranking || G.ranking(s);
    var h = '<article class="card"><h2>最終結果</h2><table class="qt rank">';
    rk.forEach(function (p, i) { h += '<tr' + (p === 0 ? ' class="mine"' : '') + '><th>' + (i + 1) + '位</th><td>' + G.NAMES[p] + '</td><td>' + E.fmt(s.scores[p]) + '点</td><td>' + fmt(s.scores[p] - 25000) + '</td></tr>'; });
    h += '</table><p class="fine">全' + s.handNo + '局。和了 ' + s.log.filter(function (l) { return l.type === 'win'; }).length + '回・流局 ' + s.log.filter(function (l) { return l.type === 'draw'; }).length + '回。ウマ・オカなし。</p>' +
      '<button class="btn primary wide" data-a="new">もう一度対局</button></article>';
    return h;
  }

  // ---------- 入力 ----------
  document.addEventListener('click', function (e) {
    if (!active) return;
    var a = e.target.closest('#v-game [data-a]');
    if (a) {
      var k = a.dataset.a;
      if (k === 'new') { state = G.newGame(); sel = null; loop(); return; }
      if (k === 'riichi') { riichiMode = !riichiMode; sel = null; render(); return; }
      if (k === 'noTsumo') { state._noTsumo = true; loop(); return; }
      if (k === 'next') { humanAct({ type: 'next' }); window.scrollTo(0, 0); return; }
      humanAct({ type: k }); return;
    }
    var t = e.target.closest('#g-hand .tile');
    if (t && !t.disabled && state && state.phase === 'turn' && state.turn === 0 && !state.riichi[0]) {
      var id = t.dataset.i === 'd' ? 'd' : +t.dataset.i;
      if (sel === id) humanAct({ type: 'discard', tile: +t.dataset.t, riichi: riichiMode });
      else { sel = id; render(); }
    }
  });
  document.addEventListener('change', function (e) { if (e.target.id === 'g-explain') { opts.explain = e.target.checked; save(); render(); } });

  root.GameUI = { show: show, hide: hide, get state() { return state; }, setAuto: function (m) { auto = m; DELAY = m === 'off' ? 450 : 15; loop(); } };
  root.__game = root.GameUI;
})(this);
