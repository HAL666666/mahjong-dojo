/* 牌の理 — UI */
(function () {
  'use strict';
  var E = window.Engine, Q = window.QUESTIONS, L = window.LESSONS;
  var $ = function (s) { return document.querySelector(s); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('dojo.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('dojo.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- 牌の描画（SVG：js/tiles/tiles-A/B/C.js） ----------
  var STYLES = { A: window.TilesA, B: window.TilesB, C: window.TilesC };
  var STYLE_NAMES = { A: 'A クラシック', B: 'B フラット', C: 'C 数字つき' };
  var settings = store.get('settings', { style: 'B', size: 'std' });
  if (!STYLES[settings.style]) settings.style = 'B';
  var svgCache = {};
  // 赤ドラ：絵柄の色を赤に置き換える（自作SVGの色指定を差し替えるだけ）
  var RED_FROM = /#(1b1b1b|1d4f9c|14704a|0b3d29|111|1557c0|0e7a4a|08442a)\b/gi;
  function tileSVG(code, style, red) {
    var k = style + code + (red ? 'r' : '');
    if (svgCache[k]) return svgCache[k];
    var svg = STYLES[style].svg(code, { width: '100%' });
    if (red) svg = svg.replace(RED_FROM, style === 'A' ? '#c0262d' : '#d42a2a');
    return (svgCache[k] = svg);
  }
  // t：牌の種類（0..33）・'5m' 形式、または対局の牌ID（種類＋34×コピー番号）
  function tile(t, o) {
    o = o || {};
    var i = E.parse(t) % 34, tag = o.button ? 'button' : 'span';
    var cls = 'tile' + (o.sm ? ' sm' : '') + (o.win ? ' win' : '') + (o.sel ? ' sel' : '') + (o.red ? ' red' : '') + (o.rot ? ' rot' : '') + (o.cls ? ' ' + o.cls : '');
    return '<' + tag + ' class="' + cls + '" data-t="' + i + '"' + (o.id != null ? ' data-id="' + o.id + '"' : '') + (o.idx != null ? ' data-i="' + o.idx + '"' : '') +
      (o.disabled ? ' disabled' : '') + ' aria-label="' + (o.red ? '赤' : '') + E.name(i) + '"' + (o.button ? ' type="button"' : '') + '>' + tileSVG(E.code(i), o.style || settings.style, o.red) +
      (o.cnt != null ? '<span class="cnt">' + o.cnt + '</span>' : '') + '</' + tag + '>';
  }
  function applySettings() {
    document.body.classList.toggle('size-lg', settings.size === 'lg');
    store.set('settings', settings);
  }
  function tiles(list, o) { return list.map(function (t) { return tile(t, o); }).join(''); }

  // ---------- 画面遷移（状態は各画面に保持） ----------
  var TITLES = { home: '牌の理', lessons: '符の学習', quiz: '点数クイズ', lab: '点数研究室', flow: '牌の流れと確率', rules: 'ルールとマナー', settings: '設定', game: '対局' };
  var current = 'home';
  function route() {
    var v = (location.hash || '#home').slice(1);
    if (!TITLES[v]) v = 'home';
    current = v;
    document.querySelectorAll('.view').forEach(function (s) { s.hidden = s.id !== 'v-' + v; });
    $('#title').textContent = TITLES[v];
    $('#back').hidden = v === 'home';
    if (v === 'home') renderHome();
    if (window.GameUI) { if (v === 'game') window.GameUI.show(); else window.GameUI.hide(); }
    if (v === 'settings') renderSettingsView();
    if (v === 'rules' && !$('#rules-body').innerHTML) $('#rules-body').innerHTML = window.renderRules(tile, tiles);
    window.scrollTo(0, 0);
  }
  $('#back').onclick = function () { location.hash = '#home'; };
  window.addEventListener('hashchange', route);

  // 改名のお知らせ（旧「点数道場」の利用者に一度だけ表示。保存データのキー dojo.* はそのまま）
  function renderRenameNotice() {
    var box = $('#rename-notice'); if (!box) return;
    if (store.get('renameNoticeSeen', false) || !window.__dojoHadData) { if (!window.__dojoHadData) store.set('renameNoticeSeen', true); box.innerHTML = ''; return; }
    box.innerHTML = '<div class="notice ok rename"><b>アプリ名が「牌の理（はいのことわり）」に変わりました。</b><br>旧名「点数道場」です。URL はそのままで、学習の記録・クイズの成績・設定などの保存データは引き継がれています。ホーム画面のアイコンもそのまま使えます（名前の表示は端末により次回起動時などに更新されます）。' +
      '<div class="row gap" style="margin-top:6px"><button class="btn sm primary" id="rename-ok" type="button">OK</button></div></div>';
    $('#rename-ok').onclick = function () { store.set('renameNoticeSeen', true); box.innerHTML = ''; };
  }
  function renderHome() {
    $('#logo').innerHTML = '<span class="logo-tile">牌</span><span class="logo-tile gold">の</span><span class="logo-tile">理</span>';
    if (!document.querySelector('.logo-reading')) $('#logo').insertAdjacentHTML('afterend', '<span class="logo-reading">はいのことわり</span>');
    renderRenameNotice();
    var done = store.get('lessonsDone', []);
    $('#lesson-progress').textContent = done.length + '/' + L.length;
    var qs = store.get('quizStats', { correct: 0, answered: 0 });
    $('#quiz-progress').textContent = qs.answered ? '正解 ' + qs.correct + '/' + qs.answered : '';
  }

  // ---------- 符の学習 ----------
  var lesson = store.get('lessonIdx', 0), lessonPick = null;
  function renderLesson() {
    var done = store.get('lessonsDone', []);
    $('#lesson-steps').innerHTML = L.map(function (_, i) {
      return '<button data-i="' + i + '" class="' + (i === lesson ? 'cur' : done.indexOf(i) >= 0 ? 'done' : '') + '">' + (i + 1) + '</button>';
    }).join('');
    var l = L[lesson], q = l.quiz;
    var h = '<h2>' + l.title + '</h2>' + l.body;
    if (l.tiles) h += '<div class="hand">' + tiles(l.tiles, { sm: l.tiles.length > 8 }) + '</div><p class="caption">' + l.caption + '</p>';
    h += '<hr style="border-color:rgba(216,182,91,.2)"><p><b>確認：</b>' + q.q + '</p><div class="choices">' +
      q.options.map(function (o, i) {
        var c = lessonPick == null ? '' : i === q.answer ? ' ok' : i === lessonPick ? ' ng' : '';
        return '<button class="choice' + c + '" data-c="' + i + '">' + o + '</button>';
      }).join('') + '</div>';
    if (lessonPick != null) h += '<p class="' + (lessonPick === q.answer ? 'verdict ok' : 'verdict ng') + '">' + (lessonPick === q.answer ? '正解！' : 'おしい！') + '</p><p>' + q.explain + '</p>';
    $('#lesson-card').innerHTML = h;
    $('#lesson-prev').disabled = lesson === 0;
    $('#lesson-next').textContent = lesson === L.length - 1 ? 'クイズへ ›' : '次へ ›';
  }
  $('#lesson-steps').onclick = function (e) { var b = e.target.closest('button'); if (b) { lesson = +b.dataset.i; lessonPick = null; store.set('lessonIdx', lesson); renderLesson(); } };
  $('#lesson-card').onclick = function (e) {
    var b = e.target.closest('.choice'); if (!b || lessonPick != null) return;
    lessonPick = +b.dataset.c;
    if (lessonPick === L[lesson].quiz.answer) { var d = store.get('lessonsDone', []); if (d.indexOf(lesson) < 0) { d.push(lesson); store.set('lessonsDone', d); } }
    renderLesson();
  };
  $('#lesson-prev').onclick = function () { if (lesson > 0) { lesson--; lessonPick = null; store.set('lessonIdx', lesson); renderLesson(); window.scrollTo(0, 0); } };
  $('#lesson-next').onclick = function () {
    if (lesson === L.length - 1) { location.hash = '#quiz'; return; }
    lesson++; lessonPick = null; store.set('lessonIdx', lesson); renderLesson(); window.scrollTo(0, 0);
  };

  // ---------- 点数クイズ ----------
  var FU_CHOICES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
  var qi = store.get('quizIdx', 0) % Q.length, qAnswered = false, qPay = null, qChoices = [];
  var qStats = store.get('quizStats', { correct: 0, answered: 0 });
  function solve(q) {
    var a = E.analyze(q.tiles, { winTile: q.win, method: q.method, closed: q.closed, seat: q.seat, round: q.round, openTriplets: q.open || [] });
    var han = q.yaku.reduce(function (s, y) { return s + y[1]; }, 0) + q.dora;
    var o = a.best;
    return { a: a, han: han, fu: o.fu, opt: o, pay: E.paymentText(han, o.fu, q.method, q.dealer) };
  }
  // 起動時に全問題をエンジンで検証
  Q.forEach(function (q, i) {
    var s = solve(q);
    q.verified = s.han === q.expect.han && s.fu === q.expect.fu && s.pay === q.expect.pay;
    if (!q.verified) console.warn('問題' + (i + 1) + 'の答えがエンジンと一致しません', s, q.expect);
  });
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function payChoices(q, s) {
    var set = [s.pay], cands = [];
    [[0, 10], [0, -10], [1, 0], [-1, 0], [1, 10], [0, 20], [-1, 10], [2, 0], [-2, 0], [3, 0]].forEach(function (d) {
      var h = s.han + d[0], f = s.fu === 25 ? 25 + Math.abs(d[1]) / 2 : s.fu + d[1];
      if (h >= 1 && f >= 20 && f % 5 === 0) cands.push(E.paymentText(h, f, q.method, q.dealer));
    });
    cands.push(E.paymentText(s.han, s.fu, q.method, !q.dealer).replace('オール', ''));
    cands.forEach(function (c) { if (set.length < 4 && c !== '—' && set.indexOf(c) < 0) set.push(c); });
    return shuffle(set);
  }
  function renderQuiz() {
    var q = Q[qi], s = solve(q);
    $('#quiz-count').textContent = '問題 ' + (qi + 1) + ' / ' + Q.length;
    $('#quiz-score').textContent = qStats.answered ? '通算 ' + qStats.correct + '/' + qStats.answered + ' 正解' : '';
    $('#quiz-title').textContent = q.title; $('#quiz-diff').textContent = q.difficulty;
    $('#quiz-hand').innerHTML = q.tiles.map(function (t, i) {
      var isWin = E.parse(t) === E.parse(q.win) && q.tiles.slice(i + 1).every(function (u) { return E.parse(u) !== E.parse(q.win); });
      return tile(t, { win: isWin });
    }).join('');
    $('#quiz-cond').textContent = q.condition + '　（金枠＝和了牌）';
    $('#quiz-yaku').textContent = '役：' + q.yaku.map(function (y) { return y[0] + ' ' + y[1] + '翻'; }).join('・') + (q.dora ? '・ドラ ' + q.dora : '');
    $('#ans-han').innerHTML = '<option value="">選択</option>' + Array.from({ length: 13 }, function (_, i) { return '<option value="' + (i + 1) + '">' + (i + 1) + '翻' + (i === 12 ? '以上' : '') + '</option>'; }).join('');
    $('#ans-fu').innerHTML = '<option value="">選択</option>' + FU_CHOICES.map(function (f) { return '<option value="' + f + '">' + f + '符</option>'; }).join('');
    qChoices = payChoices(q, s); qPay = null; qAnswered = false;
    renderPayChoices();
    $('#quiz-check').disabled = false;
    $('#quiz-result').hidden = true;
    $('#quiz-prev').disabled = qi === 0;
  }
  function renderPayChoices(s) {
    $('#ans-pay').innerHTML = qChoices.map(function (c, i) {
      var cls = 'choice';
      if (qAnswered) cls += c === s.pay ? ' ok' : i === qPay ? ' ng' : '';
      else if (i === qPay) cls += ' on';
      return '<button class="' + cls + '" data-c="' + i + '">' + c + '</button>';
    }).join('');
  }
  $('#ans-pay').onclick = function (e) { var b = e.target.closest('.choice'); if (!b || qAnswered) return; qPay = +b.dataset.c; renderPayChoices(); };
  $('#quiz-check').onclick = function () {
    var q = Q[qi], s = solve(q), han = +$('#ans-han').value, fu = +$('#ans-fu').value;
    if (!han || !fu || qPay == null) { alert('翻・符・点数をすべて選んでください。'); return; }
    var hanOk = han === s.han || (han >= 13 && s.han >= 13), fuOk = fu === s.fu, payOk = qChoices[qPay] === s.pay;
    var allOk = hanOk && fuOk && payOk;
    qAnswered = true; qStats.answered++; if (allOk) qStats.correct++; store.set('quizStats', qStats);
    renderPayChoices(s);
    $('#quiz-check').disabled = true;
    var r = $('#quiz-result');
    r.innerHTML = '<p class="verdict ' + (allOk ? 'ok">正解！' : 'ng">もう一歩。手順を確認しましょう') + '</p>' +
      '<p>翻 ' + (hanOk ? '✓' : '✗') + '　符 ' + (fuOk ? '✓' : '✗') + '　点数 ' + (payOk ? '✓' : '✗') + '</p>' +
      breakdownHTML(s.opt, s.han, q.method, q.dealer, q.yaku, q.dora) +
      '<p>' + esc(q.explanation) + '</p>' + (q.verified ? '' : '<p class="warn">※この問題の解説値とエンジン計算が一致しません。エンジンの値を表示しています。</p>');
    r.hidden = false;
    r.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('#quiz-next').onclick = function () { qi = (qi + 1) % Q.length; store.set('quizIdx', qi); renderQuiz(); window.scrollTo(0, 0); };
  $('#quiz-prev').onclick = function () { if (qi > 0) { qi--; store.set('quizIdx', qi); renderQuiz(); window.scrollTo(0, 0); } };

  function groupsHTML(opt) {
    if (opt.chiitoi) return '<p class="fine">七対子（対子7組）</p>';
    return '<div class="groups">' + opt.groups.map(function (g) {
      return '<div class="group"><div class="hand">' + tiles(g.tiles, { sm: true }) + '</div><span class="gl">' +
        (g.type === 'sequence' ? '順子 0符' : (g.open ? '明' : '暗') + (g.kan ? '槓' : '刻') + ' ' + g.fu + '符') + '</span></div>';
    }).join('') + '<div class="group"><div class="hand">' + tiles([opt.pair, opt.pair], { sm: true }) + '</div><span class="gl">雀頭</span></div></div>';
  }
  function breakdownHTML(opt, han, method, dealer, yaku, dora) {
    var h = '';
    var calc = E.calculate(han, opt.fu, method, dealer);
    h += '<div class="ribbon"><span class="r-han">' + han + '翻</span><span class="r-fu">' + opt.fu + '符</span><span class="r-pt">' + E.paymentText(han, opt.fu, method, dealer) +
      (calc.limit ? '（' + E.limitName(calc.limit) + '）' : '') + '</span></div>';
    if (yaku) h += '<h3>翻の内訳</h3><p>' + yaku.map(function (y) { return y[0] + ' ' + y[1] + '翻'; }).join(' ＋ ') + (dora ? ' ＋ ドラ ' + dora + '翻' : '') + ' ＝ ' + han + '翻</p>';
    h += '<h3>面子の分け方</h3>' + groupsHTML(opt) + '<p class="fine">待ち：' + opt.waitName + (opt.chiitoi ? '' : '（' + (opt.waitFu ? '+2符' : '0符') + '）') + '</p>';
    h += '<h3>符の内訳</h3><ul class="fu-list">' + opt.parts.map(function (p) { return '<li><span>' + esc(p.label) + '</span><span>' + (p.label === '副底' || opt.special ? '' : '+') + p.fu + '符</span></li>'; }).join('') +
      '<li class="total"><span>' + esc(opt.note) + '</span><span>' + opt.fu + '符</span></li></ul>';
    h += '<h3>点数の計算（' + (dealer ? '親' : '子') + '・' + (method === 'ron' ? 'ロン' : 'ツモ') + '）</h3><div class="eq">' + E.equationLines(han, opt.fu, method, dealer).map(esc).join('\n') + '</div>';
    return h;
  }

  // ---------- 点数研究室 ----------
  var PRESETS = [
    { name: '平和形', tiles: ['2m','3m','4m','5m','6m','7m','7p','8p','9p','5s','5s','2s','3s','4s'], win: '4s', han: 2 },
    { name: '暗刻・単騎', tiles: ['1m','1m','1m','9p','9p','9p','7z','7z','7z','2s','3s','4s','5m','5m'], win: '5m', han: 2 },
    { name: '七対子', tiles: ['1m','1m','9m','9m','3p','3p','7p','7p','2s','2s','5s','5s','1z','1z'], win: '1z', han: 2 }
  ];
  var lab = store.get('lab', null) || { tiles: PRESETS[0].tiles.map(E.parse), win: E.parse(PRESETS[0].win), method: 'tsumo', dealer: false, closed: true, seat: 1, round: 0, wait: '自動', han: 2, open: [], kans: [], preset: 0 };
  ['autoYaku', 'riichiLv', 'lastTile', 'dora'].forEach(function (k, i) { if (lab[k] == null) lab[k] = i === 0 ? false : 0; });
  var labSel = null;
  function saveLab() { store.set('lab', lab); }
  function sortTiles() { lab.tiles.sort(function (a, b) { return a - b; }); }
  function counts() { return E.countsOf(lab.tiles); }

  function renderLab() {
    sortTiles();
    var c = counts();
    $('#lab-count').textContent = '（' + lab.tiles.length + '/14枚）';
    var winMarked = false;
    $('#lab-hand').innerHTML = lab.tiles.length ? lab.tiles.map(function (t, i) {
      var w = !winMarked && t === lab.win && (lab.tiles[i + 1] !== t); if (w) winMarked = true;
      return tile(t, { button: true, idx: i, win: w, sel: labSel === i });
    }).join('') : '<span class="empty">牌がありません。下の一覧から追加してください。</span>';
    $('#lab-tileacts').hidden = labSel == null;
    $('#lab-handhelp').textContent = lab.tiles.length >= 14 ? '14枚そろっています。牌をタップ → 和了牌に指定／外す（外すと追加できます）。' : '牌をタップ → 和了牌に指定／外す。下の一覧から追加（各牌4枚まで・右下の数字は残り枚数）。';
    $('#lab-picker').innerHTML = Array.from({ length: 34 }, function (_, i) {
      return tile(i, { button: true, cnt: 4 - c[i], disabled: c[i] >= 4 || lab.tiles.length >= 14 });
    }).join('');
    renderSettings();
    renderLabResult();
    saveLab();
  }
  function seg(key, opts) {
    return '<div class="seg" data-key="' + key + '">' + opts.map(function (o) {
      return '<button data-v="' + o[0] + '" class="' + (String(lab[key]) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function renderSettings() {
    $('#lab-settings').innerHTML = '<h2>条件</h2>' +
      '<div class="srow"><span>和了</span>' + seg('method', [['ron', 'ロン'], ['tsumo', 'ツモ']]) + '</div>' +
      '<div class="srow"><span>親子</span>' + seg('dealer', [[false, '子'], [true, '親']]) + '</div>' +
      (lab.autoYaku ? '' : '<div class="srow"><span>門前</span>' + seg('closed', [[true, '門前'], [false, '鳴きあり']]) + '</div>') +
      '<div class="srow"><span>自風</span>' + seg('seat', [[0, '東'], [1, '南'], [2, '西'], [3, '北']]) + '</div>' +
      '<div class="srow"><span>場風</span>' + seg('round', [[0, '東'], [1, '南'], [2, '西'], [3, '北']]) + '</div>' +
      '<div class="srow"><span>待ち</span>' + seg('wait', [['自動', '自動'], ['両面', '両面'], ['嵌張', '嵌張'], ['辺張', '辺張'], ['単騎', '単騎'], ['双碰', '双碰']]) + '</div>' +
      '<div class="srow"><span>役判定</span>' + seg('autoYaku', [[false, '手入力'], [true, '自動判定']]) + '</div>' +
      (lab.autoYaku ? '<div class="srow"><span>立直</span>' + seg('riichiLv', [[0, 'なし'], [1, '立直'], [2, '立直一発']]) + '</div>' +
        '<div class="srow"><span>海底河底</span>' + seg('lastTile', [[0, 'なし'], [1, '最後の牌']]) + '</div>' +
        '<div class="srow"><span>ドラ</span><div class="stepper"><button class="btn sm" data-dora="-1">−</button><b>' + (lab.dora || 0) + '枚</b><button class="btn sm" data-dora="1">＋</button></div><span class="fine" style="width:auto">裏ドラ含む</span></div>'
      : '<div class="srow"><span>翻</span><div class="stepper"><button class="btn sm" data-han="-1">−</button><b>' + lab.han + '翻</b><button class="btn sm" data-han="1">＋</button></div><span class="fine" style="width:auto">役＋ドラの合計</span></div>') +
      '<p class="fine">親を選ぶと自風は東になります。待ち「自動」は和了牌から判定（複数の解釈があれば符の高い方）。</p>';
  }
  function renderLabResult() {
    var r = $('#lab-result');
    var a = E.analyze(lab.tiles, { winTile: lab.win, method: lab.method, closed: lab.closed, seat: lab.seat, round: lab.round, openTriplets: lab.open, kans: lab.kans, waitOverride: lab.wait });
    if (!a.valid) { r.innerHTML = '<h2>計算結果</h2><p class="warn">' + a.reason + '</p>'; return; }
    var o = a.best, h = '<h2>計算結果</h2>', han = lab.han, yk = null;
    var notice = $('#lab-notice');
    notice.textContent = lab.autoYaku ? '✓ 役を自動判定しています。鳴いた面子は下の「面子の指定」でポン・チー・明槓・暗槓にしてください（ドラは枚数で入力）。' : '⚠ 役は自動判定しません（設定で「自動判定」にできます）。翻（役＋ドラ）は自分で設定してください。';
    notice.classList.toggle('ok', !!lab.autoYaku);
    if (lab.autoYaku) {
      // 面子の指定（鳴き）：門前で分解した面子ごとに ポン／チー／明槓／暗槓 を指定
      var a0 = E.analyze(lab.tiles, { winTile: lab.win, method: lab.method, closed: true, seat: lab.seat, round: lab.round, openTriplets: [], kans: [], waitOverride: '自動' });
      var g0 = a0.valid ? a0.best.groups : [], marks = lab.marks || (lab.marks = {}), seen = {}, meldsIn = [], rest = lab.tiles.slice();
      var markRow = '';
      g0.forEach(function (g) {
        var base = (g.type === 'sequence' ? 's' : 't') + g.tile; seen[base] = (seen[base] || 0) + 1;
        var key = base + '#' + seen[base], m = marks[key] || '';
        var label = { '': g.type === 'sequence' ? '門前' : '暗刻', pon: 'ポン', chi: 'チー', minkan: '明槓', ankan: '暗槓' }[m];
        markRow += '<div class="group"><div class="hand">' + tiles(g.tiles, { sm: true }) + '</div><button class="btn sm' + (m ? ' primary' : '') + '" data-mark="' + key + '" data-mt="' + g.type + '">' + label + '</button></div>';
        if (m) {
          g.tiles.forEach(function (t) { var i = rest.indexOf(t); if (i >= 0) rest.splice(i, 1); });
          meldsIn.push({ type: m, tiles: m === 'minkan' || m === 'ankan' ? [g.tile, g.tile, g.tile, g.tile] : g.tiles });
        }
      });
      h += '<h3>面子の指定（鳴き）</h3><div class="groups">' + markRow + '</div><p class="fine">ボタンを押すたびに切り替わります。刻子：暗刻→ポン→明槓→暗槓、順子：門前→チー。槓子は4枚目を自動で足して計算します。和了牌を含む面子は鳴いた面子にできません。</p>';
      if (meldsIn.length && rest.indexOf(lab.win) < 0) { r.innerHTML = h + '<p class="warn">和了牌が鳴いた面子の中にあります。和了牌を含まない面子を指定してください。</p>'; return; }
      var ry = window.Yaku.evaluate(meldsIn.length ? { closed: rest, melds: meldsIn } : lab.tiles, { winTile: lab.win, method: lab.method, seat: lab.seat, round: lab.round, dealer: lab.dealer,
        riichi: lab.riichiLv > 0, ippatsu: lab.riichiLv === 2, haitei: !!lab.lastTile, houtei: !!lab.lastTile, doraIndicators: [] });
      if (!ry || !ry.valid) { r.innerHTML = h + '<p class="warn">役がありません。ドラだけでは和了できません（' + (meldsIn.some(function (m) { return m.type !== 'ankan'; }) ? '鳴いた手は立直・平和・門前ツモが付きません' : '立直をかける・役のある形にする') + '）。</p>'; return; }
      if (meldsIn.some(function (m) { return m.type !== 'ankan'; }) && lab.riichiLv) h += '<p class="fine">※鳴いた手は立直できないため、立直・一発は数えません。</p>';
      han = ry.yakuman ? 13 * ry.yakuman : ry.han + (lab.dora || 0);
      yk = ry.yaku.map(function (y) { return [y.name, y.han]; });
      if (!ry.yakuman && lab.dora) yk.push(['ドラ', lab.dora]);
      h += '<h3>判定された役</h3><p class="gold">' + yk.map(function (y) { return y[0] + ' ' + (ry.yakuman ? '' : y[1] + '翻'); }).join('・') + '</p>';
      var kuisagari = ry.yaku.filter(function (y) { return !ry.menzen && ['混全帯幺九', '純全帯幺九', '一気通貫', '三色同順', '混一色', '清一色'].indexOf(y.name) >= 0; });
      if (kuisagari.length) h += '<p class="fine">喰い下がり：' + kuisagari.map(function (y) { return y.name; }).join('・') + ' は鳴くと1翻下がります。</p>';
      if (ry.yakuman || ry.opt.kokushi) {
        var pc = window.Yaku.payment(ry, { method: lab.method, dealer: lab.dealer });
        r.innerHTML = h + '<div class="ribbon"><span class="r-han">' + pc.limit + '</span><span class="r-pt">' + (lab.method === 'ron' ? E.fmt(pc.ron) + '点' : lab.dealer ? E.fmt(pc.dealerPay) + '点オール' : E.fmt(pc.childPay) + '/' + E.fmt(pc.dealerPay) + '点') + '</span></div>';
        return;
      }
      o = ry.opt;
      a = { options: [o], best: o, valid: true };
    }
    if (!o.chiitoi) {
      h += '<h3>面子の分け方（自動）</h3><div class="groups">' + o.groups.map(function (g) {
        var inner = '<div class="hand">' + tiles(g.tiles, { sm: true }) + '</div>';
        if (g.type === 'sequence') return '<div class="group">' + inner + '<span class="gl">' + (g.meld === 'chi' ? 'チー ' : '') + '順子 0符</span></div>';
        var isOpen = lab.open.indexOf(g.tile) >= 0, isKan = lab.kans.indexOf(g.tile) >= 0;
        if (yk) return '<div class="group">' + inner + '<span class="gl">' + (g.open ? '明' : '暗') + (g.kan ? '槓' : '刻') + ' ' + g.fu + '符</span></div>';
        return '<div class="group">' + inner + '<span class="gl">' + (g.open ? '明' : '暗') + (g.kan ? '槓' : '刻') + ' ' + g.fu + '符</span><div class="row gap">' +
          (lab.closed ? '' : '<button class="btn sm" data-open="' + g.tile + '">' + (isOpen ? 'ポン済→暗' : 'ポンにする') + '</button>') +
          '<button class="btn sm" data-kan="' + g.tile + '">' + (isKan ? '槓→刻' : '槓子にする') + '</button></div></div>';
      }).join('') + '<div class="group"><div class="hand">' + tiles([o.pair, o.pair], { sm: true }) + '</div><span class="gl">雀頭</span></div></div>';
      if (!lab.closed && !yk) h += '<p class="fine">鳴きありの場合、ポンした刻子を「ポンにする」で明刻にしてください（チーは順子なので符に影響しません）。</p>';
      if (o.groups.some(function (g) { return g.ronComplete; })) h += '<p class="fine">※ロン和了で完成した刻子は明刻として数えます。</p>';
    }
    h += '<p>待ち：<b>' + o.waitName + '</b>' + (o.chiitoi ? '' : '（' + (o.waitFu ? '+2符' : '0符') + '）') + (o.pinfuShape && !yk ? '　<span class="gold">平和の形です（翻に平和1翻を含めてください）</span>' : '') + '</p>';
    var alts = a.options.filter(function (x) { return x !== o; });
    if (alts.length && !yk) h += '<p class="alt">他の解釈：' + alts.slice(0, 3).map(function (x) { return x.waitName + ' ' + x.fu + '符'; }).join('、') + '（高い方を採用）</p>';
    h += breakdownHTML(o, han, lab.method, lab.dealer, yk, 0).replace(/<h3>面子の分け方<\/h3>[\s\S]*?<\/p>/, '');
    h += '<h3>同じ翻・符の4パターン</h3><table class="qt"><tr><th></th><th>ロン</th><th>ツモ</th></tr>' +
      '<tr><th>子</th><td>' + E.paymentText(han, o.fu, 'ron', false) + '</td><td>' + E.paymentText(han, o.fu, 'tsumo', false) + '</td></tr>' +
      '<tr><th>親</th><td>' + E.paymentText(han, o.fu, 'ron', true) + '</td><td>' + E.paymentText(han, o.fu, 'tsumo', true) + '</td></tr></table>' +
      '<p class="fine">※符は和了り方で変わるため、表はいま計算した' + o.fu + '符のまま比較しています。</p>';
    r.innerHTML = h;
  }
  $('#lab-hand').onclick = function (e) { var b = e.target.closest('.tile'); if (!b) return; var i = +b.dataset.i; labSel = labSel === i ? null : i; renderLab(); };
  $('#lab-setwin').onclick = function () { if (labSel != null) { lab.win = lab.tiles[labSel]; labSel = null; renderLab(); } };
  $('#lab-remove').onclick = function () {
    if (labSel == null) return;
    var t = lab.tiles.splice(labSel, 1)[0]; labSel = null;
    if (lab.tiles.indexOf(t) < 0) { if (lab.win === t) lab.win = null; lab.open = lab.open.filter(function (x) { return x !== t; }); lab.kans = lab.kans.filter(function (x) { return x !== t; }); }
    renderLab();
  };
  $('#lab-picker').onclick = function (e) {
    var b = e.target.closest('.tile'); if (!b || b.disabled) return;
    var t = +b.dataset.t; if (lab.tiles.length >= 14 || counts()[t] >= 4) return;
    lab.tiles.push(t); if (lab.win == null) lab.win = t; labSel = null; renderLab();
  };
  $('#lab-clear').onclick = function () { lab.marks = {}; lab.tiles = []; lab.win = null; lab.open = []; lab.kans = []; labSel = null; renderLab(); };
  $('#lab-preset').onclick = function () {
    lab.marks = {}; lab.preset = ((lab.preset || 0) + 1) % PRESETS.length; var p = PRESETS[lab.preset];
    lab.tiles = p.tiles.map(E.parse); lab.win = E.parse(p.win); lab.han = p.han; lab.open = []; lab.kans = []; labSel = null; renderLab();
  };
  $('#lab-settings').onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.han) { lab.han = Math.max(1, Math.min(13, lab.han + +b.dataset.han)); renderLab(); return; }
    if (b.dataset.dora) { lab.dora = Math.max(0, Math.min(20, (lab.dora || 0) + +b.dataset.dora)); renderLab(); return; }
    var s = b.closest('.seg'); if (!s) return;
    var k = s.dataset.key, v = b.dataset.v;
    lab[k] = v === 'true' ? true : v === 'false' ? false : /^\d$/.test(v) ? +v : v;
    if (k === 'dealer' && lab.dealer) lab.seat = 0;
    if (k === 'dealer' && !lab.dealer && lab.seat === 0) lab.seat = 1;
    if (k === 'seat') lab.dealer = lab.seat === 0;
    if (k === 'closed' && lab.closed) lab.open = [];
    renderLab();
  };
  $('#lab-result').onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return;
    function toggle(arr, t) { var i = arr.indexOf(t); if (i >= 0) arr.splice(i, 1); else arr.push(t); }
    if (b.dataset.open) toggle(lab.open, +b.dataset.open);
    if (b.dataset.kan) toggle(lab.kans, +b.dataset.kan);
    if (b.dataset.mark) {
      var cyc = b.dataset.mt === 'sequence' ? ['', 'chi'] : ['', 'pon', 'minkan', 'ankan'];
      lab.marks = lab.marks || {};
      var cur = lab.marks[b.dataset.mark] || '';
      lab.marks[b.dataset.mark] = cyc[(cyc.indexOf(cur) + 1) % cyc.length];
      if (!lab.marks[b.dataset.mark]) delete lab.marks[b.dataset.mark];
    }
    renderLab();
  };

  // ---------- 早見表 ----------
  var tableSide = 'child';
  function renderTable() {
    var dealer = tableSide === 'dealer', fus = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
    var h = '<table class="qt"><tr><th>符＼翻</th><th>1翻</th><th>2翻</th><th>3翻</th><th>4翻</th></tr>';
    fus.forEach(function (f) {
      h += '<tr><th>' + f + '符</th>';
      for (var han = 1; han <= 4; han++) {
        var na = (f === 20 && han === 1) || (f === 25 && han === 1);
        if (na) { h += '<td>—</td>'; continue; }
        var c = E.calculate(han, f, 'ron', dealer);
        var ron = f === 20 ? '—' : E.fmt(c.ron);
        var ts = E.paymentText(han, f, 'tsumo', dealer).replace('点', '').replace('オール', '∀');
        h += '<td class="' + (c.limit ? 'mg' : '') + '">' + ron + '<small>' + ts + '</small></td>';
      }
      h += '</tr>';
    });
    h += '</table><table class="qt" style="margin-top:8px"><tr><th>上限</th><th>翻</th><th>ロン</th><th>ツモ</th></tr>';
    [['満貫', 5], ['跳満', 6], ['倍満', 8], ['三倍満', 11], ['役満', 13]].forEach(function (x) {
      h += '<tr><th>' + x[0] + '</th><td>' + (x[1] === 5 ? '5（4翻40符・3翻70符〜）' : x[1] === 13 ? '13〜' : x[1] + '〜') + '</td><td>' + E.paymentText(x[1], 30, 'ron', dealer) + '</td><td>' + E.paymentText(x[1], 30, 'tsumo', dealer) + '</td></tr>';
    });
    h += '</table><p class="fine">上段＝ロン、下段＝ツモ（' + (dealer ? '∀＝オール' : '子/親の支払い') + '）。金色は満貫。20符はツモ（平和ツモ）のみ、25符は七対子（2翻〜）。切り上げ満貫は採用していません（4翻30符＝' + (dealer ? '11,600' : '7,700') + '点）。</p>';
    $('#table-body').innerHTML = h;
  }
  $('#table-seg').onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return; tableSide = b.dataset.v;
    this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderTable();
  };

  // ---------- ヒント ----------
  var FU_TABLE = '<table class="mini"><tr><th>項目</th><th>符</th></tr><tr><td>副底</td><td>20</td></tr><tr><td>門前ロン</td><td>+10</td></tr><tr><td>ツモ（平和ツモ除く）</td><td>+2</td></tr><tr><td>役牌の雀頭</td><td>+2（連風+4）</td></tr><tr><td>嵌張・辺張・単騎</td><td>+2</td></tr><tr><td>刻子 中張 明/暗</td><td>2 / 4</td></tr><tr><td>刻子 幺九・字 明/暗</td><td>4 / 8</td></tr><tr><td>槓子 中張 明/暗</td><td>8 / 16</td></tr><tr><td>槓子 幺九・字 明/暗</td><td>16 / 32</td></tr></table>';
  var FORMULA = '<p><b>基本点 ＝ 符 × 2<sup>(翻+2)</sup></b>（2,000以上は満貫）<br>ロン：子×4／親×6　ツモ：子の和了は親×2・子×1、親の和了は全員×2。すべて100点単位で切り上げ。</p>';
  function renderHint() {
    var h = '';
    if (current === 'quiz') {
      var q = Q[qi];
      h += '<p><b>この問題の手がかり：</b>' + esc(q.hint) + '</p><p>手順：①役の翻を合計（ドラも足す）→ ②符を数えて切り上げ → ③基本点 → ④ロン/ツモ・親/子で支払い。</p><p>5翻以上は符に関係なく満貫以上です。</p>';
    } else if (current === 'lessons') {
      h += '<p><b>いまのレッスン：</b>' + L[lesson].title + '</p><p>まずは20符から、足した理由を一つずつ見てみましょう。</p>';
    } else if (current === 'lab') {
      h += '<ul><li>手牌の牌をタップ → 「和了牌にする」で金枠の和了牌を指定。</li><li>ロン/ツモや待ちを変えると、符がどう変わるか比べられます。</li><li>刻子は「槓子にする」で槓子の符（×4）を試せます。</li><li>役は自動判定しないので、翻は自分で合わせてください。</li></ul>';
    } else {
      h += '<p>「符の学習」で基礎を学び、「点数クイズ」で確認、「点数研究室」で自由に試すのがおすすめです。</p>';
    }
    h += '<h3>符の一覧</h3>' + FU_TABLE + '<p class="fine">例外：平和ツモ20符固定／七対子25符固定。合計は10符単位で切り上げ（通常手の最低は30符）。</p><h3>点数の式</h3>' + FORMULA;
    $('#hint-body').innerHTML = h;
  }

  function openModal(id) { $(id).hidden = false; }
  $('#fab-table').onclick = function () { renderTable(); openModal('#m-table'); };
  $('#fab-hint').onclick = function () { renderHint(); openModal('#m-hint'); };
  document.querySelectorAll('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(function (m) { m.hidden = true; }); });

  // ---------- 設定 ----------
  var PREVIEW = ['1p', '5p', '9p', '1s', '5s', '9s', '5m', '7z'];
  var PREVIEW_HAND = ['2m', '3m', '4m', '5p', '6p', '7p', '7s', '8s', '9s', '1z', '1z', '1z', '9p', '9p'];
  function renderSettingsView() {
    var h = '<h2>牌の絵柄</h2><div class="style-opts">';
    ['A', 'B', 'C'].forEach(function (k) {
      h += '<button class="style-opt' + (settings.style === k ? ' on' : '') + '" data-style="' + k + '"><b>' + STYLE_NAMES[k] + '</b>' +
        '<small>' + { A: '本物に近い伝統的な絵柄（大きめ表示推奨）', B: '太く単純な図形で見やすい（標準）', C: '大きな数字＋記号。初心者向け・小さくても読める' }[k] + '</small>' +
        '<span class="hand prev">' + PREVIEW.map(function (t) { return tile(t, { style: k }); }).join('') + '</span></button>';
    });
    h += '</div><h2>牌の大きさ</h2><div class="seg" id="size-seg"><button data-size="std" class="' + (settings.size === 'std' ? 'on' : '') + '">標準</button><button data-size="lg" class="' + (settings.size === 'lg' ? 'on' : '') + '">大きめ</button></div>' +
      '<p class="fine">大きめにすると14枚の手牌は2段に折り返します。Aクラシックを選ぶと自動で「大きめ」になります（あとから変更できます）。</p>' +
      '<h2>プレビュー（手牌14枚）</h2><div class="hand">' + tiles(PREVIEW_HAND) + '</div>' +
      '<p class="fine">赤ドラ（赤い5）：</p><div class="hand">' + ['5m', '5p', '5s'].map(function (t) { return tile(t, { red: true }); }).join('') + '</div>';
    var go = window.GameUI ? window.GameUI.opts : null;
    if (go) {
      var gseg = function (k, list) { return '<div class="seg">' + list.map(function (o) { return '<button data-gopt="' + k + '" data-v="' + o[0] + '" class="' + (String(go[k]) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>'; };
      h += '<h2>対局</h2><h3>CPUの強さ</h3>' + gseg('cpuLevel', [['easy', '初級'], ['normal', '中級'], ['hard', '上級']]) +
        '<p class="fine">初級：鳴かずに素直に手を進め、リーチには安全牌を探す程度。中級：役牌や速い手で鳴き、リーチには降りる。上級：手の価値と危険度で押し引きし、ダマ・リーチを選び、終盤の危険牌を避けます。どの強さもあなたの手牌や山は見ません。次の対局から反映されます。</p>' +
        '<h3>鳴きの確認を出す</h3>' + gseg('callConfirm', [[true, 'オン'], [false, 'オフ']]) +
        '<p class="fine">オフにすると、ポン・チー・カンの確認を出さずに自動でスルーします（ロンの確認は常に出ます）。</p>';
    }
    $('#settings-body').innerHTML = h;
  }
  $('#settings-body').onclick = function (e) {
    var g = e.target.closest('[data-gopt]');
    if (g && window.GameUI) { var gv = g.dataset.v; window.GameUI.opts[g.dataset.gopt] = gv === 'true' ? true : gv === 'false' ? false : gv; window.GameUI.saveOpts(); renderSettingsView(); return; }
    var b = e.target.closest('[data-style],[data-size]'); if (!b) return;
    if (b.dataset.style) { settings.style = b.dataset.style; if (settings.style === 'A') settings.size = 'lg'; }
    if (b.dataset.size) settings.size = b.dataset.size;
    applySettings(); renderSettingsView(); renderLesson(); renderQuiz(); renderLab();
    $('#rules-body').innerHTML = '';
  };
  $('#rules-body').onclick = function (e) {
    var a = e.target.closest('[data-jump]'); if (!a) return;
    e.preventDefault(); var t = document.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth' });
  };
  $('#gear').onclick = function () { location.hash = '#settings'; };

  // ---------- 起動 ----------
  window.DojoUI = { tile: tile, tiles: tiles, breakdownHTML: breakdownHTML, settings: settings };
  applySettings(); renderLesson(); renderQuiz(); renderLab(); route();
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
})();
