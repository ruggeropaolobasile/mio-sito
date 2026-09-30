const CACHE='reorder-v4';
const ASSETS=[
  './','./index.html','./public.html','./client.html','./admin.html',
  './styles.css','./config.js','./app.js','./client.js','./admin.js','./manifest.webmanifest'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const isNavigation=req.mode==='navigate';
  const isLocal=url.origin===location.origin;

  if(isNavigation || (isLocal && ['.js','.css','.html'].some(ext=>url.pathname.endsWith(ext)))){
    event.respondWith(
      fetch(req)
        .then(res=>{const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));return res;})
        .catch(()=>caches.match(req).then(cached=>cached||caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});