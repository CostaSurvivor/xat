/**
 * Seed: salas oficiais, catálogo de itens, pacotes de moeda.
 * SEED_DEMO=1 também cria usuários/posts fictícios para demonstração (NÃO usar em produção).
 */
import { PrismaClient, type ItemCategory, type ItemRarity } from "@prisma/client";
import sharp from "sharp";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hash } from "@node-rs/argon2";

const db = new PrismaClient();

import { COUPLES_ROOM, GENERAL_ROOM, STAFF_ONLY_ROOMS, UFS, defaultStateDescription, stateRoom } from "../src/lib/config";
import { cityCoords } from "../src/lib/geo";
import { DEFAULT_GROUPS } from "../src/lib/groups";

type ItemSeed = { slug: string; name: string; category: ItemCategory; rarity?: ItemRarity; config: object; powerScore?: number; price7?: number; price30?: number; pricePerm?: number; limitedQty?: number; description?: string };

const ITEMS: ItemSeed[] = [
  // Glow neon (estilo xat)
  { slug: "neon-rosa", name: "Neon Rosa", category: "GLOW", rarity: "RARE", config: { colors: ["#ff2fa3", "#ff7ad0"], animation: "neon" }, price7: 70, price30: 190, pricePerm: 950, powerScore: 10 },
  { slug: "neon-azul", name: "Neon Azul", category: "GLOW", rarity: "RARE", config: { colors: ["#28d7ff", "#2f6bff"], animation: "neon" }, price7: 70, price30: 190, pricePerm: 950, powerScore: 10 },
  { slug: "neon-verde", name: "Neon Verde", category: "GLOW", rarity: "RARE", config: { colors: ["#39ff88", "#10b35a"], animation: "neon" }, price7: 70, price30: 190, pricePerm: 950, powerScore: 10 },
  { slug: "neon-roxo", name: "Neon Roxo", category: "GLOW", rarity: "EPIC", config: { colors: ["#b36bff", "#7a2cff", "#ff4fd8"], animation: "neon" }, price7: 90, price30: 240, pricePerm: 1200, powerScore: 12 },
  { slug: "neon-dourado", name: "Neon Dourado", category: "GLOW", rarity: "EPIC", config: { colors: ["#fff3c4", "#d4af37"], animation: "neon" }, price7: 100, price30: 280, pricePerm: 1400, powerScore: 14 },
  { slug: "neon-arco-iris", name: "Neon Arco-íris", category: "GLOW", rarity: "LEGENDARY", config: { colors: ["#ff3b6b", "#ffd23b", "#3bffb4"], animation: "rainbow" }, price7: 150, price30: 400, pricePerm: 2200, powerScore: 20 },
  // Acessórios do boneco
  { slug: "boneco-cowboy", name: "Chapéu de cowboy", category: "DOLL", config: { accessory: "cowboy" }, price30: 80, pricePerm: 400, powerScore: 4 },
  { slug: "boneco-chifre", name: "Chifre de boi (Cuckold)", category: "DOLL", rarity: "RARE", config: { accessory: "horns" }, price30: 90, pricePerm: 450, powerScore: 5 },
  { slug: "boneco-cuckqueen", name: "Tiara com chifrinhos (Cuckqueen)", category: "DOLL", rarity: "RARE", config: { accessory: "cuckqueen" }, price30: 90, pricePerm: 450, powerScore: 5 },
  { slug: "boneco-varinha", name: "Varinha mágica", category: "DOLL", rarity: "EPIC", config: { accessory: "wand" }, price30: 120, pricePerm: 600, powerScore: 6 },
  { slug: "boneco-cartola", name: "Cartola", category: "DOLL", config: { accessory: "tophat" }, price30: 70, pricePerm: 350, powerScore: 3 },
  { slug: "boneco-aureola", name: "Auréola de anjo", category: "DOLL", config: { accessory: "halo" }, price30: 70, pricePerm: 350, powerScore: 3 },
  { slug: "boneco-diabinha", name: "Chifres de diabinha", category: "DOLL", config: { accessory: "devil" }, price30: 70, pricePerm: 350, powerScore: 3 },
  { slug: "boneco-coelhinha", name: "Orelhas de coelhinha", category: "DOLL", rarity: "RARE", config: { accessory: "bunny" }, price30: 90, pricePerm: 450, powerScore: 5 },
  { slug: "boneco-mascara", name: "Máscara de baile", category: "DOLL", rarity: "RARE", config: { accessory: "mask" }, price30: 90, pricePerm: 450, powerScore: 5 },
  { slug: "boneco-chicote", name: "Chicote", category: "DOLL", rarity: "EPIC", config: { accessory: "whip" }, price30: 110, pricePerm: 550, powerScore: 6 },
  { slug: "boneco-champanhe", name: "Taça de champanhe", category: "DOLL", config: { accessory: "champagne" }, price30: 60, pricePerm: 300, powerScore: 3 },
  { slug: "glow-vinho", name: "Glow Vinho", category: "GLOW", config: { colors: ["#a01c43"], animation: "none" }, price7: 40, price30: 120, pricePerm: 600, powerScore: 5 },
  { slug: "glow-ouro", name: "Glow Dourado", category: "GLOW", rarity: "RARE", config: { colors: ["#d4af37", "#f1d77a"], animation: "pulse" }, price7: 80, price30: 220, pricePerm: 1100, powerScore: 10 },
  { slug: "glow-arco-iris", name: "Glow Arco-íris", category: "GLOW", rarity: "EPIC", config: { colors: ["#ff3b6b", "#ffd23b", "#3bffb4"], animation: "rainbow" }, price7: 120, price30: 350, pricePerm: 1800, powerScore: 15 },
  { slug: "glow-neon-rosa", name: "Glow Neon Rosa", category: "GLOW", rarity: "RARE", config: { colors: ["#ff2fa3", "#ff7ad0"], animation: "flicker" }, price7: 90, price30: 250, powerScore: 10 },
  { slug: "nick-ouro", name: "Nick Dourado", category: "NICK_COLOR", config: { colors: ["#d4af37"] }, price30: 100, pricePerm: 500, powerScore: 5 },
  { slug: "nick-degrade-fogo", name: "Nick Degradê Fogo", category: "NICK_COLOR", rarity: "EPIC", config: { colors: ["#ff512f", "#f09819", "#ff2f6d"] }, price30: 200, pricePerm: 1000, powerScore: 12 },
  { slug: "nick-rosa", name: "Nick Rosa Choque", category: "NICK_COLOR", config: { colors: ["#ff4fa0"] }, price30: 80, pricePerm: 400, powerScore: 3 },
  { slug: "texto-champagne", name: "Texto Champagne", category: "TEXT_COLOR", config: { color: "#f1d77a" }, price30: 60, pricePerm: 300, powerScore: 2 },
  // cores de texto pensadas para o fundo claro
  { slug: "texto-vinho", name: "Texto Vinho", category: "TEXT_COLOR", config: { color: "#9d174d" }, price30: 60, pricePerm: 300, powerScore: 2 },
  { slug: "texto-rosa-choque", name: "Texto Rosa Choque", category: "TEXT_COLOR", config: { color: "#db2777" }, price30: 60, pricePerm: 300, powerScore: 2 },
  { slug: "texto-roxo", name: "Texto Roxo Sensual", category: "TEXT_COLOR", config: { color: "#6d28d9" }, price30: 60, pricePerm: 300, powerScore: 2 },
  { slug: "texto-azul-noite", name: "Texto Azul Noite", category: "TEXT_COLOR", config: { color: "#1e3a8a" }, price30: 60, pricePerm: 300, powerScore: 2 },
  { slug: "texto-esmeralda", name: "Texto Esmeralda", category: "TEXT_COLOR", config: { color: "#047857" }, price30: 60, pricePerm: 300, powerScore: 2 },
  { slug: "texto-ouro-velho", name: "Texto Ouro Velho", category: "TEXT_COLOR", rarity: "RARE", config: { color: "#8a6100" }, price30: 80, pricePerm: 400, powerScore: 3 },
  { slug: "badge-coroa", name: "Coroa", category: "BADGE", rarity: "LEGENDARY", config: { emoji: "👑" }, price30: 300, pricePerm: 2500, powerScore: 25 },
  { slug: "badge-chama", name: "Chama", category: "BADGE", config: { emoji: "🔥" }, price30: 50, pricePerm: 300, powerScore: 3 },
  { slug: "badge-diamante", name: "Diamante", category: "BADGE", rarity: "EPIC", config: { emoji: "💎" }, price30: 150, pricePerm: 900, powerScore: 12 },
  { slug: "badge-algema", name: "Algema", category: "BADGE", rarity: "RARE", config: { emoji: "⛓️" }, price30: 90, pricePerm: 500, powerScore: 6 },
  { slug: "badge-mascara", name: "Máscara", category: "BADGE", rarity: "RARE", config: { emoji: "🎭" }, price30: 90, pricePerm: 500, powerScore: 6 },
  // Coleção Tchê (homenagem aos gaúchos)
  { slug: "boneco-chapeu-gaucho", name: "Chapéu gaúcho", category: "DOLL", rarity: "RARE", description: "Coleção Tchê: chapéu de aba larga com barbicacho. Bah!", config: { accessory: "gaucho" }, price30: 90, pricePerm: 450, powerScore: 5 },
  { slug: "boneco-chimarrao", name: "Cuia de chimarrão", category: "DOLL", rarity: "RARE", description: "Coleção Tchê: a cuia com bomba na mão, pra roda de mate no chat.", config: { accessory: "chimarrao" }, price30: 90, pricePerm: 450, powerScore: 5 },
  { slug: "badge-chimarrao", name: "Tchê! (chimarrão)", category: "BADGE", description: "Coleção Tchê: o mate ao lado do nick.", config: { emoji: "🧉" }, price30: 50, pricePerm: 300, powerScore: 3 },
  { slug: "nick-farroupilha", name: "Nick Farroupilha", category: "NICK_COLOR", rarity: "EPIC", description: "Coleção Tchê: degradê nas cores da bandeira gaúcha.", config: { colors: ["#15803d", "#dc2626", "#ca8a04"] }, price30: 200, pricePerm: 1000, powerScore: 10 },
  { slug: "moldura-farroupilha", name: "Moldura Farroupilha", category: "AVATAR_FRAME", rarity: "EPIC", description: "Coleção Tchê: verde, vermelho e amarelo em volta da foto.", config: { colors: ["#15803d", "#dc2626", "#eab308"], animation: "pulse" }, price30: 150, pricePerm: 800, powerScore: 8 },
  { slug: "texto-verde-pampa", name: "Texto Verde Pampa", category: "TEXT_COLOR", description: "Coleção Tchê: o verde dos campos do pampa.", config: { color: "#166534" }, price30: 60, pricePerm: 300, powerScore: 2 },
  { slug: "badge-pimenta", name: "Pimenta", category: "BADGE", config: { emoji: "🌶️" }, price30: 40, pricePerm: 250, powerScore: 2 },
  { slug: "moldura-ouro", name: "Moldura Dourada", category: "AVATAR_FRAME", rarity: "RARE", config: { colors: ["#d4af37", "#f1d77a"], animation: "pulse" }, price30: 150, pricePerm: 800, powerScore: 8 },
  { slug: "moldura-vinho", name: "Moldura Vinho", category: "AVATAR_FRAME", config: { colors: ["#a01c43", "#ff2f6d"], animation: "none" }, price30: 90, pricePerm: 500, powerScore: 4 },
  { slug: "entrada-fogo", name: "Entrada em Chamas", category: "ENTRY_EFFECT", rarity: "EPIC", config: { effect: "fire" }, price30: 250, pricePerm: 1200, powerScore: 10 },
  { slug: "entrada-realeza", name: "Entrada Real", category: "ENTRY_EFFECT", rarity: "LEGENDARY", config: { effect: "gold" }, price30: 400, pricePerm: 2000, powerScore: 20 },
  { slug: "poder-invisivel", name: "Invisível", category: "POWER", rarity: "EPIC", description: "Some da lista de online das salas.", config: { power: "INVISIBLE" }, price7: 100, price30: 300, powerScore: 0 },
  { slug: "poder-nick-grande", name: "Nick Maior", category: "POWER", rarity: "RARE", config: { power: "BIG_NICK" }, price7: 60, price30: 180, powerScore: 10 },
  { slug: "poder-destaque", name: "Destaque na Lista", category: "POWER", rarity: "RARE", description: "Fundo dourado na lista de online.", config: { power: "HIGHLIGHT_ONLINE" }, price7: 80, price30: 220, powerScore: 30 },
  { slug: "poder-fixar", name: "Fixar Mensagem", category: "POWER", rarity: "EPIC", description: "Fixe uma mensagem sua no topo da sala por 10 minutos (1 a cada 15 min, se não houver outra fixada).", config: { power: "PIN_MESSAGE" }, price7: 120, price30: 350, powerScore: 15 },
  { slug: "poder-pv-prioritario", name: "PV Prioritário", category: "POWER", rarity: "EPIC", description: "Suas mensagens aparecem no topo da caixa de quem recebe.", config: { power: "PRIORITY_PM" }, price7: 90, price30: 260, powerScore: 5 },
];

const PACKAGES = [
  { name: "Pitada", coins: 100, bonusCoins: 0, priceCents: 990, sortOrder: 1 },
  { name: "Tempero", coins: 300, bonusCoins: 30, priceCents: 2490, sortOrder: 2 },
  { name: "Ardente", coins: 700, bonusCoins: 120, priceCents: 4990, sortOrder: 3 },
  { name: "Vulcão", coins: 1600, bonusCoins: 400, priceCents: 9990, sortOrder: 4 },
];

/**
 * Migração única (instalações antigas): salas oficiais passam a ser Geral + uma por estado.
 * - "lobby" vira "geral" (mantém mensagens e membros)
 * - oficiais antigas sem dono e fora do novo formato (casais, iniciantes, sul, nordeste) saem
 * - estados que faltam são criados
 * Marca "rooms-v2" para não repetir: depois disso o admin manda nas salas pelo painel.
 */
async function migrateRoomsV2() {
  if (await db.platformSetting.findUnique({ where: { key: "rooms-v2" } })) return;
  const lobby = await db.room.findUnique({ where: { slug: "lobby" } });
  if (lobby && !(await db.room.findUnique({ where: { slug: GENERAL_ROOM.slug } })))
    await db.room.update({ where: { id: lobby.id }, data: { ...GENERAL_ROOM, isOfficial: true } });
  const stateSlugs = new Set(UFS.map((u) => u.toLowerCase()));
  // sala só para casais: aproveita a "casais" antiga (mantém mensagens) e trava o acesso
  const casais = await db.room.findUnique({ where: { slug: COUPLES_ROOM.slug } });
  if (!casais) await db.room.create({ data: { ...COUPLES_ROOM, isOfficial: true, theme: "vinho" } });
  else if (casais.isOfficial && !casais.ownerId) await db.room.update({ where: { id: casais.id }, data: { name: COUPLES_ROOM.name, description: COUPLES_ROOM.description, access: COUPLES_ROOM.access } });
  const legacy = await db.room.findMany({ where: { isOfficial: true, ownerId: null, slug: { in: ["iniciantes", "sul", "nordeste", "sudeste", "norte", "centro-oeste"] } } });
  const removed: string[] = [];
  for (const r of legacy) {
    // só apaga se estiver vazia: sala com conversa fica (o admin decide pelo painel)
    if ((await db.message.count({ where: { roomId: r.id } })) > 0) continue;
    await db.room.delete({ where: { id: r.id } });
    removed.push(r.slug);
  }
  for (const uf of UFS) {
    const data = stateRoom(uf);
    const cur = await db.room.findUnique({ where: { slug: data.slug } });
    if (!cur) await db.room.create({ data: { ...data, isOfficial: true, theme: "noir" } });
    else if (cur.isOfficial && !cur.ownerId) await db.room.update({ where: { id: cur.id }, data: { name: data.name, state: data.state, description: data.description } });
  }
  await db.platformSetting.upsert({ where: { key: "rooms-v2" }, create: { key: "rooms-v2", value: { at: new Date().toISOString(), removed } }, update: {} });
  console.log(`Salas: Geral + Só Casais + ${stateSlugs.size} estados (removidas: ${removed.join(", ") || "nenhuma"})`);
}

async function main() {
  // Só na primeira instalação: depois disso o admin controla salas e itens pelo painel
  // (o seed roda a cada deploy e NÃO pode recriar o que foi apagado/editado).
  const firstRun = (await db.platformSetting.findUnique({ where: { key: "seeded" } })) === null;
  if (firstRun && (await db.room.count()) === 0) {
    await db.room.create({ data: { ...GENERAL_ROOM, isOfficial: true, theme: "vinho" } });
    await db.room.create({ data: { ...COUPLES_ROOM, isOfficial: true, theme: "vinho" } });
    for (const uf of UFS) await db.room.create({ data: { ...stateRoom(uf), isOfficial: true, theme: "noir" } });
    await db.platformSetting.upsert({ where: { key: "rooms-v2" }, create: { key: "rooms-v2", value: { at: new Date().toISOString() } }, update: {} });
  }
  await migrateRoomsV2();
  // descrições regionais (ex.: RS "Bah, tchê!"): só troca se ainda estiver com o texto padrão (não sobrescreve edição do admin)
  for (const uf of UFS) {
    const want = stateRoom(uf).description;
    if (want !== defaultStateDescription(uf)) await db.room.updateMany({ where: { slug: uf.toLowerCase(), description: defaultStateDescription(uf) }, data: { description: want } });
  }
  // grupos iniciais: criados uma vez (depois a equipe cria/arquiva pelo painel)
  if (!(await db.platformSetting.findUnique({ where: { key: "groups-v1" } }))) {
    for (const g of DEFAULT_GROUPS) await db.group.upsert({ where: { slug: g.slug }, create: { ...g }, update: {} });
    await db.platformSetting.create({ data: { key: "groups-v1", value: { at: new Date().toISOString() } } });
    console.log(`Grupos iniciais: ${DEFAULT_GROUPS.length}`);
  }
  // proximidade: preenche coordenadas pela cidade de quem ainda não tem (idempotente, barato)
  const semCoord = await db.user.findMany({ where: { lat: null, geoSource: null, city: { not: null } }, select: { id: true, city: true, state: true }, take: 5000 });
  let geo = 0;
  for (const u of semCoord) {
    const c = cityCoords(u.city, u.state);
    if (c) { await db.user.update({ where: { id: u.id }, data: { lat: c.lat, lng: c.lng, geoSource: "CITY" } }); geo++; }
  }
  if (geo) console.log(`Proximidade: ${geo} perfis com coordenadas da cidade`);
  // Geral e Só Casais não têm cargos de sala (a equipe do site modera)
  await db.roomMember.updateMany({ where: { role: { in: ["OWNER", "MODERATOR"] }, room: { slug: { in: [...STAFF_ONLY_ROOMS] } } }, data: { role: "MEMBER" } });
  // Itens novos do catálogo entram a cada deploy; os existentes NÃO são alterados
  // (preço/ativação editados pelo admin são preservados).
  for (const it of ITEMS) {
    const { slug, ...data } = it;
    await db.item.upsert({ where: { slug }, create: { slug, ...data }, update: {} });
  }
  if ((await db.coinPackage.count()) === 0) await db.coinPackage.createMany({ data: PACKAGES });
  if ((await db.vipPlan.count()) === 0)
    await db.vipPlan.createMany({
      data: [
        { name: "Mensal", days: 30, priceCents: 2990, bonusCoins: 100, sortOrder: 1 },
        { name: "Trimestral", days: 90, priceCents: 7490, bonusCoins: 400, sortOrder: 2 },
        { name: "Anual", days: 365, priceCents: 23990, bonusCoins: 2000, sortOrder: 3 },
      ],
    });
  for (const kind of ["SYSTEM_MINT", "SYSTEM_SINK"] as const) {
    if (!(await db.wallet.findFirst({ where: { kind } }))) await db.wallet.create({ data: { kind } });
  }
  await db.platformSetting.upsert({ where: { key: "seeded" }, create: { key: "seeded", value: { at: new Date().toISOString() } }, update: {} });
  console.log(firstRun ? "Seed base ok (primeira instalação)" : "Seed: itens novos do catálogo conferidos (já instalado)");
  if (process.env.SEED_DEMO === "1") await demo();
}

/** Imagem abstrata (gradiente) para posts de demonstração. Sem pessoas reais. */
async function fakePhoto(seed: number) {
  const hues = [[122, 19, 48], [212, 175, 55], [60, 10, 40], [160, 28, 67], [30, 20, 60]];
  const [a, b] = [hues[seed % 5], hues[(seed + 2) % 5]];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><defs><radialGradient id="g" cx="${30 + (seed * 17) % 40}%" cy="40%" r="80%"><stop offset="0" stop-color="rgb(${a})"/><stop offset="1" stop-color="rgb(${b})"/></radialGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="${200 + seed * 50}" cy="${400 + seed * 30}" r="${180 + seed * 10}" fill="#fff" fill-opacity="0.08"/><text x="400" y="520" font-size="90" text-anchor="middle" fill="#fff" fill-opacity="0.25" font-family="DejaVu Serif">${["🍷", "🌙", "🔥", "✨", "🥂"][seed % 5]}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

async function storeDemo(ownerId: string, nick: string, seed: number, kind: "POST" | "AVATAR") {
  const input = await fakePhoto(seed);
  const root = path.resolve(process.env.UPLOAD_DIR || "./storage");
  const dir = `demo/${randomBytes(8).toString("hex")}`;
  await mkdir(path.join(root, dir), { recursive: true });
  const size = kind === "AVATAR" ? 400 : 1280;
  const o = await sharp(input).resize(size, size, { fit: "inside" }).webp().toBuffer({ resolveWithObject: true });
  const wm = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${o.info.width}" height="${o.info.height}"><rect y="${o.info.height - 40}" width="100%" height="40" fill="#000" fill-opacity=".35"/><text x="${o.info.width - 12}" y="${o.info.height - 13}" text-anchor="end" font-size="20" font-family="DejaVu Sans" fill="#d4af37">@${nick} · Demo</text></svg>`);
  const d = kind === "AVATAR" ? o.data : await sharp(o.data).composite([{ input: wm }]).webp().toBuffer();
  const b = await sharp(o.data).resize(48).blur(4).resize(480).webp().toBuffer();
  await writeFile(path.join(root, dir, "o.webp"), o.data);
  await writeFile(path.join(root, dir, "d.webp"), d);
  await writeFile(path.join(root, dir, "b.webp"), b);
  return db.media.create({ data: { ownerId, kind, originalKey: `${dir}/o.webp`, displayKey: `${dir}/d.webp`, blurKey: `${dir}/b.webp`, width: o.info.width, height: o.info.height, sha256: createHash("sha256").update(input).digest("hex") } });
}

async function demo() {
  const pw = await hash("demo12345");
  const people = [
    { nick: "CasalSafado_SP", type: "COUPLE_MF", city: "São Paulo", state: "SP", bio: "Casal 30/28, liberais há 3 anos. Curtimos soft e boas conversas. 🍷", items: ["glow-ouro", "badge-coroa", "moldura-ouro", "poder-destaque"] },
    { nick: "Morena_RJ", type: "SINGLE_WOMAN", city: "Niterói", state: "RJ", bio: "Solteira, curiosa, só casais educados.", items: ["nick-degrade-fogo", "badge-pimenta"] },
    { nick: "LiberaisBH", type: "COUPLE_MF", city: "Belo Horizonte", state: "MG", bio: "Casal liberal de BH procurando amizade no meio.", items: ["glow-arco-iris", "badge-diamante"] },
    { nick: "Lobo_Curitiba", type: "SINGLE_MAN", city: "Curitiba", state: "PR", bio: "Solteiro, discreto, respeitoso.", items: [] },
    { nick: "Duas_Deusas", type: "COUPLE_FF", city: "Florianópolis", state: "SC", bio: "Casal de mulheres, festas liberais e viagens.", items: ["nick-rosa", "badge-mascara", "glow-neon-rosa"] },
  ] as const;
  const users = [];
  for (const [i, p] of people.entries()) {
    const birth = new Date(Date.UTC(1990 + i, i, 10 + i));
    const u = await db.user.upsert({
      where: { email: `${p.nick.toLowerCase()}@demo.local` },
      update: {},
      create: {
        email: `${p.nick.toLowerCase()}@demo.local`, passwordHash: pw, nick: p.nick, birthDate: birth, profileType: p.type, city: p.city, state: p.state, bio: p.bio,
        ageVerification: "APPROVED", ageVerifiedAt: new Date(), acceptPmPhotos: true, lastSeenAt: new Date(), likes: ["Soft swing", "Troca de casais", "Casa de swing"].slice(0, 1 + (i % 3)),
        persons: { create: (p.type.startsWith("COUPLE") ? ["Ele", "Ela"] : ["Pessoa"]).map((label, j) => ({ label, birthDate: new Date(Date.UTC(1990 + i + j, 3, 5)) })) },
        wallet: { create: { kind: "USER" } },
      },
    });
    users.push(u);
    if (!u.avatarId) {
      const av = await storeDemo(u.id, u.nick, i + 3, "AVATAR");
      await db.user.update({ where: { id: u.id }, data: { avatarId: av.id } });
    }
    for (const slug of p.items) {
      const item = await db.item.findUnique({ where: { slug } });
      if (item && !(await db.inventoryItem.findFirst({ where: { userId: u.id, itemId: item.id } })))
        await db.inventoryItem.create({ data: { userId: u.id, itemId: item.id, active: true, expiresAt: new Date(Date.now() + 30 * 86400_000) } });
    }
  }
  if ((await db.post.count()) === 0) {
    const texts = [
      "Sábado foi incrível na casa de swing! Quem mais estava lá? 🔥",
      "Primeira vez postando por aqui… sejam gentis 😇",
      "Procurando casal em BH para um vinho e boa conversa 🍷",
      "Clima de sexta! Quem vai sair hoje?",
      "Viagem para Floripa confirmada ✈️ Alguém indica festa liberal?",
    ];
    for (const [i, u] of users.entries()) {
      const media = i % 2 === 0 ? [await storeDemo(u.id, u.nick, i, "POST")] : [];
      await db.post.create({ data: { authorId: u.id, body: texts[i], createdAt: new Date(Date.now() - (i + 1) * 3600_000), media: { create: media.map((m, j) => ({ mediaId: m.id, position: j })) } } });
    }
    const posts = await db.post.findMany();
    for (const p of posts) for (const [j, u] of users.entries()) if (u.id !== p.authorId && j % 2 === 0) await db.postReaction.create({ data: { postId: p.id, userId: u.id, emoji: ["🔥", "😈", "❤️"][j % 3] } });
    await db.postComment.create({ data: { postId: posts[0].id, authorId: users[1].id, body: "Que delícia! Da próxima me chamem 😏" } });
  }
  const lobby = await db.room.findUniqueOrThrow({ where: { slug: GENERAL_ROOM.slug } });
  if ((await db.message.count({ where: { roomId: lobby.id } })) === 0) {
    const chat = [
      [0, "Boa noite, galera! 🥂"],
      [1, "Oi casal! Tudo bem com vocês?"],
      [2, "Chegamos! Alguém de BH por aqui? 🔥"],
      [4, "@Morena_RJ quanto tempo! 💋"],
      [3, "Boa noite a todos, primeira vez na sala"],
      [0, "@Lobo_Curitiba seja bem-vindo! Leia as regras e fique à vontade 😉"],
    ] as const;
    for (const [i, body] of chat) await db.message.create({ data: { roomId: lobby.id, authorId: users[i].id, body } });
    await db.roomMember.upsert({ where: { roomId_userId: { roomId: lobby.id, userId: users[0].id } }, create: { roomId: lobby.id, userId: users[0].id, role: "MODERATOR" }, update: {} });
  }
  for (const u of users) await db.roomPresence.upsert({ where: { roomId_userId: { roomId: lobby.id, userId: u.id } }, create: { roomId: lobby.id, userId: u.id, lastSeenAt: new Date(Date.now() + 3600_000) }, update: { lastSeenAt: new Date(Date.now() + 3600_000) } });
  console.log("Seed demo ok (senha dos usuários demo: demo12345)");
}

main().finally(() => db.$disconnect());
