const CACHE_NAME = 'collab-editor-shell-v6'
const APP_ASSETS = [
  '/',
  '/static/collab_editor/app.js',
  '/static/collab_editor/styles.css',
  '/static/collab_editor/vendor/react.production.min.js',
  '/static/collab_editor/vendor/react-dom.production.min.js',
  '/static/collab_editor/vendor/lucide.js',
  '/static/collab_editor/vendor/diff-match-patch.js',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('collab-editor-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
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

  if (url.pathname.startsWith('/static/collab_editor/')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
      return response
    })))
  }
})
