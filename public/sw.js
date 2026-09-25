/*
 * Service worker mínimo do app instalável.
 * Privacidade: NÃO guarda páginas, fotos, mensagens nem respostas da API em cache
 * (celular pode ser compartilhado). Só a página "sem conexão" fica salva.
 */
const OFFLINE = "/offline.html";
const CACHE = "sp-offline-v3";

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

/*
 * Notificações push. O servidor já manda o texto no modo discreto por padrão
 * (sem nick nem conteúdo na tela bloqueada). Só abre links internos do site.
 */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  const url = typeof d.url === "string" && d.url.startsWith("/") && !d.url.startsWith("//") && !d.url.includes("\\") ? d.url : "/notificacoes";
  e.waitUntil(
    self.registration.showNotification(d.title || "Nova notificação", {
      body: d.body || "Você tem uma novidade",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag || "geral",
      renotify: true,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  let url = new URL((e.notification.data && e.notification.data.url) || "/notificacoes", self.location.origin);
  if (url.origin !== self.location.origin) url = new URL("/notificacoes", self.location.origin);
  url = url.href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(self.location.origin) && "focus" in c) return c.navigate(url).then((w) => (w || c).focus());
      return self.clients.openWindow(url);
    }),
  );
});
