const CACHE_NAME = 'version-1';
const urlsToCache = ['index.html', 'offline.html'];

addEventListener('install', (event) => {
	// install event
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			console.log('Opened cache');
			return cache.addAll(urlsToCache);
		})
	);
});

addEventListener('fetch', (event) => {
	// fetch event
	event.respondWith(
		caches.match(event.request).then((res) => {
			return fetch(event.request).catch(() =>
				caches.match('offline.html')
			);
		})
	);
});

addEventListener('activate', (event) => {
	// activate event
	const cacheWhiteList = [];
	cacheWhiteList.push(CACHE_NAME);

	event.waitUntill(
		cache.keys().then((cacheNames) =>
			Promise.all(
				cacheNames.map((cacheName) => {
					// map through cache names
					if (!cacheWhiteList.includes(cacheName)) {
						return caches.delete(cacheName);
					}
				})
			)
		)
	);
});
