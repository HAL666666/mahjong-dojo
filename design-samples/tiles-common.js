/* 牌の理 牌SVG 共通部品（自作図形のみ。外部画像なし）
 * 牌コード: '1m'-'9m' 萬子 / '1p'-'9p' 筒子 / '1s'-'9s' 索子 / '1z'-'7z' 東南西北白發中
 * 各スタイル（tiles-A/B/C.js）は TileCommon を使って svg(code, {width}) を返す。 */
(function (root) {
  var W = 60, H = 84; // viewBox。牌面は 0..60 x 0..78、下6pxが牌の厚み
  var KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var HONOR = ['東', '南', '西', '北', '白', '發', '中'];
  var HONOR_KANA = ['トン', 'ナン', 'シャー', 'ペー', 'ハク', 'ハツ', 'チュン'];
  var SERIF = "'Hiragino Mincho ProN','Yu Mincho','Noto Serif CJK JP','BIZ UDPMincho',serif";
  var SANS = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans CJK JP','Noto Sans JP','Yu Gothic',sans-serif";

  function parse(code) { return { n: parseInt(code[0], 10), s: code[1] }; }

  // 筒子の円の配置 [x, y, 色キー]（色キー: b=青, g=緑, r=赤）と半径
  var PIN = {
    1: { r: 19, pts: [[30, 39, 'r']] },
    2: { r: 11.5, pts: [[30, 20, 'g'], [30, 58, 'b']] },
    3: { r: 9.5, pts: [[14, 15, 'b'], [30, 39, 'r'], [46, 63, 'g']] },
    4: { r: 10.5, pts: [[17, 21, 'b'], [43, 21, 'g'], [17, 57, 'g'], [43, 57, 'b']] },
    5: { r: 9, pts: [[15, 16, 'b'], [45, 16, 'g'], [30, 39, 'r'], [15, 62, 'g'], [45, 62, 'b']] },
    6: { r: 8.5, pts: [[18, 13, 'g'], [42, 13, 'g'], [18, 43, 'r'], [42, 43, 'r'], [18, 65, 'r'], [42, 65, 'r']] },
    7: { r: 7.2, pts: [[13, 11, 'g'], [30, 20, 'g'], [47, 29, 'g'], [18, 49, 'r'], [42, 49, 'r'], [18, 67, 'r'], [42, 67, 'r']] },
    8: { r: 7.6, pts: [[18, 12, 'b'], [42, 12, 'b'], [18, 30, 'b'], [42, 30, 'b'], [18, 48, 'b'], [42, 48, 'b'], [18, 66, 'b'], [42, 66, 'b']] },
    9: { r: 8, pts: [[14, 15, 'b'], [30, 15, 'b'], [46, 15, 'b'], [14, 39, 'r'], [30, 39, 'r'], [46, 39, 'r'], [14, 63, 'g'], [30, 63, 'g'], [46, 63, 'g']] }
  };
  // 索子の棒の配置 [中心x, 中心y, 角度deg, 色キー g/r/b]、棒の長さ
  var SOU = {
    2: { len: 28, pts: [[30, 22, 0, 'g'], [30, 56, 0, 'b']] },
    3: { len: 28, pts: [[30, 22, 0, 'g'], [18, 56, 0, 'g'], [42, 56, 0, 'g']] },
    4: { len: 28, pts: [[18, 22, 0, 'g'], [42, 22, 0, 'b'], [18, 56, 0, 'b'], [42, 56, 0, 'g']] },
    5: { len: 28, pts: [[14, 22, 0, 'g'], [46, 22, 0, 'b'], [30, 39, 0, 'r'], [14, 56, 0, 'b'], [46, 56, 0, 'g']] },
    6: { len: 28, pts: [[14, 22, 0, 'g'], [30, 22, 0, 'g'], [46, 22, 0, 'g'], [14, 56, 0, 'b'], [30, 56, 0, 'b'], [46, 56, 0, 'b']] },
    7: { len: 20, pts: [[30, 13, 0, 'r'], [14, 39, 0, 'g'], [30, 39, 0, 'g'], [46, 39, 0, 'g'], [14, 64, 0, 'b'], [30, 64, 0, 'b'], [46, 64, 0, 'b']] },
    8: { len: 28, pts: [[10, 22, 18, 'g'], [22, 22, -18, 'g'], [38, 22, 18, 'g'], [50, 22, -18, 'g'], [10, 56, -18, 'b'], [22, 56, 18, 'b'], [38, 56, -18, 'b'], [50, 56, 18, 'b']] },
    9: { len: 20, pts: [[14, 14, 0, 'g'], [30, 14, 0, 'r'], [46, 14, 0, 'g'], [14, 39, 0, 'b'], [30, 39, 0, 'r'], [46, 39, 0, 'b'], [14, 64, 0, 'g'], [30, 64, 0, 'r'], [46, 64, 0, 'g']] }
  };

  function wrap(inner, opts, face) {
    opts = opts || {}; face = face || {};
    var w = opts.width || 60, h = Math.round(w * H / W);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + w + '" height="' + h + '" role="img"' +
      (opts.label ? ' aria-label="' + opts.label + '"' : '') + '>' +
      '<rect x="0.5" y="4" width="59" height="79.5" rx="8" fill="' + (face.back || '#c9b98f') + '"/>' +
      '<rect x="0.5" y="0.5" width="59" height="78" rx="8" fill="' + (face.fill || '#fff7e8') + '" stroke="' + (face.stroke || '#d9caa0') + '" stroke-width="1"/>' +
      inner + '</svg>';
  }
  function text(x, y, s, size, fill, font, extra) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + fill + '" font-family="' + font +
      '" font-weight="bold" text-anchor="middle" dominant-baseline="central"' + (extra || '') + '>' + s + '</text>';
  }
  var api = { W: W, H: H, KANJI: KANJI, HONOR: HONOR, HONOR_KANA: HONOR_KANA, SERIF: SERIF, SANS: SANS, PIN: PIN, SOU: SOU, parse: parse, wrap: wrap, text: text,
    ALL: ['1p','2p','3p','4p','5p','6p','7p','8p','9p','1s','2s','3s','4s','5s','6s','7s','8s','9s','1m','2m','3m','4m','5m','6m','7m','8m','9m','1z','2z','3z','4z','5z','6z','7z'],
    // 各スタイルの svg(code) を、牌コード→名前のラベル付きで呼ぶ
    label: function (code) { var t = parse(code); return t.s === 'z' ? HONOR[t.n - 1] : t.n + { m: '萬', p: '筒', s: '索' }[t.s]; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TileCommon = api;
})(this);
