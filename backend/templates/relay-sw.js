const CACHE_NAME = 'relay-shell-v2'
const APP_ASSETS = [
  '/',
  '/static/relay/app.jsx',
  '/static/relay/styles.css',
  '/static/relay/vendor/react.production.min.js',
  '/static/relay/vendor/react-dom.production.min.js',
  '/static/relay/vendor/lucide.js',
  '/static/relay/vendor/diff-match-patch.js',
  '/static/relay/vendor/babel.min.js',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('relay-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME)
        await cache.put('/', response.clone())
      }
      return response
    }).catch(async () => (await caches.match(request)) || (await caches.match('/'))))
    return
  }

  if (url.pathname.startsWith('/static/relay/')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
      return response
    })))
  }
})
