/* スタイルA クラシック：本物の牌に近い伝統的な見た目 */
(function (root) {
  var C = root.TileCommon || require('./tiles-common.js');
  var COL = { b: '#1d4f9c', g: '#14704a', r: '#c0262d' };
  function pinCircle(x, y, r, k) {
    var c = COL[k];
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="' + (r * 0.22).toFixed(2) + '"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.62).toFixed(2) + '" fill="none" stroke="' + c + '" stroke-width="' + (r * 0.1).toFixed(2) + '" stroke-dasharray="' + (r * 0.25).toFixed(2) + ' ' + (r * 0.18).toFixed(2) + '"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.3).toFixed(2) + '" fill="' + c + '"/>';
  }
  function onePin() { // 一筒：大きな飾り円
    var s = '<circle cx="30" cy="39" r="22" fill="none" stroke="#14704a" stroke-width="3"/>';
    for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8; s += '<circle cx="' + (30 + 17.5 * Math.cos(a)).toFixed(2) + '" cy="' + (39 + 17.5 * Math.sin(a)).toFixed(2) + '" r="2.2" fill="#1d4f9c"/>'; }
    return s + '<circle cx="30" cy="39" r="12" fill="none" stroke="#c0262d" stroke-width="2.4"/><circle cx="30" cy="39" r="7" fill="#c0262d"/><circle cx="30" cy="39" r="2.4" fill="#fff7e8"/>';
  }
  function stick(x, y, deg, k, len) {
    var c = COL[k], w = 6.4, h = len, top = y - h / 2;
    var s = '<g transform="rotate(' + deg + ' ' + x + ' ' + y + ')">' +
      '<rect x="' + (x - w / 2) + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="3" fill="' + c + '"/>' +
      '<rect x="' + (x - 1) + '" y="' + (top + 2) + '" width="2" height="' + (h - 4) + '" rx="1" fill="#ffffff" opacity=".35"/>';
    [0.5].concat(h > 22 ? [0.22, 0.78] : []).forEach(function (f) {
      s += '<rect x="' + (x - w / 2 - 0.8) + '" y="' + (top + h * f - 1.2) + '" width="' + (w + 1.6) + '" height="2.4" rx="1.2" fill="' + (k === 'r' ? '#7a1016' : '#0b3d29') + '"/>';
    });
    return s + '</g>';
  }
  function bird() { // 一索：孔雀風の鳥
    return '<path d="M16 66 Q8 50 18 40 Q14 54 24 60 Z" fill="#14704a"/><path d="M22 70 Q16 52 26 44 Q24 58 32 64 Z" fill="#1d4f9c"/>' +
      '<ellipse cx="34" cy="48" rx="12" ry="15" fill="#14704a"/><ellipse cx="36" cy="50" rx="6" ry="9" fill="#c0262d"/>' +
      '<circle cx="40" cy="26" r="7" fill="#14704a"/><path d="M46 25 L54 28 L46 30 Z" fill="#c0262d"/><circle cx="41.5" cy="24.5" r="1.8" fill="#fff7e8"/>' +
      '<path d="M37 19 Q36 11 42 9 Q40 14 41 19 Z" fill="#c0262d"/><path d="M30 62 L28 72 M36 63 L36 72" stroke="#c0262d" stroke-width="2"/>';
  }
  function svg(code, opts) {
    var t = C.parse(code), inner = '', F = C.SERIF;
    opts = Object.assign({ label: C.label(code) }, opts || {});
    if (t.s === 'p') {
      if (t.n === 1) inner = onePin();
      else { var P = C.PIN[t.n]; inner = P.pts.map(function (p) { return pinCircle(p[0], p[1], P.r, p[2]); }).join(''); }
    } else if (t.s === 's') {
      if (t.n === 1) inner = bird();
      else { var S = C.SOU[t.n]; inner = S.pts.map(function (p) { return stick(p[0], p[1], p[2], p[3] === 'b' ? 'g' : p[3], S.len); }).join(''); }
    } else if (t.s === 'm') {
      inner = C.text(30, 22, C.KANJI[t.n - 1], 26, '#1b1b1b', F) + C.text(30, 56, '萬', 30, '#c0262d', F);
    } else {
      if (t.n === 5) inner = '<rect x="11" y="13" width="38" height="52" rx="3" fill="none" stroke="#1d4f9c" stroke-width="3.5"/><rect x="16" y="18" width="28" height="42" rx="2" fill="none" stroke="#1d4f9c" stroke-width="1.2"/>';
      else inner = C.text(30, 40, C.HONOR[t.n - 1], 40, t.n === 6 ? '#14704a' : t.n === 7 ? '#c0262d' : '#1a2340', F);
    }
    return C.wrap(inner, opts, { back: '#b9a876' });
  }
  var api = { name: 'A クラシック', svg: svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TilesA = api;
})(this);
