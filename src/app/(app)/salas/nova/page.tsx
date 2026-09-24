import { redirect } from "next/navigation";
import { createRoom } from "@/app/actions/rooms";
import { RoomForm } from "@/components/RoomForm";
import { isVerified, requireUser } from "@/server/auth";

export const metadata = { title: "Nova sala" };

export default async function NovaSala() {
  const user = await requireUser();
  if (!isVerified(user)) redirect("/verificacao");
  return (
    <div className="card mx-auto max-w-2xl p-6">
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl font-bold">Criar sala</h1>
      <RoomForm action={createRoom} isNew />
    </div>
  );
}
