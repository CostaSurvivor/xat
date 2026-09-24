"use client";

import { useState, useTransition } from "react";
import { submitReport } from "@/app/actions/report";

const REASONS = [
  ["POSSIBLE_MINOR", "🚨 Possível menor de idade"],
  ["NON_CONSENSUAL", "Foto sem consentimento / de terceiros"],
  ["ILLEGAL_CONTENT", "Conteúdo ilegal"],
  ["HARASSMENT", "Assédio / ofensa"],
  ["FAKE_PROFILE", "Perfil falso"],
  ["SPAM", "Spam / golpe"],
  ["OTHER", "Outro"],
] as const;

export function ReportButton({ targetType, targetId, label = "Denunciar", className = "" }: { targetType: string; targetId: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className={`text-xs text-mute hover:text-red-300 ${className}`}>⚑ {label}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            action={(fd) => start(async () => { const r = await submitReport(fd); setMsg(r.message); if (r.ok) setTimeout(() => setOpen(false), 1500); })}
            className="card w-full max-w-sm space-y-3 p-5"
          >
            <h3 className="font-semibold">Denunciar</h3>
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />
            <select name="reason" className="input" required>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <textarea name="details" maxLength={1000} className="input h-20" placeholder="Detalhes (opcional)" />
            {msg && <p className="text-sm text-gold">{msg}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancelar</button>
              <button disabled={pending} className="btn-wine">Enviar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
