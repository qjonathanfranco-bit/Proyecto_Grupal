/* Instalación disponible en el navegador; sin banners ni botones de instalación. */
(()=>{'use strict';if(window.__inventarioPWA)return;window.__inventarioPWA=true;
let writing=Promise.resolve();
window.addEventListener('inventario-cambio',e=>{const {clave,datos}=e.detail||{};if(!clave||!Array.isArray(datos)||!window.ColaOffline)return;writing=writing.then(()=>ColaOffline.agregar(location.pathname,clave,datos)).then(async()=>{if(navigator.onLine)await ColaOffline.sincronizar();const reg=await navigator.serviceWorker?.ready;if(reg?.sync&&self.PORTAFOLIO_SYNC?.endpoint)await reg.sync.register('inventario-sync');}).catch(()=>{/* El registro principal sigue conservado en localStorage. */});});
window.addEventListener('online',()=>window.ColaOffline?.sincronizar().catch(()=>{}));
if('serviceWorker'in navigator&&window.isSecureContext){window.addEventListener('load',()=>navigator.serviceWorker.register(new URL('sw.js',document.baseURI),{scope:'./'}).catch(()=>{}));}
})();