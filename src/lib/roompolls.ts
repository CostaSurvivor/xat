import { z } from "zod";

/** Enquetes nas salas: regras puras (testadas em tests/roompolls.test.ts). */

export const ROOM_POLL = { minOptions: 2, maxOptions: 5, minMinutes: 1, maxMinutes: 30, showClosedForMs: 60_000 };

const noLinks = (s: string) => !/https?:\/\/|www\./i.test(s);

export const roomPollSchema = z
  .object({
    question: z.string().trim().min(3, "Pergunta muito curta").max(140).refine(noLinks, "Links não são permitidos"),
    options: z.array(z.string().trim().min(1).max(60).refine(noLinks, "Links não são permitidos")).min(ROOM_POLL.minOptions, "Pelo menos 2 opções").max(ROOM_POLL.maxOptions, "No máximo 5 opções"),
    minutes: z.number().int().min(ROOM_POLL.minMinutes).max(ROOM_POLL.maxMinutes),
  })
  .refine((p) => new Set(p.options.map((o) => o.toLowerCase())).size === p.options.length, { message: "Opções repetidas", path: ["options"] });

type Actor = { role: string; platformRole: string };
/** Quem abre/encerra enquete: dono ou moderador da sala, ou a equipe do site. */
export const canManagePoll = (a: Actor) => a.platformRole !== "USER" || a.role === "OWNER" || a.role === "MODERATOR";

export function isOpen(p: { endsAt: Date; closedAt: Date | null }, now = Date.now()) {
  return !p.closedAt && p.endsAt.getTime() > now;
}

/** Contagem por opção + porcentagem arredondada + vencedora(s). */
export function tally(votes: { option: number }[], nOptions: number) {
  const counts = Array.from({ length: nOptions }, () => 0);
  for (const v of votes) if (v.option >= 0 && v.option < nOptions) counts[v.option]++;
  const total = counts.reduce((a, b) => a + b, 0);
  const pct = counts.map((c) => (total ? Math.round((c / total) * 100) : 0));
  const max = Math.max(...counts);
  const winners = total ? counts.flatMap((c, i) => (c === max ? [i] : [])) : [];
  return { counts, pct, total, winners };
}

export function resultLine(question: string, options: string[], votes: { option: number }[]) {
  const t = tally(votes, options.length);
  if (!t.total) return `📊 Enquete encerrada: “${question}”. Ninguém votou.`;
  const win = t.winners.map((i) => options[i]).join(" e ");
  return `📊 Enquete encerrada: “${question}”. ${t.winners.length > 1 ? "Empate" : "Venceu"}: ${win} (${t.counts[t.winners[0]]} de ${t.total} votos).`;
}
