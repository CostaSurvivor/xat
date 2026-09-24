"use client";

import { useState, useTransition } from "react";
import { rsvpEvent } from "@/app/actions/events";

export function RsvpButtons({ eventId, current }: { eventId: string; current: "GOING" | "MAYBE" | null }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const click = (s: "GOING" | "MAYBE") =>
    start(async () => {
      const r = await rsvpEvent(eventId, current === s ? "" : s);
      setErr(r?.error ?? null);
    });
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button disabled={pending} onClick={() => click("GOING")} className={current === "GOING" ? "btn-gold" : "btn-ghost"}>{current === "GOING" ? "✅ Eu vou" : "🎉 Eu vou"}</button>
        <button disabled={pending} onClick={() => click("MAYBE")} className={current === "MAYBE" ? "btn-wine" : "btn-ghost"}>🤔 Talvez</button>
      </div>
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}
