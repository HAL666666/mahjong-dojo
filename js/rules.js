/* ルールとマナー（図つき）。window.renderRules(tile, tiles) が HTML を返す */
(function (root) {
  var GOLD = '#d8b65b', CREAM = '#fff7e8', DEAD = '#8c9a92', TAKE = ['#d8b65b', '#7fc4a0', '#8fb3e8', '#e8a08f'];

  // 図1：卓を上から見た図（出目と山の対応、出目7の例）
  function tableDiagram() {
    var s = '<svg class="diagram" viewBox="0 0 320 330" width="320" role="img" aria-label="四つの山とサイコロの目の対応図">';
    s += '<rect x="30" y="30" width="260" height="260" rx="14" fill="#174b3e" stroke="' + GOLD + '" stroke-opacity=".4"/>';
    for (var i = 0; i < 17; i++) {
      var p = 58 + i * 12;
      // 上（対面）の山：持ち主から見た右端＝画面の左端。出目7の例を色分け
      var fill = i < 7 ? DEAD : i < 9 ? TAKE[0] : i < 11 ? TAKE[1] : i < 13 ? TAKE[2] : i < 15 ? TAKE[3] : CREAM;
      if (i === 4) fill = '#e5533d';
      s += '<rect x="' + p + '" y="46" width="11" height="8" rx="1.5" fill="' + fill + '"/>';
      s += '<rect x="' + p + '" y="266" width="11" height="8" rx="1.5" fill="' + CREAM + '"/>';
      s += '<rect x="46" y="' + p + '" width="8" height="11" rx="1.5" fill="' + CREAM + '"/>';
      s += '<rect x="266" y="' + p + '" width="8" height="11" rx="1.5" fill="' + CREAM + '"/>';
    }
    s += '<line x1="141.5" y1="38" x2="141.5" y2="62" stroke="#fff" stroke-width="2" stroke-dasharray="3 2"/>';
    s += '<text x="160" y="20" fill="' + CREAM + '" font-size="13" text-anchor="middle">対面（3・7・11）</text>';
    s += '<text x="160" y="318" fill="' + GOLD + '" font-size="13" text-anchor="middle" font-weight="bold">自分＝親（1・5・9）</text>';
    s += '<text x="14" y="160" fill="' + CREAM + '" font-size="13" text-anchor="middle" transform="rotate(-90 14 160)">上家＝左（4・8・12）</text>';
    s += '<text x="306" y="160" fill="' + CREAM + '" font-size="13" text-anchor="middle" transform="rotate(90 306 160)">下家＝右（2・6・10）</text>';
    // 中央：数える向き（反時計回り）
    s += '<path d="M160 215 A55 55 0 0 0 215 160" fill="none" stroke="' + GOLD + '" stroke-width="2.5" marker-end="url(#ah)"/>' +
      '<path d="M215 160 A55 55 0 0 0 160 105" fill="none" stroke="' + GOLD + '" stroke-width="2.5" marker-end="url(#ah)"/>' +
      '<path d="M160 105 A55 55 0 0 0 105 160" fill="none" stroke="' + GOLD + '" stroke-width="2.5" marker-end="url(#ah)"/>';
    s += '<defs><marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="' + GOLD + '"/></marker></defs>';
    s += '<text x="160" y="152" fill="' + CREAM + '" font-size="11" text-anchor="middle">出目を数える順</text><text x="160" y="168" fill="' + CREAM + '" font-size="11" text-anchor="middle">親→右→対面→左</text>';
    s += '<text x="100" y="78" fill="' + CREAM + '" font-size="10" text-anchor="middle">←王牌7トン</text><text x="200" y="78" fill="' + CREAM + '" font-size="10" text-anchor="middle">取る方向→</text>';
    s += '<text x="160" y="245" fill="#b9cdbf" font-size="10" text-anchor="middle">例：出目7 → 対面の山を切る</text>';
    return s + '</svg>';
  }

  // 図2：切る山を持ち主から見た図（右端から出目の数だけ数える）
  function wallDiagram() {
    var W = 17, sw = 17, x0 = 12, s = '<svg class="diagram" viewBox="0 0 320 166" width="320" role="img" aria-label="山の切り方とドラ表示牌の位置">';
    for (var k = 0; k < W; k++) { // k=0 が画面の左端（持ち主の左）。右端から数えた番号 n = 17-k
      var n = W - k, x = x0 + k * sw, top = CREAM, bot = '#e9dcb8';
      if (n <= 7) { top = DEAD; bot = '#76847c'; }
      else if (n <= 15) { var who = Math.floor((n - 8) / 2); top = bot = TAKE[who]; }
      if (n === 5) top = '#e5533d';
      s += '<rect x="' + x + '" y="58" width="' + (sw - 2) + '" height="14" rx="2" fill="' + top + '" stroke="#0a2a23" stroke-width=".6"/>';
      s += '<rect x="' + x + '" y="73" width="' + (sw - 2) + '" height="14" rx="2" fill="' + bot + '" stroke="#0a2a23" stroke-width=".6"/>';
      s += '<text x="' + (x + sw / 2 - 1) + '" y="100" fill="#b9cdbf" font-size="8" text-anchor="middle">' + n + '</text>';
    }
    var brk = x0 + 10 * sw - 1;
    s += '<line x1="' + brk + '" y1="40" x2="' + brk + '" y2="94" stroke="#fff" stroke-width="2" stroke-dasharray="3 2"/>';
    s += '<text x="' + brk + '" y="34" fill="#fff" font-size="10" text-anchor="middle">割れ目（7トン目の左）</text>';
    s += '<text x="' + (x0 + 13.5 * sw) + '" y="118" fill="' + CREAM + '" font-size="10" text-anchor="middle">王牌 7トン＝14枚</text>';
    s += '<text x="' + (x0 + 12.5 * sw) + '" y="52" fill="#ff9c8a" font-size="9" text-anchor="middle">ドラ表示牌▼</text>';
    s += '<text x="' + (x0 + 16.5 * sw) + '" y="52" fill="' + CREAM + '" font-size="9" text-anchor="middle">嶺上▼</text>';
    s += '<text x="' + (x0 + 6 * sw) + '" y="118" fill="' + CREAM + '" font-size="10" text-anchor="middle">← 配牌・ツモはこちらへ（左へ）</text>';
    ['親', '下家', '対面', '上家'].forEach(function (nm, j) {
      s += '<rect x="' + (40 + j * 62) + '" y="131" width="10" height="10" rx="2" fill="' + TAKE[j] + '"/><text x="' + (54 + j * 62) + '" y="140" fill="' + CREAM + '" font-size="10">' + nm + '</text>';
    });
    s += '<text x="160" y="158" fill="#b9cdbf" font-size="9.5" text-anchor="middle">この順に2トン(4枚)ずつ取る／下の数字＝右端から数えたトン数</text>';
    s += '<text x="160" y="14" fill="' + GOLD + '" font-size="11" text-anchor="middle">山の持ち主から見た図（出目7の例）</text>';
    return s + '</svg>';
  }

  root.renderRules = function (tile, tiles) {
    var river = ['1z', '9m', '2z', '1p', '8s', '7z', '3p', '9s', '4z', '2m', '5z', '6p', '1s', '7m'];
    var h = '<div class="rules">';
    h += '<article class="card"><p>家族や友人と卓を囲むときの、準備の手順とマナーです。細かい部分はグループのルール（ローカルルール）が優先です。</p>' +
      '<div class="toc"><a href="#r-auto" data-jump>全自動卓</a><a href="#r-hand" data-jump>手積み</a><a href="#r-manner" data-jump>マナー</a><a href="#r-fair" data-jump>対局の公平性</a></div></article>';

    h += '<article class="card" id="r-auto"><h2>全自動卓での始め方</h2>' +
      '<h3>1. 席決め（場決め）</h3><ol><li>東・南・西・北の4枚を裏向きに混ぜ、1人1枚ずつ引きます。</li>' +
      '<li>東を引いた人が<b>仮親（仮東）</b>。仮東から見て右に南、向かいに西、左に北が座ります。</li>' +
      '<li>仮東がサイコロを振り、出目の人が<b>起家（最初の親）</b>。正式にはその人がもう一度振る「2度振り」で決めます。家族戦なら仮東をそのまま親にしてもOK。</li></ol>' +
      '<div class="hand">' + tiles(['1z', '2z', '3z', '4z']) + '</div>' +
      '<h3>2. サイコロで切る山を決める</h3><p>親がサイコロ2個を振り、<b>合計</b>を親から<b>反時計回り</b>（親→右→対面→左）に数えます。</p>' +
      '<table class="mini"><tr><th>出目</th><th>切る山</th></tr><tr><td>1・5・9</td><td>親（自分）の山</td></tr><tr><td>2・6・10</td><td>下家（右の人）の山</td></tr><tr><td>3・7・11</td><td>対面の山</td></tr><tr><td>4・8・12</td><td>上家（左の人）の山</td></tr></table>' +
      tableDiagram() +
      '<h3>3. 山を切る（開門）</h3><p>決まった山の<b>持ち主から見て右端</b>から、出目の数だけトン（2枚重ねの1列）を数え、その<b>左側</b>から取り始めます。数えた右側の部分が<b>王牌</b>です。</p>' +
      wallDiagram() +
      '<ul><li><b>王牌</b>は割れ目から右の7トン＝14枚。出目が7未満で足りない分は、右隣の山の端から続けます。王牌は和了・配牌に使いません。</li>' +
      '<li><b>ドラ表示牌</b>：割れ目から右へ数えて<b>3トン目の上段</b>をめくります。表示牌の「次」の牌がドラ（例：5筒が見えたら6筒がドラ、9の次は1、東→南→西→北→東、白→發→中→白）。</li>' +
      '<li><b>嶺上牌</b>：カンをしたら王牌の<b>端（割れ目から一番遠いところ）</b>から1枚取ります。カンドラはドラ表示牌の右隣をめくります。</li></ul>' +
      '<h3>4. 配牌の取り方</h3><ol><li>親から順に（親→右→対面→左）、割れ目の左から<b>2トン＝4枚ずつ</b>取ります。これを<b>3周</b>（各12枚）。</li>' +
      '<li>4周目：親は上段の牌を<b>1つ飛ばしで2枚</b>取ります（<b>チョンチョン</b>）。子は順に1枚ずつ。</li>' +
      '<li>これで<b>親14枚・子13枚</b>。親は最初にツモらず1枚捨てて始めます。</li></ol>' +
      '<table class="mini"><tr><th></th><th>1〜3周</th><th>4周目</th><th>合計</th></tr><tr><td>親</td><td>4枚×3</td><td>2枚（チョンチョン）</td><td>14枚</td></tr><tr><td>子</td><td>4枚×3</td><td>1枚</td><td>13枚</td></tr></table>' +
      '<p class="fine">配牌まで自動で手元に出てくる卓もあります。その場合も、ドラ表示牌の位置と王牌の範囲は同じ考え方です。</p>' +
      '<h3>5. ツモと捨て牌</h3><ul><li>ツモは配牌の続きから<b>左へ（時計回りに）</b>順に取ります。手番は反時計回り（親→右の人→…）。</li>' +
      '<li>捨て牌（河）は自分の前に<b>6枚ずつ</b>左から右へ並べ、7枚目から2段目へ。立直宣言牌は横向きに置きます。</li></ul>' +
      '<div class="river">' + tiles(river) + '</div></article>';

    h += '<article class="card" id="r-hand"><h2>手積み（家庭でのやり方）</h2>' +
      '<h3>1. 洗牌（シーパイ）</h3><p>全136枚を<b>裏向き</b>にして、全員で卓の中央でよく混ぜます。表が見えた牌は裏返して混ぜ直します。</p>' +
      '<h3>2. 山を積む</h3><p>各自、自分の前に<b>17枚×2段＝34枚</b>の山を作ります（34×4人＝136枚）。できたら4人の山を押し出して<b>正方形</b>に組みます。</p>' +
      '<h3>3. サイコロ（2つのやり方）</h3><ul><li><b>1回振り（家族戦におすすめ）</b>：親が1回振り、その合計で上の表の通りに山を決め、その山の右端から同じ数だけ数えて切ります。全自動卓と同じです。</li>' +
      '<li><b>2度振り（正式）</b>：親が振り、出目で決まった人がもう一度振ります。<b>2回の合計</b>の数だけ、2度目を振った人の山の右端から数えて切ります（17を超えたら左隣の山に続けて数える）。</li></ul>' +
      '<h3>4. 配牌・ドラ・王牌</h3><p>全自動卓と同じです（4枚ずつ3周＋親チョンチョン、割れ目の右7トンが王牌、3トン目上段がドラ表示牌）。王牌は割れ目を少し空けて分けておくと分かりやすいです。</p>' +
      '<h3>5. 山の扱いとマナー</h3><ul><li>自分の山から取られるようになったら、相手が取りやすいように山を<b>前に押し出し</b>ます。</li>' +
      '<li>山を崩してしまったら「すみません」と一言。見えた牌は<b>裏向きのまま元の位置に戻し</b>ます（扱いはグループのルールに従う）。</li>' +
      '<li>局が終わったら全員の手牌・山を崩して、また洗牌から。</li></ul></article>';

    h += '<article class="card" id="r-manner"><h2>マナー</h2><ul>' +
      '<li><b>挨拶</b>：始めに「よろしくお願いします」、終わりに「ありがとうございました」。</li>' +
      '<li><b>先ヅモしない</b>：前の人が捨て終わる前に山へ手を伸ばさない（鳴きの機会を奪うため）。</li>' +
      '<li><b>発声してから鳴く</b>：「ポン」「チー」「カン」をはっきり言ってから牌を取る。黙って取らない。</li>' +
      '<li><b>優先順位</b>：ロン ＞ ポン・カン ＞ チー。ポンとチーが同時なら<b>ポンが優先</b>。チーは上家（左の人）の捨て牌だけ。</li>' +
      '<li><b>和了は発声してから倒す</b>：「ロン」「ツモ」と言ってから手牌を倒す。</li>' +
      '<li><b>強打しない</b>：牌を卓に叩きつけない。静かに置く。</li>' +
      '<li><b>長考しすぎない</b>：迷っても手早く。初心者同士なら「ちょっと考えます」と一言でOK。</li>' +
      '<li><b>口三味線しない</b>：「全然テンパイしてない」など、相手を惑わす発言をしない。</li>' +
      '<li><b>卓上で飲食しない</b>：飲み物はサイドテーブルへ。牌や卓を汚さない。</li></ul></article>';
    h += '<article class="card" id="r-fair"><h2>このアプリの対局の公平性</h2><ul>' +
      '<li>牌山は各局の開始時に、暗号論的乱数（crypto.getRandomValues）を使った Fisher–Yates 法で<b>一度だけ</b>シャッフルします。</li>' +
      '<li>配牌やツモの重み付け、あなたの手牌を見た後の牌山の入れ替えなどの<b>操作は一切ありません</b>。</li>' +
      '<li>CPU は自分の手牌と公開情報（全員の河・リーチ宣言・ドラ表示牌・残り枚数）だけで判断し、あなたの手牌や山の中身は見ません。</li>' +
      '<li>そのため、偏った配牌や連続した不運も普通に起こります。</li></ul></article>';
    return h + '</div>';
  };
})(this);
