/* Caché independiente por carpeta, sin interceptar redes sociales ni POST. */
importScripts('sync-config.js','js/cola-offline.js');
const PREFIX='inventario-'+encodeURIComponent(self.registration.scope)+'-';const CACHE=PREFIX+'v2';
const ASSETS=["./", "index.html", "css/styles.css?v=grupal2", "css/mejoras.css?v=grupal2", "vendor/jquery-3.7.1.min.js", "js/config.js", "js/app.js?v=grupal2", "js/cola-offline.js", "sync-config.js", "pwa.js?v=grupal2", "manifest.json", "icons/icon-192.png", "icons/icon-512.png", "offline.html", "diagnostico.html", "auditoria.html"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
event.respondWith((async()=>{const cache=await caches.open(CACHE);if(req.mode==='navigate'){try{const response=await fetch(req);return response;}catch{return await cache.match(req)||await cache.match('index.html')||await cache.match('offline.html');}}const saved=await cache.match(req);if(saved)return saved;return fetch(req);})());});
self.addEventListener('sync',event=>{if(event.tag==='inventario-sync')event.waitUntil(ColaOffline.sincronizar());});
