/* 牌の理 — 引っ越し用「データを書き出す／データを読み込む」（機種変更向け）。
   保存データはすべて localStorage の「dojo.」で始まるキー（成績・クイズ/レッスンの進み具合・研究室・設定・対局の途中・対局設定）。
   同じ github.io の他アプリのキーは触らない。読み込みは 先に全部検証 → 確認 → 置き換え（既定）／統合。
   書き込み中に失敗したら元に戻す（スナップショットから復元）。ブラウザでは window.DojoBackup、Node では module.exports。 */
(function (root) {
  'use strict';
  var APP = 'hai-no-ri';
  var SCHEMA = 1;
  var PREFIX = 'dojo.';
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function localDate(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fileName(d) { return 'hai-no-ri-all-v' + SCHEMA + '-' + localDate(d) + '.json'; }
  function keys(ls) { var out = []; for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(PREFIX) === 0) out.push(k); } return out.sort(); }
  function snapshot(ls) { var o = {}; keys(ls).forEach(function (k) { o[k] = ls.getItem(k); }); return o; }

  function buildExport(ls, now) {
    return { app: APP, version: SCHEMA, schema: SCHEMA, exportedAt: new Date(now || Date.now()).toISOString(), data: snapshot(ls) };
  }

  /* 形の検証。戻り値: エラーの一覧（空なら OK） */
  function validate(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['JSONの形が違います'];
    if (obj.app !== APP) return ['このアプリのファイルではありません（app: ' + (obj.app || 'なし') + '）'];
    var v = Number(obj.version);
    if (!(v >= 1 && Math.floor(v) === v)) return ['バージョンが不明です'];
    if (v > SCHEMA) return ['新しすぎるファイルです（v' + v + '）。アプリを更新してください'];
    if (!obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) return ['data がありません'];
    var errs = [];
    Object.keys(obj.data).forEach(function (k) {
      if (k.indexOf(PREFIX) !== 0) { errs.push('知らないキー: ' + k); return; }
      var val = obj.data[k];
      if (typeof val !== 'string') { errs.push(k + ' が文字列ではありません'); return; }
      try { JSON.parse(val); } catch (e) { errs.push(k + ' の中身が壊れています'); }
    });
    return errs;
  }

  /* mode: 'replace'（dojo.* を全部消してファイルの内容に） | 'merge'（ファイルにあって端末にないキーだけ足す） */
  function apply(ls, obj, mode) {
    var errs = validate(obj);
    if (errs.length) throw new Error(errs.slice(0, 3).join(' / '));
    var before = snapshot(ls), n = 0;
    try {
      if (mode === 'replace') {
        Object.keys(before).forEach(function (k) { ls.removeItem(k); });
        Object.keys(obj.data).forEach(function (k) { ls.setItem(k, obj.data[k]); n++; });
      } else {
        Object.keys(obj.data).forEach(function (k) { if (ls.getItem(k) === null) { ls.setItem(k, obj.data[k]); n++; } });
      }
    } catch (e) {
      // 容量不足などで失敗 → 元に戻す
      keys(ls).forEach(function (k) { ls.removeItem(k); });
      Object.keys(before).forEach(function (k) { try { ls.setItem(k, before[k]); } catch (_) {} });
      throw new Error('書き込みに失敗したので元に戻しました（' + (e && e.message) + '）');
    }
    return { written: n, mode: mode };
  }

  var LABEL = { 'dojo.quizStats': '問題の成績', 'dojo.quizIdx': '問題の進み', 'dojo.lessonsDone': 'レッスン完了', 'dojo.lessonIdx': 'レッスンの進み', 'dojo.lab': '研究室', 'dojo.settings': '牌の絵柄・大きさ', 'dojo.game': '対局の途中経過', 'dojo.gameOpts': '対局の設定・成績' };
  function summary(obj) { return Object.keys(obj.data).map(function (k) { return '・' + (LABEL[k] || k.slice(PREFIX.length)); }).join('\n'); }

  /* ---- ブラウザのボタン ---- */
  function isIOS() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function saveFile(blob, name, statusEl) {
    var url = URL.createObjectURL(blob);
    var file = typeof File === 'function' ? new File([blob], name, { type: 'application/json' }) : null;
    var canShare = !!(file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] }));
    function fallback() {
      if (!statusEl) return;
      var a = document.createElement('a'); a.href = url; a.download = name; a.className = 'btn wide'; a.style.display = 'block'; a.style.textAlign = 'center'; a.textContent = '⬇ ' + name + ' を保存';
      statusEl.appendChild(a);
      if (canShare) { var b = document.createElement('button'); b.className = 'btn primary wide'; b.textContent = '📤 共有して保存（ファイル／Drive）'; b.onclick = function () { navigator.share({ files: [file], title: name }).catch(function () {}); }; statusEl.appendChild(b); }
    }
    if (canShare && isIOS()) return navigator.share({ files: [file], title: name }).then(function () { return 'shared'; }, function (e) { fallback(); return e && e.name === 'AbortError' ? 'aborted' : 'fallback'; });
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    fallback(); return Promise.resolve('download');
  }
  function bind() {
    var $ = function (id) { return document.getElementById(id); };
    var st = $('bk-status'); if (!st) return;
    $('bk-export').onclick = function () {
      var obj = buildExport(localStorage), name = fileName();
      var blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
      st.innerHTML = ''; var p = document.createElement('p'); p.className = 'fine'; p.style.whiteSpace = 'pre-line';
      p.textContent = name + '（' + Math.max(1, Math.round(blob.size / 1024)) + ' KB）\n' + (summary(obj) || '（まだ保存データはありません）'); st.appendChild(p);
      saveFile(blob, name, st);
    };
    $('bk-import').onchange = function (e) {
      var f = e.target.files[0]; e.target.value = ''; if (!f) return;
      f.text().then(function (text) {
        var obj;
        try { obj = JSON.parse(text); var errs = validate(obj); if (errs.length) throw new Error(errs.slice(0, 3).join(' / ')); }
        catch (err) { st.textContent = '読み込み中止（今のデータはそのまま）: ' + err.message; return; }
        var mode = (document.querySelector('input[name="bk-mode"]:checked') || {}).value === 'merge' ? 'merge' : 'replace';
        var msg = '「' + f.name + '」（v' + obj.version + (obj.exportedAt ? '・' + new Date(obj.exportedAt).toLocaleString('ja-JP') : '') + '）\n\n' + summary(obj) + '\n\n' +
          (mode === 'replace' ? '⚠ 今この端末の成績・履歴・設定を消して、ファイルの内容に置き換えます。よろしいですか？' : '今のデータは残し、端末にない項目だけ足します。よろしいですか？');
        if (!confirm(msg)) { st.textContent = 'キャンセルしました（今のデータはそのまま）'; return; }
        try { var r = apply(localStorage, obj, mode); st.textContent = (mode === 'replace' ? '置き換え完了' : '統合完了') + '：' + r.written + '項目。画面を更新します'; setTimeout(function () { location.reload(); }, 1200); }
        catch (err) { st.textContent = '読み込み失敗: ' + err.message; }
      });
    };
  }

  var api = { APP: APP, SCHEMA: SCHEMA, PREFIX: PREFIX, fileName: fileName, buildExport: buildExport, validate: validate, apply: apply, snapshot: snapshot, bind: bind };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.DojoBackup = api; if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bind); }
})(this);
