"use client";

import { useRef, useState, useTransition } from "react";
import { sendCoins } from "@/app/actions/shop";
import { CURRENCY_ICON, CURRENCY_NAME } from "@/lib/config";

export function GiftButton({ toId, toNick }: { toId: string; toNick: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(50);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const idem = useRef(crypto.randomUUID());
  return (
    <>
      <button onClick={() => { setOpen(true); setMsg(null); idem.current = crypto.randomUUID(); }} className="btn-ghost">🎁 Presentear</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-xs space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Presentear @{toNick}</h3>
            <div className="grid grid-cols-4 gap-2">
              {[20, 50, 100, 500].map((v) => (
                <button key={v} onClick={() => setAmount(v)} className={`rounded-xl border py-2 text-sm ${amount === v ? "border-gold bg-gold/15" : "border-line"}`}>{v}</button>
              ))}
            </div>
            <p className="text-sm text-mute">{CURRENCY_ICON} {amount} {CURRENCY_NAME}</p>
            {msg && <p className="text-sm text-gold">{msg}</p>}
            <button
              disabled={pending}
              onClick={() => start(async () => { const r = await sendCoins(toId, amount, idem.current); setMsg(r.ok ? "Presente enviado! 🎉" : r.error ?? "Erro"); if (r.ok) idem.current = crypto.randomUUID(); })}
              className="btn-gold w-full"
            >
              Enviar presente
            </button>
          </div>
        </div>
      )}
    </>
  );
}
