// The service worker of the published address: what makes the tool open without reception after one visit.
// It exists only at the address – tools/publish.js writes it into site/ with the version of the build in
// place of /*@VER*/, which is also what tells the browser that a new version came out.
//
// Policy: the cache answers first, so the tool opens at once even on a bad line, and the address is asked
// in the background for a fresher copy. A new version therefore never replaces the open work by itself –
// the new worker installs, waits, and the page offers "יש גרסה חדשה – רענן".
'use strict';
const VER = '0.9-ce0aa186';
const CACHE = 'planner-' + VER;
// the tool itself and what the installed app needs to start – everything else is kept as it is asked for
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'icon-180.png'];

self.addEventListener('install', e => {
  // one file that fails to arrive must not fail the whole install
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});

// the page asks for the replacement, after the carpenter pressed refresh – never before
self.addEventListener('message', e => { if (e.data && e.data.type === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;
  // a partial request (Safari asks for a PDF this way) is left to the browser: a 206 cannot be kept
  if (req.headers.has('range')) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
    const fresh = fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') c.put(req, res.clone());
      return res;
    }).catch(() => hit || (req.mode === 'navigate' ? c.match('index.html') : undefined));
    return hit || fresh;
  })));
});
