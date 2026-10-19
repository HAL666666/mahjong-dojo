#!/usr/bin/env python3
"""牌の理：設定 >「引っ越し」の書き出し/読み込みをヘッドレス Chrome で確認＋スクリーンショット（screens/v5-backup.png）。
実行: python3 tests/e2e_backup.py   （BASE=... で公開URLにも）"""
import asyncio, json, os, re, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("PORT", 18766)); BASE = os.environ.get("BASE", f"http://127.0.0.1:{PORT}/")
SHOT = os.environ.get("SHOT", str(ROOT / "screens" / "v5-backup.png"))
IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
res = []
def ok(n, c, x=""): res.append(bool(c)); print(("PASS " if c else "FAIL ") + n + (f"  ({x})" if x else ""))
DUMP = "(() => { const o = {}; Object.keys(localStorage).filter(k => k.startsWith('dojo.')).sort().forEach(k => o[k] = localStorage.getItem(k)); return o; })()"

async def main():
    srv = None
    if "127.0.0.1" in BASE:
        srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
    tmp = tempfile.mkdtemp()
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True)
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="ja-JP", accept_downloads=True)
            pg = await ctx.new_page(); errs = []; dialogs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("dialog", lambda d: (dialogs.append(d.message), asyncio.ensure_future(d.accept())))
            await pg.goto(BASE + "#home"); await pg.wait_for_timeout(500)
            await pg.evaluate("""localStorage.setItem('dojo.quizStats', JSON.stringify({right: 42, wrong: 5}));
              localStorage.setItem('dojo.lessonsDone', '[1,2,3]'); localStorage.setItem('dojo.gameOpts', JSON.stringify({cpuLevel:'hard', callConfirm:false}));
              localStorage.setItem('dojo.settings', JSON.stringify({style:'C', size:'std'})); localStorage.setItem('dojo.renameNoticeSeen', 'true'); localStorage.setItem('weekStart','1');""")
            await pg.goto(BASE + "#settings"); await pg.reload(); await pg.wait_for_selector("#bk-export")
            before = await pg.evaluate(DUMP)
            ok("ボタンが見える", await pg.is_visible("#bk-export") and "データを読み込む" in await pg.inner_text("#backup-card"))
            await pg.evaluate("document.getElementById('backup-card').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(400)
            await pg.screenshot(path=SHOT)
            async with pg.expect_download() as dl:
                await pg.click("#bk-export")
            d = await dl.value; name = d.suggested_filename
            ok("ファイル名", re.fullmatch(r"hai-no-ri-all-v1-\d{4}-\d{2}-\d{2}\.json", name), name)
            path = os.path.join(tmp, name); await d.save_as(path); data = json.load(open(path))
            ok("成績・履歴・設定が入る", data["app"] == "hai-no-ri" and data["data"] == before and "weekStart" not in data["data"])
            for fn, txt in {"other.json": json.dumps({"app": "lifelog", "version": 3, "data": {}}), "broken.json": "{", "future.json": json.dumps({**data, "version": 5})}.items():
                fp = os.path.join(tmp, fn); open(fp, "w").write(txt); n0 = len(dialogs)
                await pg.set_input_files("#bk-import", fp); await pg.wait_for_timeout(400)
                ok("不正ファイルは中止: " + fn, (await pg.evaluate(DUMP)) == before and len(dialogs) == n0 and "中止" in await pg.inner_text("#bk-status"))
            await pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('dojo.')).forEach(k => localStorage.removeItem(k)); localStorage.setItem('dojo.lab', '{\"x\":1}')")
            await pg.set_input_files("#bk-import", path); await pg.wait_for_timeout(2200)
            ok("確認ダイアログ（置き換え）", dialogs and "置き換え" in dialogs[-1])
            after = await pg.evaluate(DUMP)
            ok("置き換えで元どおり", after == before, after)
            ok("他アプリのキーは残る", await pg.evaluate("localStorage.getItem('weekStart')") == "1")
            ok("ページエラーなし", not errs, errs)
            await ctx.close()
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, user_agent=IOS_UA)
            pg = await ctx.new_page()
            await pg.add_init_script("navigator.canShare = d => !!(d && d.files); navigator.share = async d => { window.__shared = {name: d.files[0].name, size: d.files[0].size}; };")
            await pg.goto(BASE + "#settings"); await pg.wait_for_selector("#bk-export"); await pg.click("#bk-export"); await pg.wait_for_timeout(600)
            sh = await pg.evaluate("window.__shared")
            ok("iPhone：共有シートに File", sh and sh["name"].startswith("hai-no-ri-all-v1-"), sh)
            await b.close()
    finally:
        if srv: srv.terminate()
    print(f"{sum(res)}/{len(res)} passed"); return 0 if all(res) else 1
if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
