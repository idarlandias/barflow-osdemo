const CACHE_NAME = 'barflow-os-v4';

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);

  // API e logs: SEMPRE rede, nunca cache (dados ao vivo).
  if (url.pathname.startsWith('/api/') || url.pathname === '/logs') return;

  // App-shell (raiz e .html): NETWORK-FIRST.
  // Online: SEMPRE busca do servidor (a atualização aparece na hora) e atualiza o cache.
  // Offline (servidor/PC fora): cai pro cache → o app ABRE mesmo sem o servidor.
  const isShell = url.pathname === '/' || url.pathname.endsWith('.html');
  if (isShell) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request)) // sem rede → última cópia em cache
    );
    return;
  }

  // Demais assets (manifest, ícones): cache-first.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => new Response('Offline', { status: 503 }));
    })
  );
});
