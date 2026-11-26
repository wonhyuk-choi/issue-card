// 아침 이슈 카드 서비스 워커: 오프라인 캐시 + 푸시 알림
var VERSION = 'v13';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open('shell-' + VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(VERSION) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// 화면·데이터는 항상 최신을 먼저 받고, 안 되면 저장된 것을 보여 줌
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (font) {
    e.respondWith(caches.open('font-' + VERSION).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (r) { c.put(req, r.clone()); return r; });
      });
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  var key = url.pathname.indexOf('/data/') >= 0 ? new Request(url.origin + url.pathname) : req;
  e.respondWith(fetch(req).then(function (r) {
    if (r.ok) { var copy = r.clone(); caches.open('shell-' + VERSION).then(function (c) { c.put(key, copy); }); }
    return r;
  }).catch(function () {
    return caches.match(key, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
  }));
});

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || '이슈 뉴스 도착', {
    body: d.body || '오늘의 이슈 카드가 도착했어요.',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'issue-brief',
    renotify: true,
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var k = 0; k < list.length; k++) {
      if (list[k].url.indexOf(self.registration.scope) === 0 && 'focus' in list[k]) { list[k].postMessage('refresh'); return list[k].focus(); }
    }
    return self.clients.openWindow(target);
  }));
});
