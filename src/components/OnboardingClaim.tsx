"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ClaimButton({ action, label }: { action: () => Promise<{ ok: boolean; error?: string }>; label: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <button disabled={pending} onClick={() => start(async () => { const r = await action(); if (!r.ok) setErr(r.error ?? "Erro"); router.refresh(); })} className="btn-gold w-full">{pending ? "Resgatando…" : label}</button>
      {err && <p className="mt-1 text-sm text-red-700">{err}</p>}
    </div>
  );
}
