import { redirect } from "next/navigation";

/** A busca agora mora em Pessoas (perfis + grupos, eventos, contos e salas). Links antigos continuam funcionando. */
export default async function Busca({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = String((await searchParams).q ?? "").trim().slice(0, 60);
  redirect(q ? `/pessoas?raio=br&q=${encodeURIComponent(q)}` : "/pessoas");
}
