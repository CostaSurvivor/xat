import Link from "next/link";
import { createRoom } from "@/app/actions/rooms";
import { RoomForm } from "@/components/RoomForm";
import { isSubscriber, requireUser } from "@/server/auth";

export const metadata = { title: "Nova sala" };

export default async function NovaSala() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !isSubscriber(user))
    return (
      <div className="card mx-auto max-w-md space-y-3 p-8 text-center">
        <p className="text-4xl">⭐</p>
        <h1 className="text-xl font-bold">Sala própria é para assinantes</h1>
        <p className="text-sm text-mute">Assinantes criam até 3 salas com endereço próprio (ex.: /casaisSP), moderadores e regras. A sala fica ativa enquanto a assinatura estiver em dia.</p>
        <Link href="/assinar" className="btn-gold">Quero assinar</Link>
      </div>
    );
  return (
    <div className="card mx-auto max-w-2xl p-6">
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl font-bold">Criar sala</h1>
      <RoomForm action={createRoom} isNew canOfficial={isAdmin} />
    </div>
  );
}
