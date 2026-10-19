/* 牌の理 service worker — アプリ本体をキャッシュしてオフライン動作 */
const CACHE = 'tensu-dojo-v4';
const SHELL = ['./', './index.html', './css/style.css', './js/tiles/tiles-common.js', './js/tiles/tiles-A.js', './js/tiles/tiles-B.js', './js/tiles/tiles-C.js', './js/yaku.js', './js/cpu.js', './js/game-core.js', './js/game-ui.js', './js/rules.js', './js/engine.js', './js/questions.js', './js/lessons.js', './js/app.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // ネット優先（更新を反映）→ 失敗時はキャッシュ
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && new URL(e.request.url).origin === location.origin) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match('./index.html'))));
});
