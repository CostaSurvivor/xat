"use client";

import { useEffect } from "react";

/** Página neutra para onde a saída rápida leva (não volta com o botão "voltar"). */
export const QUICK_EXIT_URL = "https://www.google.com/search?q=previs%C3%A3o+do+tempo";

export function quickExit() {
  try { sessionStorage.clear(); } catch {}
  document.title = "Google";
  document.body.style.visibility = "hidden";
  location.replace(QUICK_EXIT_URL);
}

/** Atalho de teclado: Esc 3 vezes seguidas (em até 1,5 s). */
export function QuickExitKeys() {
  useEffect(() => {
    let hits: number[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const now = Date.now();
      hits = [...hits.filter((t) => now - t < 1500), now];
      if (hits.length >= 3) quickExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

export function QuickExitButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={quickExit} className={className} title="Sai do site na hora (atalho: Esc 3 vezes)">
      🚪 Saída rápida
    </button>
  );
}
