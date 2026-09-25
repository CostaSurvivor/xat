"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { limiter } from "@/lib/ratelimit";
import { cityCoords } from "@/lib/geo";
import { TRIPS, dateOnly, parseTrip, todayBR } from "@/lib/trips";
import { requireUser } from "@/server/auth";
import { resolveCity } from "@/server/trips";

export type TripState = { ok?: boolean; error?: string; n?: number; values?: Record<string, string> } | undefined;

export async function addTrip(prev: TripState, fd: FormData): Promise<TripState> {
  const user = await requireUser();
  const v = (k: string) => String(fd.get(k) ?? "");
  const values = { city: v("city"), state: v("state"), from: v("from"), to: v("to"), note: v("note") };
  const n = (prev?.n ?? 0) + 1;
  const today = todayBR();
  const t = parseTrip(values, today, resolveCity);
  if ("error" in t) return { ok: false, error: t.error, n, values };
  if (!limiter("trip-add", 10, 10 / 86400).take(user.id)) return { ok: false, error: "Muitas viagens cadastradas hoje. Tente amanhã.", n, values };
  const active = await db.trip.count({ where: { userId: user.id, endsOn: { gte: dateOnly(today) } } });
  if (active >= TRIPS.maxActive) return { ok: false, error: `Você já tem ${TRIPS.maxActive} viagens marcadas. Apague uma para anunciar outra.`, n, values };
  const c = cityCoords(t.city, t.state);
  await db.trip.create({ data: { userId: user.id, city: t.city, state: t.state, lat: c?.lat, lng: c?.lng, startsOn: dateOnly(t.from), endsOn: dateOnly(t.to), note: t.note } });
  revalidatePath("/viagens");
  return { ok: true, n };
}

export async function deleteTrip(id: string) {
  const user = await requireUser();
  await db.trip.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/viagens");
}
