/* 点数道場 — UI */
(function () {
  'use strict';
  var E = window.Engine, Q = window.QUESTIONS, L = window.LESSONS;
  var $ = function (s) { return document.querySelector(s); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('dojo.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('dojo.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- 牌の描画 ----------
  var KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  function tileInner(i) {
    if (i < 9) return { cls: 'm', html: '<b>' + KANJI[i] + '</b><i>萬</i>' };
    if (i < 18) return { cls: 'p', html: '<b>' + (i - 8) + '</b><i>筒</i>' };
    if (i < 27) return { cls: 's', html: '<b>' + (i - 17) + '</b><i>索</i>' };
    var h = ['東', '南', '西', '北', '', '發', '中'][i - 27];
    var extra = i === 31 ? ' haku' : i === 32 ? ' hatsu' : i === 33 ? ' chun' : '';
    return { cls: 'z' + extra, html: '<b>' + h + '</b>' };
  }
  function tile(t, o) {
    o = o || {};
    var i = E.parse(t), d = tileInner(i), tag = o.button ? 'button' : 'span';
    var cls = 'tile ' + d.cls + (o.sm ? ' sm' : '') + (o.win ? ' win' : '') + (o.sel ? ' sel' : '');
    return '<' + tag + ' class="' + cls + '" data-t="' + i + '"' + (o.idx != null ? ' data-i="' + o.idx + '"' : '') +
      (o.disabled ? ' disabled' : '') + ' aria-label="' + E.name(i) + '"' + (o.button ? ' type="button"' : '') + '>' + d.html +
      (o.cnt != null ? '<span class="cnt">' + o.cnt + '</span>' : '') + '</' + tag + '>';
  }
  function tiles(list, o) { return list.map(function (t) { return tile(t, o); }).join(''); }

  // ---------- 画面遷移（状態は各画面に保持） ----------
  var TITLES = { home: '点数道場', lessons: '符の学習', quiz: '点数クイズ', lab: '点数研究室', flow: '牌の流れと確率' };
  var current = 'home';
  function route() {
    var v = (location.hash || '#home').slice(1);
    if (!TITLES[v]) v = 'home';
    current = v;
    document.querySelectorAll('.view').forEach(function (s) { s.hidden = s.id !== 'v-' + v; });
    $('#title').textContent = TITLES[v];
    $('#back').hidden = v === 'home';
    if (v === 'home') renderHome();
    window.scrollTo(0, 0);
  }
  $('#back').onclick = function () { location.hash = '#home'; };
  window.addEventListener('hashchange', route);

  function renderHome() {
    $('#logo').innerHTML = '<span class="tile m"><b>点</b></span><span class="tile" style="color:#b48a1e"><b>符</b></span><span class="tile s"><b>道</b></span>';
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
      '<div class="srow"><span>門前</span>' + seg('closed', [[true, '門前'], [false, '鳴きあり']]) + '</div>' +
      '<div class="srow"><span>自風</span>' + seg('seat', [[0, '東'], [1, '南'], [2, '西'], [3, '北']]) + '</div>' +
      '<div class="srow"><span>場風</span>' + seg('round', [[0, '東'], [1, '南'], [2, '西'], [3, '北']]) + '</div>' +
      '<div class="srow"><span>待ち</span>' + seg('wait', [['自動', '自動'], ['両面', '両面'], ['嵌張', '嵌張'], ['辺張', '辺張'], ['単騎', '単騎'], ['双碰', '双碰']]) + '</div>' +
      '<div class="srow"><span>翻</span><div class="stepper"><button class="btn sm" data-han="-1">−</button><b>' + lab.han + '翻</b><button class="btn sm" data-han="1">＋</button></div><span class="fine" style="width:auto">役＋ドラの合計</span></div>' +
      '<p class="fine">親を選ぶと自風は東になります。待ち「自動」は和了牌から判定（複数の解釈があれば符の高い方）。</p>';
  }
  function renderLabResult() {
    var r = $('#lab-result');
    var a = E.analyze(lab.tiles, { winTile: lab.win, method: lab.method, closed: lab.closed, seat: lab.seat, round: lab.round, openTriplets: lab.open, kans: lab.kans, waitOverride: lab.wait });
    if (!a.valid) { r.innerHTML = '<h2>計算結果</h2><p class="warn">' + a.reason + '</p>'; return; }
    var o = a.best, h = '<h2>計算結果</h2>';
    if (!o.chiitoi) {
      h += '<h3>面子の分け方（自動）</h3><div class="groups">' + o.groups.map(function (g) {
        var inner = '<div class="hand">' + tiles(g.tiles, { sm: true }) + '</div>';
        if (g.type === 'sequence') return '<div class="group">' + inner + '<span class="gl">順子 0符</span></div>';
        var isOpen = lab.open.indexOf(g.tile) >= 0, isKan = lab.kans.indexOf(g.tile) >= 0;
        return '<div class="group">' + inner + '<span class="gl">' + (g.open ? '明' : '暗') + (g.kan ? '槓' : '刻') + ' ' + g.fu + '符</span><div class="row gap">' +
          (lab.closed ? '' : '<button class="btn sm" data-open="' + g.tile + '">' + (isOpen ? 'ポン済→暗' : 'ポンにする') + '</button>') +
          '<button class="btn sm" data-kan="' + g.tile + '">' + (isKan ? '槓→刻' : '槓子にする') + '</button></div></div>';
      }).join('') + '<div class="group"><div class="hand">' + tiles([o.pair, o.pair], { sm: true }) + '</div><span class="gl">雀頭</span></div></div>';
      if (!lab.closed) h += '<p class="fine">鳴きありの場合、ポンした刻子を「ポンにする」で明刻にしてください（チーは順子なので符に影響しません）。</p>';
      if (o.groups.some(function (g) { return g.ronComplete; })) h += '<p class="fine">※ロン和了で完成した刻子は明刻として数えます。</p>';
    }
    h += '<p>待ち：<b>' + o.waitName + '</b>' + (o.chiitoi ? '' : '（' + (o.waitFu ? '+2符' : '0符') + '）') + (o.pinfuShape ? '　<span class="gold">平和の形です（翻に平和1翻を含めてください）</span>' : '') + '</p>';
    var alts = a.options.filter(function (x) { return x !== o; });
    if (alts.length) h += '<p class="alt">他の解釈：' + alts.slice(0, 3).map(function (x) { return x.waitName + ' ' + x.fu + '符'; }).join('、') + '（高い方を採用）</p>';
    h += breakdownHTML(o, lab.han, lab.method, lab.dealer).replace(/<h3>面子の分け方<\/h3>[\s\S]*?<\/p>/, '');
    h += '<h3>同じ翻・符の4パターン</h3><table class="qt"><tr><th></th><th>ロン</th><th>ツモ</th></tr>' +
      '<tr><th>子</th><td>' + E.paymentText(lab.han, o.fu, 'ron', false) + '</td><td>' + E.paymentText(lab.han, o.fu, 'tsumo', false) + '</td></tr>' +
      '<tr><th>親</th><td>' + E.paymentText(lab.han, o.fu, 'ron', true) + '</td><td>' + E.paymentText(lab.han, o.fu, 'tsumo', true) + '</td></tr></table>' +
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
  $('#lab-clear').onclick = function () { lab.tiles = []; lab.win = null; lab.open = []; lab.kans = []; labSel = null; renderLab(); };
  $('#lab-preset').onclick = function () {
    lab.preset = ((lab.preset || 0) + 1) % PRESETS.length; var p = PRESETS[lab.preset];
    lab.tiles = p.tiles.map(E.parse); lab.win = E.parse(p.win); lab.han = p.han; lab.open = []; lab.kans = []; labSel = null; renderLab();
  };
  $('#lab-settings').onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.han) { lab.han = Math.max(1, Math.min(13, lab.han + +b.dataset.han)); renderLab(); return; }
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

  // ---------- 起動 ----------
  renderLesson(); renderQuiz(); renderLab(); route();
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
})();
