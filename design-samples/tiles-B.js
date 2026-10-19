/* スタイルB フラット：単純化した太い図形・高コントラスト */
(function (root) {
  var C = root.TileCommon || require('./tiles-common.js');
  var COL = { b: '#1557c0', g: '#0e7a4a', r: '#d42a2a' };
  function circle(x, y, r, k) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + COL[k] + '"/><circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.38).toFixed(2) + '" fill="#fff7e8"/>'; }
  function bar(x, y, deg, k, len) {
    return '<rect x="' + (x - 3.6) + '" y="' + (y - len / 2) + '" width="7.2" height="' + len + '" rx="3.6" fill="' + COL[k] + '" transform="rotate(' + deg + ' ' + x + ' ' + y + ')"/>';
  }
  function bird() { // 一索：単純な鳥のシルエット
    return '<path d="M12 58 Q20 34 36 36 L44 26 Q50 24 52 30 L46 34 Q48 54 30 60 Z" fill="#0e7a4a"/><path d="M12 58 L6 66 L20 62 Z" fill="#0e7a4a"/>' +
      '<path d="M52 28 L58 30 L52 32 Z" fill="#d42a2a"/><circle cx="47" cy="29" r="1.8" fill="#fff7e8"/><path d="M24 46 Q32 40 40 46 Q32 52 24 46 Z" fill="#d42a2a"/>' +
      '<rect x="26" y="60" width="3" height="10" fill="#d42a2a"/><rect x="33" y="59" width="3" height="11" fill="#d42a2a"/>';
  }
  function svg(code, opts) {
    var t = C.parse(code), inner = '', F = C.SANS;
    opts = Object.assign({ label: C.label(code) }, opts || {});
    if (t.s === 'p') {
      var P = C.PIN[t.n];
      inner = t.n === 1 ? '<circle cx="30" cy="39" r="21" fill="#1557c0"/><circle cx="30" cy="39" r="13" fill="#fff7e8"/><circle cx="30" cy="39" r="8" fill="#d42a2a"/>'
        : P.pts.map(function (p) { return circle(p[0], p[1], P.r + 0.6, p[2]); }).join('');
    } else if (t.s === 's') {
      if (t.n === 1) inner = bird();
      else { var S = C.SOU[t.n]; inner = S.pts.map(function (p) { return bar(p[0], p[1], p[2], p[3] === 'r' ? 'r' : 'g', S.len); }).join(''); }
    } else if (t.s === 'm') {
      inner = C.text(30, 24, C.KANJI[t.n - 1], 30, '#111', F, ' font-weight="900"') + C.text(30, 58, '萬', 26, '#d42a2a', F);
    } else {
      if (t.n === 5) inner = '<rect x="12" y="14" width="36" height="50" rx="5" fill="none" stroke="#1557c0" stroke-width="6"/>';
      else inner = C.text(30, 40, C.HONOR[t.n - 1], 44, t.n === 6 ? '#0e7a4a' : t.n === 7 ? '#d42a2a' : '#111', F, ' font-weight="900"');
    }
    return C.wrap(inner, opts, { stroke: '#cbbb8c', back: '#c4b07a' });
  }
  var api = { name: 'B フラット', svg: svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TilesB = api;
})(this);
