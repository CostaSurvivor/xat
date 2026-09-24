"use client";

import { useEffect, useState } from "react";

export function useBadges() {
  const [b, setB] = useState({ notif: 0, pm: 0 });
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/me/badges").then((r) => r.json()).then((j) => alive && setB(j)).catch(() => {});
    load();
    const t = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return b;
}

export function Dot({ n }: { n: number }) {
  if (!n) return null;
  return <span className="absolute -right-1.5 -top-1 min-w-4 rounded-full bg-wine2 px-1 text-center text-[10px] font-bold leading-4 text-white">{n > 9 ? "9+" : n}</span>;
}
