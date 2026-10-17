"use client";

import { useState } from "react";

/** Filtros da busca: no celular ficam atrás de "Filtrar (N)"; no computador, sempre à vista. */
export function FiltersToggle({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn-ghost w-full justify-between md:hidden" data-testid="filtrar">
        <span>⚙️ Filtrar{count > 0 && <span className="ml-1 rounded-full bg-wine px-1.5 text-xs font-bold text-white">{count}</span>}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      <div className={`${open ? "flex" : "hidden"} mt-2 flex-wrap items-center gap-2 md:mt-0 md:flex`} data-testid="filtros">{children}</div>
    </div>
  );
}
