import "server-only";
import { db } from "@/lib/db";
import { compileStyle, serializeStyle, type NickStyleJSON } from "@/lib/items";

/** E-mails do(s) fundador(es): visual exclusivo no chat e no site. */
export const FOUNDER_EMAILS = (process.env.FOUNDER_EMAILS || "admin@sexpapo.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

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
  const infos = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, vipUntil: true } });
  const founders = new Set(infos.filter((u) => FOUNDER_EMAILS.includes(u.email)).map((u) => u.id));
  const vips = new Set(infos.filter((u) => u.vipUntil && u.vipUntil > new Date()).map((u) => u.id));
  const out: Record<string, NickStyleJSON> = {};
  for (const id of ids) {
    const st = serializeStyle(compileStyle((by[id] ?? []).map((i) => i.item)));
    if (vips.has(id)) st.vip = true;
    if (founders.has(id)) {
      // fundador: visual exclusivo por cima dos itens (ninguém consegue comprar igual)
      st.founder = true;
      st.nick = {};
      st.nickClass = "founder-nick";
      st.badges = ["👑"];
      st.frame = { boxShadow: "0 0 0 2px #d4af37, 0 0 14px 3px rgba(212,175,55,.8), 0 0 24px 6px rgba(255,92,138,.35)" };
      st.frameClass = "fx-pulse";
      st.power += 1_000_000;
    }
    out[id] = st;
  }
  return out;
}
