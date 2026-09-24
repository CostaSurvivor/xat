import { db } from "@/lib/db";
import { ageOn } from "@/lib/age";
import { PROFILE_TYPES } from "@/lib/config";
import { queueOrder } from "@/lib/modqueue";
import { requireStaff } from "@/server/auth";
import { ModQueue, type QueueItem } from "@/components/ModQueue";

export const metadata = { title: "Fila rápida" };
export const dynamic = "force-dynamic";

const REASON_PT: Record<string, string> = {
  POSSIBLE_MINOR: "🚨 POSSÍVEL MENOR", NON_CONSENSUAL: "Sem consentimento", ILLEGAL_CONTENT: "Conteúdo ilegal", HARASSMENT: "Assédio", FAKE_PROFILE: "Perfil falso", SPAM: "Spam", OTHER: "Outro",
};

export default async function Fila() {
  await requireStaff();
  const [verifs, events, reports] = await Promise.all([
    db.verificationRequest.findMany({ where: { status: "PENDING" }, include: { user: { include: { persons: true } } }, orderBy: { createdAt: "asc" }, take: 50 }),
    db.event.findMany({ where: { status: "PENDING" }, include: { creator: { select: { nick: true } } }, orderBy: { createdAt: "asc" }, take: 50 }),
    db.report.findMany({ where: { status: "OPEN" }, include: { reporter: { select: { nick: true } } }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 100 }),
  ]);
  const targets = await db.user.findMany({ where: { id: { in: reports.map((r) => r.targetUserId).filter(Boolean) as string[] } }, select: { id: true, nick: true } });
  const nickOf = new Map(targets.map((t) => [t.id, t.nick]));

  const items: QueueItem[] = [
    ...verifs.map((v) => ({
      kind: "verification" as const, id: v.id, priority: 0, createdAt: v.createdAt.toISOString(),
      title: `Verificação de @${v.user.nick}`,
      lines: [`${PROFILE_TYPES[v.user.profileType].label} · idades declaradas: ${v.user.persons.map((p) => `${p.label} ${ageOn(p.birthDate)}`).join(", ")}`, `Gesto pedido: ${v.gesture}`],
      images: [{ id: v.mediaId, blur: false }],
      link: `/u/${v.user.nick}`,
    })),
    ...events.map((e) => ({
      kind: "event" as const, id: e.id, priority: 0, createdAt: e.createdAt.toISOString(),
      title: `Evento: ${e.title}`,
      lines: [`por @${e.creator.nick} · ${e.city}/${e.state} · ${e.startsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, e.description.slice(0, 600)],
      images: e.coverMediaId ? [{ id: e.coverMediaId, blur: false }] : [],
      link: `/eventos/${e.id}`,
    })),
    ...reports.map((r) => {
      const ev = r.evidence as { media?: string[]; mediaId?: string; body?: string } | null;
      const media = [...(ev?.media ?? []), ...(ev?.mediaId ? [ev.mediaId] : [])];
      const target = r.targetUserId ? nickOf.get(r.targetUserId) : null;
      return {
        kind: "report" as const, id: r.id, priority: r.priority, createdAt: r.createdAt.toISOString(),
        title: `${REASON_PT[r.reason]} · ${r.targetType}${target ? ` de @${target}` : ""}`,
        lines: [`denunciado por @${r.reporter.nick}`, ...(r.details ? [`“${r.details}”`] : []), ...(typeof ev?.body === "string" ? [`Conteúdo: ${ev.body.slice(0, 600)}`] : [])],
        // possível menor: sempre borrado na fila
        images: media.map((id) => ({ id, blur: r.reason === "POSSIBLE_MINOR" })),
        link: target ? `/u/${target}` : null,
        urgent: r.reason === "POSSIBLE_MINOR",
      };
    }),
  ];
  return <ModQueue items={queueOrder(items)} />;
}
