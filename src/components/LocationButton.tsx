"use client";

import { useState, useTransition } from "react";
import { resetToCityLocation, setApproxLocation } from "@/app/actions/profile";

/** Liga/desliga a localização aproximada do aparelho (gravada com ~1 km de precisão). */
export function LocationButton({ source, city }: { source: string | null; city: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const useGps = () => {
    if (!("geolocation" in navigator)) return setMsg("Seu navegador não permite localização.");
    setMsg("Pedindo permissão…");
    navigator.geolocation.getCurrentPosition(
      (pos) => start(async () => {
        const r = await setApproxLocation(pos.coords.latitude, pos.coords.longitude);
        setMsg(r?.error ?? "📍 Localização aproximada ativada.");
      }),
      () => setMsg("Permissão negada. A distância continua pela sua cidade."),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {source === "GPS" ? (
        <>
          <span className="text-green-700">📍 Usando sua localização aproximada (~1 km)</span>
          <button disabled={pending} onClick={() => start(async () => { await resetToCityLocation(); setMsg("Voltou a usar sua cidade."); })} className="btn-ghost py-1 text-xs">Usar minha cidade</button>
        </>
      ) : (
        <>
          <span className="text-mute">{source === "CITY" ? `Distâncias calculadas por ${city}.` : "Informe sua cidade no perfil para ver distâncias."}</span>
          <button disabled={pending} onClick={useGps} className="btn-ghost py-1 text-xs">📍 Usar minha localização aproximada</button>
        </>
      )}
      {msg && <span className="text-xs text-mute">{msg}</span>}
    </div>
  );
}
