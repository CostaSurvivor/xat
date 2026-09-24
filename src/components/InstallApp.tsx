"use client";

import { useEffect, useState } from "react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registra o service worker e mostra "Instalar app" (Android/desktop) ou instruções (iPhone). */
export function InstallApp() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    let dismissed = false;
    try { dismissed = localStorage.getItem("pwa-dismissed") === "1"; } catch {}
    if (standalone || dismissed) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    if (isIos) { setIos(true); setHidden(false); }
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIP); setHidden(false); };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (hidden) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem("pwa-dismissed", "1"); } catch {} };

  return (
    <>
      <button
        onClick={async () => {
          if (evt) { await evt.prompt(); const r = await evt.userChoice; if (r.outcome === "accepted") setHidden(true); setEvt(null); }
          else if (ios) setOpen(true);
        }}
        className="rounded-full border border-line px-3 py-1 text-xs text-mute hover:border-gold hover:text-white"
        title="Instalar o app no celular"
      >
        📲 <span className="hidden sm:inline">Instalar app</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-sm space-y-3 p-5 text-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold">Instalar no iPhone</h3>
            <ol className="list-decimal space-y-1 pl-5 text-mute">
              <li>Abra este site no <b className="text-white">Safari</b>.</li>
              <li>Toque em <b className="text-white">Compartilhar</b> (quadrado com seta ↑).</li>
              <li>Escolha <b className="text-white">Adicionar à Tela de Início</b>.</li>
            </ol>
            <p className="text-xs text-mute">O ícone aparece na tela inicial e o site abre em tela cheia, como um app.</p>
            <div className="flex justify-end gap-2">
              <button onClick={dismiss} className="btn-ghost">Não mostrar mais</button>
              <button onClick={() => setOpen(false)} className="btn-gold">Entendi</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
