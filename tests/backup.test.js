// 実行: node tests/backup.test.js — 引っ越し用 書き出し/読み込み（js/backup.js）
const B = require('../js/backup.js');
let pass = 0, fail = 0;
function ok(label, cond, info) { if (cond) pass++; else { fail++; console.log('✗ ' + label + (info !== undefined ? ' — ' + JSON.stringify(info) : '')); } }
function fakeLS(init, limit) {
  const m = new Map(Object.entries(init || {}));
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (limit && m.size >= limit && !m.has(k)) { const e = new Error('QuotaExceededError'); throw e; } m.set(k, String(v)); }, removeItem: (k) => m.delete(k), _m: m };
}
const base = { 'dojo.quizStats': JSON.stringify({ right: 12, wrong: 3 }), 'dojo.settings': JSON.stringify({ style: 'A', size: 'lg' }),
  'dojo.gameOpts': JSON.stringify({ cpuLevel: 'hard', history: [{ score: 32000 }] }), 'dojo.lessonsDone': '[1,2,3]', 'weekStart': '1', 'lifelog.other': 'x' };

ok('ファイル名', B.fileName(new Date(2026, 9, 20)) === 'hai-no-ri-all-v1-2026-10-20.json', B.fileName(new Date(2026, 9, 20)));
const ex = B.buildExport(fakeLS(base), Date.UTC(2026, 9, 20));
ok('ヘッダ', ex.app === 'hai-no-ri' && ex.version === 1 && ex.exportedAt.startsWith('2026-10-20'));
ok('dojo.* を全部・他アプリのキーは入れない', Object.keys(ex.data).length === 4 && !('weekStart' in ex.data) && !('lifelog.other' in ex.data), Object.keys(ex.data));
ok('JSON往復で検証OK', B.validate(JSON.parse(JSON.stringify(ex))).length === 0);

// 置き換え
let ls = fakeLS({ 'dojo.quizStats': '{"right":0}', 'dojo.lab': '{}', weekStart: '0' });
let r = B.apply(ls, ex, 'replace');
ok('置き換え：ファイルの内容になる', B.snapshot(ls)['dojo.quizStats'] === base['dojo.quizStats'] && ls.getItem('dojo.lab') === null && r.written === 4);
ok('置き換え：他アプリのキーは触らない', ls.getItem('weekStart') === '0');
// 統合
ls = fakeLS({ 'dojo.quizStats': '{"right":99}', 'dojo.lab': '{"a":1}' });
B.apply(ls, ex, 'merge');
ok('統合：端末の値は残し、ないものだけ足す', ls.getItem('dojo.quizStats') === '{"right":99}' && ls.getItem('dojo.lab') === '{"a":1}' && ls.getItem('dojo.settings') === base['dojo.settings']);

// 不正なファイルは 何も変えない
const bads = [null, [], { app: 'lifelog', version: 1, data: {} }, { ...ex, version: 2 }, { ...ex, version: 'x' }, { ...ex, data: [] },
  { ...ex, data: { 'dojo.quizStats': '{broken' } }, { ...ex, data: { 'dojo.quizStats': 5 } }, { ...ex, data: { weekStart: '1' } }];
bads.forEach((b, i) => {
  const l = fakeLS({ 'dojo.quizStats': '{"right":7}' });
  let threw = false; try { B.apply(l, b, 'replace'); } catch (e) { threw = true; }
  ok('不正ファイル' + i + 'は はじいて 今のデータはそのまま', threw && l.getItem('dojo.quizStats') === '{"right":7}' && l.length === 1);
});
ok('他アプリのエラー文', /このアプリのファイルではありません/.test(B.validate({ app: 'kotoba-album', version: 2, data: {} })[0]));
ok('新しすぎる版のエラー文', /新しすぎる/.test(B.validate({ ...ex, version: 9 })[0]));

// 書き込み途中で容量不足 → 元に戻す
ls = fakeLS({ 'dojo.quizStats': '{"right":7}', 'dojo.lab': '{"a":1}' }, 2);
let threw = false; try { B.apply(ls, ex, 'replace'); } catch (e) { threw = /元に戻しました/.test(e.message); }
ok('容量不足でも元に戻る', threw && ls.getItem('dojo.quizStats') === '{"right":7}' && ls.getItem('dojo.lab') === '{"a":1}' && ls.length === 2, B.snapshot(ls));

// SW / index.html
const fs = require('fs'), path = require('path');
const sw = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
ok('SW に backup.js・版 v5', /'\.\/js\/backup\.js'/.test(sw) && /tensu-dojo-v5/.test(sw));
ok('index.html にボタン', html.includes('データを書き出す') && html.includes('データを読み込む') && html.includes('js/backup.js'));
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
