import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";

/** Atalho do menu: abre o próprio perfil completo. */
export default async function Eu() {
  const user = await requireUser();
  redirect(`/u/${encodeURIComponent(user.nick)}`);
}
