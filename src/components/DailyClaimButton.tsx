"use client";

import { useState, useTransition } from "react";
import { claimDaily } from "@/app/actions/daily";
import { CURRENCY_ICON } from "@/lib/config";

export function DailyClaimButton({ reward }: { reward: number }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-gold" disabled={pending || !!msg}
        onClick={() => start(async () => { const r = await claimDaily(); setMsg(r.ok ? `+${r.reward} ${CURRENCY_ICON} na sua carteira! 🎉` : r.error ?? "Tente de novo."); })}>
        {pending ? "Pegando…" : `Pegar ${reward} ${CURRENCY_ICON}`}
      </button>
      {msg && <span role="status" className="text-sm font-medium text-wine">{msg}</span>}
    </div>
  );
}
