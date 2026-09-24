/*
 * Service worker mínimo do app instalável.
 * Privacidade: NÃO guarda páginas, fotos, mensagens nem respostas da API em cache
 * (celular pode ser compartilhado). Só a página "sem conexão" fica salva.
 */
const OFFLINE = "/offline.html";
const CACHE = "sp-offline-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return; // tudo o mais vai direto à rede
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
