import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, isVerified } from "@/server/auth";
import { ContoForm } from "@/components/ContoForm";

export const metadata = { title: "Escrever conto" };

export default async function NovoConto() {
  const user = await requireUser();
  if (!isVerified(user)) redirect("/verificacao");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/contos" className="text-sm text-mute hover:text-fg">← Contos</Link>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">✍️ Escrever conto</h1>
      <ContoForm initial={null} />
    </div>
  );
}
