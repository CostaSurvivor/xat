import "server-only";
import type { Prisma, User } from "@prisma/client";
import { db } from "@/lib/db";
import { boundingBox, citiesOf, haversineKm, normalizeCity } from "@/lib/geo";
import { TRIPS, addDays, dateOnly } from "@/lib/trips";
import { isStaff, isVerified } from "@/server/auth";
import { blockedIds } from "@/server/access";

/** Nome oficial (IBGE) da cidade digitada, ou null. */
export function resolveCity(city: string, uf: string) {
  const n = normalizeCity(city);
  if (!n) return null;
  return citiesOf(uf).find((c) => normalizeCity(c) === n) ?? null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
export const tripView = <T extends { startsOn: Date; endsOn: Date }>(t: T) => ({ ...t, from: iso(t.startsOn), to: iso(t.endsOn) });

export async function myTrips(userId: string, today: string) {
  const rows = await db.trip.findMany({ where: { userId, endsOn: { gte: dateOnly(today) } }, orderBy: { startsOn: "asc" } });
  return rows.map(tripView);
}

/** A viagem que aparece no perfil: a em andamento, senão a próxima. */
export async function profileTrip(userId: string, today: string) {
  const t = await db.trip.findFirst({ where: { userId, endsOn: { gte: dateOnly(today) } }, orderBy: { startsOn: "asc" } });
  return t ? tripView(t) : null;
}

type Viewer = Pick<User, "id" | "role" | "ageVerification" | "state" | "lat" | "lng">;

/**
 * Quem está chegando: viagens em andamento ou começando nos próximos 30 dias.
 * Com `uf`: destino nesse estado. Sem: perto de mim (100 km) ou, sem coordenadas, no meu estado.
 */
export async function visitors(viewer: Viewer, today: string, opts: { uf?: string } = {}) {
  const blocked = await blockedIds(viewer.id);
  const me = viewer.lat != null && viewer.lng != null ? { lat: viewer.lat, lng: viewer.lng } : null;
  const near = !opts.uf && me;
  const where: Prisma.TripWhereInput = {
    endsOn: { gte: dateOnly(today) },
    startsOn: { lte: dateOnly(addDays(today, TRIPS.soonDays)) },
    userId: { notIn: [...blocked, viewer.id] },
    user: { status: "ACTIVE", ...(isVerified(viewer) || isStaff(viewer) ? {} : { hideFromUnverified: false }) },
  };
  if (near) {
    const b = boundingBox(me, TRIPS.radiusKm);
    Object.assign(where, { lat: { gte: b.minLat, lte: b.maxLat }, lng: { gte: b.minLng, lte: b.maxLng } });
  } else where.state = opts.uf ?? viewer.state ?? "__";
  const rows = await db.trip.findMany({
    where,
    orderBy: { startsOn: "asc" },
    take: 200,
    include: { user: { select: { id: true, nick: true, avatarId: true, profileType: true, ageVerification: true, city: true, state: true, hideCity: true } } },
  });
  const list = near ? rows.filter((t) => t.lat != null && t.lng != null && haversineKm(me, { lat: t.lat, lng: t.lng }) <= TRIPS.radiusKm) : rows;
  // uma linha por pessoa (a viagem mais próxima)
  const seen = new Set<string>();
  return {
    mode: near ? ("near" as const) : ("state" as const),
    uf: near ? null : (opts.uf ?? viewer.state),
    items: list.filter((t) => !seen.has(t.userId) && seen.add(t.userId)).slice(0, 60).map(tripView),
  };
}
