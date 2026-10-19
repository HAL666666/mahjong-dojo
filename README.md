# 牌の理（はいのことわり）

符と点数の計算から対局まで学べる、日本語の麻雀（リーチ麻雀）PWA。ビルド不要の HTML/CSS/JS、アカウント・サーバーなし、オフライン動作。旧名「点数道場」（URL とリポジトリ名 mahjong-dojo、保存データは互換のまま）。

- 符の学習（10ステップ）／点数クイズ（13問・全問エンジンで検証）／点数研究室（牌姿を編集して符・点数を再計算。役の自動判定は副露（ポン・チー・明槓・暗槓）にも対応）
- 対局：あなた＋CPU 3人。半荘戦／東風戦、ポン・チー・カン、赤ドラ、途中流局、ダブロン、包、ウマ・オカ表示。CPU は初級／中級／上級
- 解説モード：打牌候補ごとの向聴数・受け入れ・危険度、鳴きの助言
- 公平性：牌山は各局 crypto.getRandomValues の Fisher–Yates で一度だけシャッフル。CPU は自分の手牌と公開情報だけで判断
- どの画面からでも「早見表」「ヒント」を開ける

テスト: `node tests/engine.test.js && node tests/yaku.test.js && node tests/game.test.js && node tests/v4.test.js && node tests/backup.test.js`（ブラウザ: `python3 tests/e2e_backup.py`）

引っ越し（機種変更）: 設定 →「引っ越し」の **データを書き出す** で `dojo.` で始まる保存データ（成績・進み具合・研究室・対局・設定）を `hai-no-ri-all-v1-YYYY-MM-DD.json` に（iPhone は共有シート）。**データを読み込む** はアプリ名・版を確認→確認ダイアログ→置き換え（既定）／統合。失敗したら元に戻します。

CPU の強さ比較: `node tools/sim.js 40 mixed`（または `node tools/pair.js hard easy 40`）

スクリーンショット: `sh tools/shots.sh`（headless Chrome で screens/v4-*.png を撮り直す）
