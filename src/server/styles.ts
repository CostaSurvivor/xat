import "server-only";
import { db } from "@/lib/db";
import { compileStyle, serializeStyle, type NickStyleJSON } from "@/lib/items";

/** Estilos (itens ativos, não expirados) de vários usuários de uma vez. */
export async function stylesFor(userIds: string[]): Promise<Record<string, NickStyleJSON>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return {};
  const inv = await db.inventoryItem.findMany({
    where: { userId: { in: ids }, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: { item: { select: { category: true, config: true, powerScore: true } } },
  });
  const by: Record<string, typeof inv> = {};
  for (const i of inv) (by[i.userId] ??= []).push(i);
  const out: Record<string, NickStyleJSON> = {};
  for (const id of ids) out[id] = serializeStyle(compileStyle((by[id] ?? []).map((i) => i.item)));
  return out;
}
