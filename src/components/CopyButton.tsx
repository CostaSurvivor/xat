"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }} className="btn-wine mt-2 w-full">
      {ok ? "Copiado! ✓" : "Copiar código Pix"}
    </button>
  );
}
