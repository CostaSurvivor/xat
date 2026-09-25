import { redirect } from "next/navigation";
import { loadSession } from "@/server/auth";
import { safeNext } from "@/lib/pinlock";
import { UnlockForm } from "@/components/PinLock";

export const metadata = { title: "Bloqueado" };
export const dynamic = "force-dynamic";

/** Tela de PIN: sem nick, foto ou qualquer dado da conta (discrição). */
export default async function Desbloquear({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const st = await loadSession();
  const next = safeNext((await searchParams).next);
  if (!st) redirect("/login");
  if (!st.locked) redirect(next);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink p-4">
      <div className="card w-full max-w-xs space-y-4 p-6 text-center">
        <div className="text-4xl" aria-hidden="true">🔒</div>
        <h1 className="text-lg font-semibold">Digite seu PIN</h1>
        <UnlockForm next={next} />
      </div>
    </main>
  );
}
