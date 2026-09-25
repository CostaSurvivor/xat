"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { CURRENCY_NAME } from "@/lib/config";
import { itemConfigSchemas, type ItemCategoryKey } from "@/lib/items";
import { requireAdmin, requireStaff, sha256 } from "@/server/auth";
import { adminAdjust, creditPayment, grantVip } from "@/server/ledger";
import { audit, notify } from "@/server/notify";

// ---------------- Pagamentos (admin) ----------------
export async function approvePayment(paymentId: string) {
  const admin = await requireAdmin();
  const p = await creditPayment(paymentId, admin.id);
  await notify(p.userId, "COINS_CREDITED", p.kind === "VIP" ? `⭐ Assinatura ativada (${p.vipDays} dias)! Agora você assiste aos vídeos.` : `✅ Pix ${p.code} aprovado: +${p.coins} ${CURRENCY_NAME}!`);
  await audit(admin.id, "payment.approve", "Payment", paymentId);
  const buyer = await db.user.findUnique({ where: { id: p.userId }, select: { email: true, nick: true } });
  if (buyer) {
    const { sendMail } = await import("@/server/mail");
    const brl = (p.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    await sendMail(buyer.email, `Recibo ${p.code}`, [
      `Olá, ${buyer.nick}! Seu pagamento foi confirmado.`,
      `Pedido: ${p.code}`,
      `Item: ${p.kind === "VIP" ? `Assinatura ${p.packageName} (${p.vipDays} dias)` : `${p.packageName} (${p.coins} ${CURRENCY_NAME})`}`,
      `Valor: ${brl} · Pix`,
      `Data: ${new Date().toLocaleString("pt-BR")}`,
    ]);
  }
  revalidatePath("/admin/pagamentos");
}

export async function rejectPayment(paymentId: string) {
  const admin = await requireAdmin();
  const p = await db.payment.update({ where: { id: paymentId }, data: { status: "REJECTED", reviewedById: admin.id, reviewedAt: new Date() } });
  await notify(p.userId, "SYSTEM", `Pix ${p.code} não foi localizado. Se você pagou, fale com a administração.`);
  await audit(admin.id, "payment.reject", "Payment", paymentId);
  revalidatePath("/admin/pagamentos");
}

// ---------------- Verificações (staff) ----------------
export async function reviewVerification(id: string, approve: boolean, formData?: FormData) {
  const staff = await requireStaff();
  const v = await db.verificationRequest.findUnique({ where: { id } });
  if (!v || v.status !== "PENDING") return;
  const reason = String(formData?.get("reason") || "").slice(0, 255) || null;
  await db.verificationRequest.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", reviewerId: staff.id, reviewedAt: new Date(), rejectReason: approve ? null : reason } });
  await db.user.update({ where: { id: v.userId }, data: approve ? { ageVerification: "APPROVED", ageVerifiedAt: new Date() } : { ageVerification: "REJECTED" } });
  await notify(v.userId, "VERIFICATION", approve ? "✅ Perfil verificado! Fotos, PV com fotos, loja e criação de salas liberados." : `Verificação recusada${reason ? `: ${reason}` : ""}. Tente de novo.`);
  await audit(staff.id, approve ? "verification.approve" : "verification.reject", "User", v.userId, { reason });
  if (approve) {
    await (await import("@/server/welcome")).claimWelcome(v.userId);
    await (await import("@/server/referral")).rewardReferral(v.userId);
    await (await import("@/server/searchAlerts")).runSearchAlerts(v.userId);
  }
  revalidatePath("/admin/verificacoes");
}

// ---------------- Denúncias (staff) ----------------
/**
 * Bane/suspende. Moderador não age contra staff (admin/moderador); ninguém bane a si mesmo.
 * Devolve false quando recusado (a denúncia continua sendo resolvida, só sem o banimento).
 */
async function banUser(userId: string, actor: { id: string; role: string }, reason: string, days: number | null): Promise<boolean> {
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || userId === actor.id || (target.role !== "USER" && actor.role !== "ADMIN")) {
    await audit(actor.id, "user.ban.refused", "User", userId, { reason, targetRole: target?.role });
    return false;
  }
  const actorId = actor.id;
  const u = await db.user.update({ where: { id: userId }, data: { status: days ? "SUSPENDED" : "BANNED" } });
  await db.session.deleteMany({ where: { userId } });
  if (!days) {
    const ips = await db.accessLog.findMany({ where: { userId }, distinct: ["ip"], select: { ip: true }, take: 10 });
    const devices = await db.accessLog.findMany({ where: { userId, deviceId: { not: null } }, distinct: ["deviceId"], select: { deviceId: true }, take: 10 });
    const expiresAt = null;
    await db.banFingerprint.createMany({
      data: [
        { kind: "EMAIL", valueHash: sha256(u.email), reason, expiresAt },
        ...ips.map((i) => ({ kind: "IP", valueHash: sha256(i.ip), reason, expiresAt: new Date(Date.now() + 90 * 86400_000) })),
        ...devices.map((d) => ({ kind: "DEVICE", valueHash: sha256(d.deviceId!), reason, expiresAt })),
      ],
      skipDuplicates: true,
    });
  }
  await audit(actorId, days ? "user.suspend" : "user.ban", "User", userId, { reason, days });
  return true;
}

async function removeTarget(type: string, id: string) {
  switch (type) {
    case "POST": {
      const p = await db.post.update({ where: { id }, data: { deletedAt: new Date() } });
      const media = await db.postMedia.findMany({ where: { postId: p.id } });
      await db.media.updateMany({ where: { id: { in: media.map((m) => m.mediaId) } }, data: { status: "REMOVED" } });
      break;
    }
    case "COMMENT":
      await db.postComment.update({ where: { id }, data: { deletedAt: new Date() } });
      break;
    case "ROOM_MESSAGE": {
      const m = await db.message.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date() } });
      if (m.mediaId) await db.media.update({ where: { id: m.mediaId }, data: { status: "REMOVED" } });
      break;
    }
    case "PRIVATE_MESSAGE": {
      const m = await db.privateMessage.update({ where: { id: BigInt(id) }, data: { body: "[removido pela moderação]" } });
      if (m.mediaId) await db.media.update({ where: { id: m.mediaId }, data: { status: "REMOVED" } });
      break;
    }
    case "MEDIA":
      await db.media.update({ where: { id }, data: { status: "REMOVED" } });
      break;
    case "TESTIMONIAL":
      await db.testimonial.deleteMany({ where: { id } });
      break;
    case "CONTO":
      await db.conto.updateMany({ where: { id }, data: { deletedAt: new Date() } });
      break;
    case "CONTO_COMMENT": {
      const r = await db.contoComment.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
      const cm = r.count ? await db.contoComment.findUnique({ where: { id }, select: { contoId: true } }) : null;
      if (cm) await db.conto.update({ where: { id: cm.contoId }, data: { commentCount: { decrement: 1 } } });
      break;
    }
  }
}

export async function handleReport(reportId: string, formData: FormData) {
  const staff = await requireStaff();
  const r = await db.report.findUnique({ where: { id: reportId } });
  if (!r) return;
  const op = String(formData.get("op"));
  const note = String(formData.get("note") || "").slice(0, 500) || null;

  if (op === "dismiss") {
    await db.report.update({ where: { id: r.id }, data: { status: "DISMISSED", resolution: note, resolvedById: staff.id, resolvedAt: new Date() } });
    // mídia bloqueada preventivamente volta ao ar
    if (r.reason === "POSSIBLE_MINOR") {
      const ev = r.evidence as { media?: string[]; mediaId?: string } | null;
      const ids = [...(ev?.media ?? []), ...(ev?.mediaId ? [ev.mediaId] : [])];
      await db.media.updateMany({ where: { id: { in: ids }, status: "QUARANTINED" }, data: { status: "APPROVED" } });
    }
  } else if (op === "remove" || op === "remove_ban" || op === "remove_suspend") {
    await removeTarget(r.targetType, r.targetId);
    if (op !== "remove" && r.targetUserId) await banUser(r.targetUserId, staff, `Denúncia ${r.reason}`, op === "remove_suspend" ? 7 : null);
    await db.report.update({ where: { id: r.id }, data: { status: "RESOLVED", resolution: note ?? op, resolvedById: staff.id, resolvedAt: new Date() } });
  } else if (op === "escalate") {
    // CSAM / crime: preserva evidência, bloqueia hash, bane, marca para reporte às autoridades
    const ev = r.evidence as { media?: string[]; mediaId?: string } | null;
    const ids = [...(ev?.media ?? []), ...(ev?.mediaId ? [ev.mediaId] : [])];
    const medias = await db.media.findMany({ where: { id: { in: ids } } });
    await db.media.updateMany({ where: { id: { in: ids } }, data: { status: "QUARANTINED" } });
    for (const m of medias) await db.mediaHashBlock.upsert({ where: { sha256: m.sha256 }, create: { sha256: m.sha256, reason: `report:${r.id}` }, update: {} });
    await removeTarget(r.targetType, r.targetId).catch(() => {});
    if (r.targetUserId) await banUser(r.targetUserId, staff, "Conteúdo ilegal (escalado)", null);
    await db.report.update({ where: { id: r.id }, data: { status: "ESCALATED", resolution: note, resolvedById: staff.id, resolvedAt: new Date() } });
  }
  await audit(staff.id, `report.${op}`, "Report", r.id, { note });
  revalidatePath("/admin/denuncias");
}

// ---------------- Usuários (admin) ----------------
export async function adminUserAction(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  const op = String(formData.get("op"));
  if (userId === admin.id && op !== "coins") return;
  if (op === "ban") await banUser(userId, admin, "Banido pelo admin", null);
  else if (op === "suspend") await banUser(userId, admin, "Suspenso pelo admin", 7);
  else if (op === "unban") {
    const u = await db.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    await db.banFingerprint.deleteMany({ where: { kind: "EMAIL", valueHash: sha256(u.email) } });
    await audit(admin.id, "user.unban", "User", userId);
  } else if (op === "role") {
    const role = z.enum(["USER", "MODERATOR", "ADMIN"]).parse(formData.get("role"));
    await db.user.update({ where: { id: userId }, data: { role } });
    await audit(admin.id, "user.role", "User", userId, { role });
  } else if (op === "verify") {
    await db.user.update({ where: { id: userId }, data: { ageVerification: "APPROVED", ageVerifiedAt: new Date() } });
    await audit(admin.id, "user.verify", "User", userId);
    await (await import("@/server/welcome")).claimWelcome(userId);
    await (await import("@/server/referral")).rewardReferral(userId);
    await (await import("@/server/searchAlerts")).runSearchAlerts(userId);
  } else if (op === "unverify") {
    // tira o selo: volta a "não verificado" e pode enviar nova selfie (fotos já publicadas continuam; novas exigem verificar de novo)
    const reason = String(formData.get("reason") || "").trim().slice(0, 200) || null;
    await db.user.update({ where: { id: userId }, data: { ageVerification: "NONE", ageVerifiedAt: null } });
    await db.verificationRequest.updateMany({ where: { userId, status: "PENDING" }, data: { status: "REJECTED", reviewerId: admin.id, reviewedAt: new Date(), rejectReason: reason } });
    await notify(userId, "VERIFICATION", `Seu selo de verificado foi removido pela administração${reason ? `: ${reason}` : ""}. Envie uma nova selfie em Verificação.`);
    await audit(admin.id, "user.unverify", "User", userId, { reason });
  } else if (op === "resetpw") {
    const { randomBytes } = await import("node:crypto");
    const { hashPassword } = await import("@/server/auth");
    const temp = "Tmp-" + randomBytes(5).toString("hex");
    await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(temp) } });
    await db.session.deleteMany({ where: { userId } });
    await db.platformSetting.upsert({ where: { key: `tmppw:${admin.id}` }, create: { key: `tmppw:${admin.id}`, value: { userId, temp, at: Date.now() } }, update: { value: { userId, temp, at: Date.now() } } });
    await audit(admin.id, "user.reset_password", "User", userId);
  } else if (op === "vip") {
    const days = Number(formData.get("days") || 30);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return;
    await grantVip(userId, days);
    await notify(userId, "SYSTEM", `⭐ Você ganhou ${days} dias de assinatura!`);
    await audit(admin.id, "user.vip", "User", userId, { days });
  } else if (op === "coins") {
    const amount = Number(formData.get("amount"));
    const note = String(formData.get("note") || "Ajuste manual").slice(0, 200);
    const key = String(formData.get("idem") || "");
    if (!Number.isInteger(amount) || amount === 0 || !key) return;
    await adminAdjust(userId, amount, admin.id, note, `admin:${key}`);
    if (amount > 0) await notify(userId, "COINS_CREDITED", `+${amount} ${CURRENCY_NAME} creditadas pela administração (${note})`);
  }
  revalidatePath("/admin/usuarios");
}

// ---------------- Salas (admin) ----------------
/** Equipe do site (admin ou moderador) nomeia/remove moderador de uma sala de estado. */
export async function adminRoomModerator(roomId: string, _: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const staff = await requireStaff();
  const { STAFF_ONLY_ROOMS } = await import("@/lib/config");
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) return { error: "Sala não encontrada" };
  if (STAFF_ONLY_ROOMS.has(room.slug)) return { error: "Esta sala é moderada só pela equipe do site." };
  const op = String(formData.get("op"));
  const nick = String(formData.get("nick") || "").trim().replace(/^@/, "");
  const target = await db.user.findFirst({ where: { nick }, select: { id: true, nick: true, status: true, role: true } });
  if (!target) return { error: "Nick não encontrado" };
  if (op === "add") {
    if (target.status !== "ACTIVE") return { error: "Usuário não está ativo" };
    if (target.role !== "USER") return { error: "Admins e moderadores do site já moderam todas as salas." };
    await db.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: target.id } },
      create: { roomId: room.id, userId: target.id, role: "MODERATOR" },
      update: { role: "MODERATOR" },
    });
    await notify(target.id, "SYSTEM", `🛡️ Você agora é moderador(a) da sala ${room.name} (/${room.slug}).`, staff.id, room.slug);
  } else if (op === "remove") {
    await db.roomMember.updateMany({ where: { roomId: room.id, userId: target.id, role: "MODERATOR" }, data: { role: "MEMBER" } });
  } else return { error: "Ação inválida" };
  await audit(staff.id, `room.moderator.${op}`, "Room", room.id, { nick: target.nick });
  revalidatePath("/admin/salas");
  return { ok: true };
}

// ---------------- Loja (admin) ----------------
const itemSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  name: z.string().min(2).max(80),
  description: z.string().max(255).optional(),
  category: z.enum(Object.keys(itemConfigSchemas) as [ItemCategoryKey, ...ItemCategoryKey[]]),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "LIMITED"]),
  config: z.string(),
  powerScore: z.coerce.number().int().min(0).max(1000),
  price7: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
  price30: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
  pricePerm: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
  limitedQty: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)),
});

export async function saveItem(_: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const admin = await requireAdmin();
  const p = itemSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: `${p.error.issues[0].path.join(".")}: ${p.error.issues[0].message}` };
  let cfg: unknown;
  try {
    cfg = JSON.parse(p.data.config);
  } catch {
    return { error: "Config não é JSON válido" };
  }
  const c = itemConfigSchemas[p.data.category].safeParse(cfg);
  if (!c.success) return { error: `Config inválida para ${p.data.category}: ${c.error.issues[0].path.join(".")} ${c.error.issues[0].message}` };
  const data = {
    name: p.data.name,
    description: p.data.description || null,
    category: p.data.category,
    rarity: p.data.rarity,
    config: c.data,
    powerScore: p.data.powerScore,
    price7: p.data.price7 ?? null,
    price30: p.data.price30 ?? null,
    pricePerm: p.data.pricePerm ?? null,
    limitedQty: p.data.limitedQty ?? null,
  };
  await db.item.upsert({ where: { slug: p.data.slug }, create: { slug: p.data.slug, ...data }, update: data });
  await audit(admin.id, "item.save", "Item", p.data.slug);
  revalidatePath("/admin/loja");
  return { ok: true };
}

export async function toggleItemActive(itemId: string) {
  const admin = await requireAdmin();
  const i = await db.item.findUniqueOrThrow({ where: { id: itemId } });
  await db.item.update({ where: { id: itemId }, data: { active: !i.active } });
  await audit(admin.id, "item.toggle", "Item", itemId);
  revalidatePath("/admin/loja");
}

export async function savePackage(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const data = {
    name: String(formData.get("name") || "").slice(0, 60),
    coins: Number(formData.get("coins")),
    bonusCoins: Number(formData.get("bonusCoins") || 0),
    priceCents: Math.round(Number(String(formData.get("price")).replace(",", ".")) * 100),
    active: formData.get("active") === "on",
  };
  if (!data.name || !Number.isInteger(data.coins) || data.coins <= 0 || !Number.isFinite(data.priceCents) || data.priceCents <= 0) return;
  if (id) await db.coinPackage.update({ where: { id }, data });
  else await db.coinPackage.create({ data });
  await audit(admin.id, "package.save", "CoinPackage", id || data.name);
  revalidatePath("/admin/loja");
}

// ---------------- Anúncios (admin) ----------------
export async function createAnnouncement(formData: FormData) {
  const admin = await requireAdmin();
  const body = String(formData.get("body") || "").trim().slice(0, 500);
  const hours = Number(formData.get("hours") || 24);
  if (!body) return;
  await db.announcement.create({ data: { body, expiresAt: new Date(Date.now() + hours * 3600_000) } });
  if (formData.get("rooms") === "on") {
    const rooms = await db.room.findMany({ select: { id: true } });
    await db.message.createMany({ data: rooms.map((r) => ({ roomId: r.id, kind: "ANNOUNCEMENT" as const, body })) });
  }
  await audit(admin.id, "announcement.create", undefined, undefined, { body });
  revalidatePath("/admin/avisos");
}

export async function endAnnouncement(id: string) {
  await requireAdmin();
  await db.announcement.update({ where: { id }, data: { expiresAt: new Date() } });
  revalidatePath("/admin/avisos");
}

export async function saveVipPlan(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const data = {
    name: String(formData.get("name") || "").slice(0, 60),
    days: Number(formData.get("days")),
    bonusCoins: Number(formData.get("bonusCoins") || 0),
    priceCents: Math.round(Number(String(formData.get("price")).replace(",", ".")) * 100),
    active: formData.get("active") === "on",
  };
  if (!data.name || !Number.isInteger(data.days) || data.days <= 0 || !Number.isFinite(data.priceCents) || data.priceCents <= 0) return;
  if (id) await db.vipPlan.update({ where: { id }, data });
  else await db.vipPlan.create({ data });
  await audit(admin.id, "vipplan.save", "VipPlan", id || data.name);
  revalidatePath("/admin/loja");
}

// ---------------- Configurações (admin) ----------------
const pixSchema = z.object({
  key: z.string().trim().min(3, "Chave Pix muito curta").max(77),
  merchantName: z.string().trim().min(2).max(25),
  merchantCity: z.string().trim().min(2).max(15),
});

export async function savePixConfig(_: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const admin = await requireAdmin();
  const p = pixSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0].message };
  await db.platformSetting.upsert({ where: { key: "pix" }, create: { key: "pix", value: p.data }, update: { value: p.data } });
  await audit(admin.id, "settings.pix", undefined, undefined, { key: p.data.key.slice(0, 4) + "…" });
  revalidatePath("/admin/config");
  return { ok: true };
}

export async function saveHeroImage(_: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const admin = await requireAdmin();
  const { default: sharp } = await import("sharp");
  const { storage } = await import("@/server/storage");
  const { randomBytes } = await import("node:crypto");
  if (formData.get("remove") === "1") {
    await db.platformSetting.deleteMany({ where: { key: "hero" } });
    revalidatePath("/", "layout");
    return { ok: true };
  }
  const file = formData.get("hero");
  if (!(file instanceof File) || !file.size) return { error: "Escolha uma imagem" };
  if (file.size > 15 * 1024 * 1024) return { error: "Imagem muito grande (máx. 15 MB)" };
  let out: Buffer;
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 80_000_000 })
      .rotate()
      .resize(2200, 2200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
  } catch {
    return { error: "Arquivo não é uma imagem válida" };
  }
  const key = `site/hero-${randomBytes(6).toString("hex")}.webp`;
  await storage.put(key, out);
  await db.platformSetting.upsert({ where: { key: "hero" }, create: { key: "hero", value: { key, v: Date.now().toString(36) } }, update: { value: { key, v: Date.now().toString(36) } } });
  await audit(admin.id, "settings.hero");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveCoupon(formData: FormData) {
  const admin = await requireAdmin();
  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return;
  const bonusPercent = Math.max(1, Math.min(200, Number(formData.get("bonusPercent") || 0)));
  const maxUses = Number(formData.get("maxUses") || 0) || null;
  const days = Number(formData.get("days") || 0);
  const data = { bonusPercent, maxUses, active: formData.get("active") === "on", expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null };
  await db.coupon.upsert({ where: { code }, create: { code, ...data }, update: data });
  await audit(admin.id, "coupon.save", "Coupon", code);
  revalidatePath("/admin/loja");
}
