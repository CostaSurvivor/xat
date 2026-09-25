import "server-only";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { pushText, pushUrl, readPrefs, wantsPush } from "@/lib/push";

/**
 * Chaves VAPID: do ambiente (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) ou, se não houver,
 * geradas uma vez e guardadas no banco (assim funciona sem configurar nada na hospedagem).
 */
let keys: { publicKey: string; privateKey: string } | null = null;
export async function vapidKeys() {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return keys;
  }
  const row = await db.platformSetting.findUnique({ where: { key: "vapid" } });
  if (row) keys = row.value as typeof keys;
  else {
    const gen = webpush.generateVAPIDKeys();
    // create (não upsert): se dois processos gerarem ao mesmo tempo, fica a primeira
    await db.platformSetting.create({ data: { key: "vapid", value: { publicKey: gen.publicKey, privateKey: gen.privateKey } } }).catch(() => {});
    keys = (await db.platformSetting.findUnique({ where: { key: "vapid" } }))!.value as typeof keys;
  }
  return keys!;
}

export const endpointHash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

function subject() {
  const url = process.env.PUBLIC_URL || "https://sexpapo.com";
  return url.startsWith("https://") ? url : `mailto:${process.env.MAIL_FROM || "contato@sexpapo.com"}`;
}

/** Envia para todos os aparelhos do usuário (nunca lança erro; remove inscrições vencidas). */
export async function sendPushTo(userId: string, payload: { title: string; body: string; url: string; tag?: string }) {
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return 0;
  const k = await vapidKeys();
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { vapidDetails: { subject: subject(), publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 3600, urgency: "normal" },
        );
        sent++;
        await db.pushSubscription.update({ where: { id: s.id }, data: { lastOkAt: new Date() } }).catch(() => {});
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }),
  );
  return sent;
}

/** Chamado por notify() e pelo PV: respeita preferências, modo discreto e limite anti-spam. */
export async function pushNotification(userId: string, kind: string, text: string, opts: { refId?: string | null; actorId?: string | null } = {}) {
  try {
    if (!(await db.pushSubscription.count({ where: { userId } }))) return;
    const u = await db.user.findUnique({ where: { id: userId }, select: { pushPrefs: true, status: true, pinHash: true } });
    if (!u || u.status !== "ACTIVE") return;
    const prefs = readPrefs(u.pushPrefs);
    // com PIN ativo, o texto nunca aparece na tela de bloqueio do celular
    if (u.pinHash) prefs.discreet = true;
    if (!wantsPush(prefs, kind)) return;
    // no máximo 1 push por remetente+tipo a cada 3 min (conversa no PV não vira metralhadora)
    if (!limiter("push", 1, 1 / 180).take(`${userId}:${kind}:${opts.actorId ?? ""}`)) return;
    const actorNick = opts.actorId ? (await db.user.findUnique({ where: { id: opts.actorId }, select: { nick: true } }))?.nick : null;
    const { title, body } = pushText(kind, text, prefs.discreet);
    await sendPushTo(userId, { title, body, url: pushUrl(kind, opts.refId, actorNick), tag: kind });
  } catch {}
}
