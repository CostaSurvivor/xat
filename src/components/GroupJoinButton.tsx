"use client";

import { useState, useTransition } from "react";
import { joinGroup, leaveGroup } from "@/app/actions/groups";

export function GroupJoinButton({ groupId, member }: { groupId: string; member: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      {member ? (
        <button disabled={pending} onClick={() => start(async () => { if (confirm("Sair do grupo?")) await leaveGroup(groupId); })} className="btn-ghost">✓ Participando</button>
      ) : (
        <button disabled={pending} onClick={() => start(async () => { const r = await joinGroup(groupId); setErr(r?.error ?? null); })} className="btn-gold">+ Participar</button>
      )}
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  );
}
