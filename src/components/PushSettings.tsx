"use client";

import { useEffect, useState, useTransition } from "react";
import { savePushPrefs, sendTestPush } from "@/app/actions/push";
import { PUSH_GROUPS, type PushGroup, type PushPrefs } from "@/lib/push";
import { ActionForm } from "./Forms";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));
}

/** Ativar/desativar push neste aparelho + escolher o que avisa. */
export function PushSettings({ prefs, devices }: { prefs: PushPrefs; devices: number }) {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ios = typeof navigator !== "undefined" && /iphone|ipad/i.test(navigator.userAgent);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await (await registration()).pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = () =>
    start(async () => {
      setMsg(null);
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
        const { publicKey } = await (await fetch("/api/push/key")).json();
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
        const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Falha ao ativar");
        setState("on");
        setMsg("Notificações ativadas neste aparelho ✓");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Não foi possível ativar");
      }
    });

  const disable = () =>
    start(async () => {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("Notificações desativadas neste aparelho.");
    });

  return (
    <section className="card space-y-3 p-5" id="notificacoes-celular">
      <div>
        <h2 className="font-semibold text-gold">📲 Notificações no celular</h2>
        <p className="text-xs text-mute">Receba avisos mesmo com o site fechado. Vale só para este aparelho e para esta conta; ao sair da conta, os avisos param.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {state === "loading" && <span className="text-sm text-mute">Verificando…</span>}
        {state === "unsupported" && (
          <p className="text-sm text-mute">{ios ? "No iPhone: toque em Compartilhar → “Adicionar à Tela de Início”, abra o SexPapo pelo ícone e ative aqui (iOS 16.4 ou mais novo)." : "Este navegador não suporta notificações. Use o Chrome, Edge, Firefox ou Safari atualizados."}</p>
        )}
        {state === "denied" && <p className="text-sm text-red-700">As notificações estão bloqueadas no navegador. Libere nas configurações do site (ícone de cadeado ao lado do endereço) e volte aqui.</p>}
        {state === "off" && <button disabled={pending} onClick={enable} className="btn-gold">🔔 Ativar neste aparelho</button>}
        {state === "on" && (
          <>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">✓ Ativadas neste aparelho</span>
            <button disabled={pending} onClick={() => start(async () => { const r = await sendTestPush(); setMsg(r.ok ? "Teste enviado! Deve chegar em alguns segundos." : r.error ?? "Erro"); })} className="btn-ghost">Enviar teste</button>
            <button disabled={pending} onClick={disable} className="btn-ghost text-red-700">Desativar</button>
          </>
        )}
        {devices > 0 && <span className="text-xs text-mute">{devices} {devices === 1 ? "aparelho ativo" : "aparelhos ativos"} na conta</span>}
      </div>
      {msg && <p className="text-sm text-gold" aria-live="polite">{msg}</p>}
      <ActionForm action={savePushPrefs} okText="Preferências salvas!" className="space-y-2 border-t border-line pt-3 text-sm">
        <label className="flex gap-2 font-semibold"><input type="checkbox" name="discreet" defaultChecked={prefs.discreet} /> Modo discreto (recomendado): a tela bloqueada mostra só “Você tem uma nova mensagem”, sem nick nem conteúdo</label>
        <p className="text-xs text-mute">Me avise sobre:</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {(Object.keys(PUSH_GROUPS) as PushGroup[]).map((g) => (
            <label key={g} className="flex gap-2 text-mute"><input type="checkbox" name={`g_${g}`} defaultChecked={prefs.groups[g] ?? PUSH_GROUPS[g].default} /> {PUSH_GROUPS[g].label}</label>
          ))}
        </div>
        <button className="btn-ghost">Salvar preferências</button>
      </ActionForm>
    </section>
  );
}
