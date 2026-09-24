"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { acceptTradeAction, cancelTradeAction, confirmTradeAction, saveOffer } from "@/app/actions/trade";
import type { TradeViewT } from "@/server/trades";
import { CURRENCY_ICON, CURRENCY_NAME } from "@/lib/config";
import { Avatar } from "./Avatar";
import { ItemBadge } from "./ItemBadge";

type Inv = { id: string; name: string; category: string; rarity: string; config: unknown };

export function TradeRoom({ initial, myItems, myBalance, myVipDays }: { initial: TradeViewT; myItems: Inv[]; myBalance: number; myVipDays: number }) {
  const [t, setT] = useState(initial);
  const mine = t[t.me];
  const theirs = t[t.me === "A" ? "B" : "A"];
  const [coins, setCoins] = useState(mine.coins);
  const [vip, setVip] = useState(mine.vipDays);
  const [sel, setSel] = useState<string[]>(mine.items.map((i) => i.id));
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [lock, setLock] = useState(initial.lockedMs);
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const r = await fetch(`/api/trades/${t.id}`, { cache: "no-store" });
    if (!r.ok) return;
    const j: TradeViewT = await r.json();
    setT(j);
    setLock(j.lockedMs);
  }, [t.id]);

  useEffect(() => {
    const i = setInterval(load, 2500);
    const c = setInterval(() => setLock((l) => Math.max(0, l - 250)), 250);
    return () => { clearInterval(i); clearInterval(c); };
  }, [load]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? okMsg ?? null : r.error ?? "Erro");
      await load();
    });

  const open = t.status === "PENDING";
  const Side = ({ s, title }: { s: TradeViewT["A"]; title: string }) => (
    <div className={`card flex-1 space-y-3 p-4 ${s.confirmed ? "border-green-500/70" : s.accepted ? "border-gold/70" : ""}`}>
      <div className="flex items-center gap-2">
        <Avatar mediaId={s.user.avatarId} nick={s.user.nick} size={36} />
        <div className="leading-tight">
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-mute">@{s.user.nick}</p>
        </div>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${s.confirmed ? "bg-green-900/60 text-green-300" : s.accepted ? "bg-gold/20 text-gold2" : "bg-panel2 text-mute"}`}>
          {s.confirmed ? "Confirmou ✔✔" : s.accepted ? "Aceitou ✔" : "Montando oferta"}
        </span>
      </div>
      <p className="text-sm">{CURRENCY_ICON} <b>{s.coins}</b> {CURRENCY_NAME}</p>
      {s.vipDays > 0 && <p className="text-sm">⭐ <b>{s.vipDays}</b> dias de assinatura</p>}
      <div className="flex flex-wrap gap-1.5">{s.items.length ? s.items.map((i) => <ItemBadge key={i.id} {...i} small nick={s.user.nick} />) : <span className="text-xs text-mute">Nenhum item</span>}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/trocas" className="text-sm text-mute">← trocas</Link>
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">🔄 Troca com @{theirs.user.nick}</h1>
        {open && <button onClick={() => run(() => cancelTradeAction(t.id), "Troca cancelada.")} className="btn-ghost text-xs">Cancelar troca</button>}
      </div>
      {!open && (
        <p className={`rounded-xl p-3 text-center ${t.status === "COMPLETED" ? "bg-green-900/40 text-green-200" : "bg-panel2 text-mute"}`}>
          {t.status === "COMPLETED" ? "✅ Troca concluída! Os itens já estão nos inventários." : t.status === "CANCELLED" ? "Troca cancelada." : "Troca expirada."}
        </p>
      )}
      <div className="flex flex-col gap-3 md:flex-row">
        <Side s={mine} title="Você oferece" />
        <div className="self-center text-2xl text-gold">⇄</div>
        <Side s={theirs} title={`@${theirs.user.nick} oferece`} />
      </div>

      {open && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card space-y-3 p-4">
            <h2 className="font-semibold text-gold">Montar minha oferta</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-mute">{CURRENCY_NAME} (você tem {myBalance})
                <input type="number" min={0} max={myBalance} value={coins} onChange={(e) => { setCoins(Number(e.target.value)); setDirty(true); }} className="input mt-0.5" />
              </label>
              <label className="text-xs text-mute">Dias de assinatura (você tem {myVipDays})
                <input type="number" min={0} max={myVipDays} value={vip} onChange={(e) => { setVip(Number(e.target.value)); setDirty(true); }} className="input mt-0.5" />
              </label>
            </div>
            <div>
              <p className="label">Itens permanentes</p>
              {myItems.length === 0 && <p className="text-xs text-mute">Você não tem itens permanentes. Itens de 7 ou 30 dias não podem ser trocados.</p>}
              <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
                {myItems.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => { setSel((s) => (s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id])); setDirty(true); }}
                    className={`rounded-xl ${sel.includes(i.id) ? "ring-2 ring-gold" : "opacity-70 hover:opacity-100"}`}
                  >
                    <ItemBadge {...i} small />
                  </button>
                ))}
              </div>
            </div>
            <button disabled={pending || !dirty} onClick={() => run(async () => { const r = await saveOffer(t.id, { coins, vipDays: vip, itemIds: sel }); if (r.ok) setDirty(false); return r; }, "Oferta atualizada. Os aceites foram zerados.")} className="btn-wine w-full">
              Atualizar minha oferta
            </button>
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="font-semibold text-gold">Fechar negócio</h2>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-mute">
              <li>Confira as duas ofertas com calma.</li>
              <li>Os dois clicam em <b className="text-white">Aceitar</b>. Qualquer mudança na oferta zera os aceites e trava por 5 s.</li>
              <li>Os dois <b className="text-white">confirmam com a senha</b>. A troca acontece na hora, sem volta.</li>
            </ol>
            {dirty && <p className="text-xs text-gold2">Você alterou sua oferta: clique em “Atualizar minha oferta” antes de aceitar.</p>}
            {!mine.accepted ? (
              <button disabled={pending || dirty || lock > 0} onClick={() => run(() => acceptTradeAction(t.id, t.version), "Você aceitou. Aguarde o outro lado.")} className="btn-gold w-full">
                {lock > 0 ? `Aguarde ${Math.ceil(lock / 1000)}s…` : "✔ Aceitar esta troca"}
              </button>
            ) : !(mine.accepted && theirs.accepted) ? (
              <p className="rounded-xl bg-gold/10 p-3 text-center text-sm text-gold2">Você aceitou. Esperando @{theirs.user.nick} aceitar…</p>
            ) : !mine.confirmed ? (
              <div className="space-y-2">
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Sua senha para confirmar" className="input" autoComplete="current-password" />
                <button disabled={pending || !pw} onClick={() => run(() => confirmTradeAction(t.id, t.version, pw), "Confirmado!")} className="btn-gold w-full">✔✔ Confirmar troca</button>
              </div>
            ) : (
              <p className="rounded-xl bg-green-900/40 p-3 text-center text-sm text-green-200">Você confirmou. Esperando @{theirs.user.nick} confirmar…</p>
            )}
            {msg && <p className="text-sm text-gold">{msg}</p>}
            <p className="text-[11px] text-mute">⚠️ Nunca troque fora do sistema. A equipe do SexPapo nunca pede sua senha.</p>
          </section>
        </div>
      )}
    </div>
  );
}
