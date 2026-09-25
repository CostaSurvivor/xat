import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canEditConto } from "@/lib/contos";
import { requireUser } from "@/server/auth";
import { ContoForm } from "@/components/ContoForm";

export const metadata = { title: "Editar conto" };
export const dynamic = "force-dynamic";

export default async function EditarConto({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await db.conto.findUnique({ where: { id } });
  if (!c || !canEditConto(c, user)) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/contos/${c.id}`} className="text-sm text-mute hover:text-fg">← Voltar ao conto</Link>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">✏️ Editar conto</h1>
      <ContoForm initial={{ id: c.id, title: c.title, category: c.category, body: c.body }} />
    </div>
  );
}
