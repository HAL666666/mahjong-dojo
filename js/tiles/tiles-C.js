/* スタイルC ミニマル＋数字：大きな数字＋スートの記号。極小サイズ・初心者向け */
(function (root) {
  var C = root.TileCommon || require('./tiles-common.js');
  var SUIT = { p: '#1557c0', s: '#0e7a4a', m: '#d42a2a' };
  function pinIcon(x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="#1557c0" stroke-width="' + r * 0.3 + '"/><circle cx="' + x + '" cy="' + y + '" r="' + r * 0.35 + '" fill="#1557c0"/>'; }
  function souIcon(x, y, h) {
    return '<rect x="' + (x - h * 0.17) + '" y="' + (y - h / 2) + '" width="' + h * 0.34 + '" height="' + h + '" rx="' + h * 0.17 + '" fill="#0e7a4a"/>' +
      '<rect x="' + (x - h * 0.23) + '" y="' + (y - 1.2) + '" width="' + h * 0.46 + '" height="2.4" rx="1.2" fill="#08442a"/>';
  }
  function svg(code, opts) {
    var t = C.parse(code), inner = '', F = C.SANS;
    opts = Object.assign({ label: C.label(code) }, opts || {});
    if (t.s !== 'z') {
      var col = SUIT[t.s];
      inner = C.text(30, 27, String(t.n), 44, col, F, ' font-weight="900"');
      if (t.s === 'p') inner += pinIcon(30, 61, 10);
      else if (t.s === 's') inner += souIcon(30, 61, 22);
      else inner += C.text(30, 61, '萬', 20, col, F);
    } else {
      var col2 = t.n === 6 ? '#0e7a4a' : t.n === 7 ? '#d42a2a' : t.n === 5 ? '#1557c0' : '#111';
      if (t.n === 5) inner = '<rect x="15" y="12" width="30" height="40" rx="4" fill="none" stroke="#1557c0" stroke-width="5"/>';
      else inner = C.text(30, 32, C.HONOR[t.n - 1], 38, col2, F, ' font-weight="900"');
      inner += C.text(30, 67, C.HONOR_KANA[t.n - 1], 11, '#555', F);
    }
    return C.wrap(inner, opts, { stroke: '#cbbb8c' });
  }
  var api = { name: 'C ミニマル＋数字', svg: svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TilesC = api;
})(this);
