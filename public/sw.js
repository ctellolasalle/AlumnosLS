const CACHE_NAME = 'lasalle-alumnos-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/logo_lasalle.png'
];

// Instalar service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - devolver respuesta del cache
        if (response) {
          return response;
        }
        
        // Clonar request para poder usarlo
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Verificar si recibimos respuesta valida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clonar respuesta para poder usarla
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        }).catch(() => {
          // Si falla la peticion y es una pagina, devolver pagina offline
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        });
      })
  );
});

// Limpiar caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});