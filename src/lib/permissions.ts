/** Matriz de permissões de sala. Pura e testada (tests/permissions.test.ts). */
export type RoomRoleName = "OWNER" | "MODERATOR" | "MEMBER" | "GUEST";
export type PlatformRoleName = "USER" | "MODERATOR" | "ADMIN";

export type Actor = { role: RoomRoleName; platformRole: PlatformRoleName };

export type RoomAction =
  | "send"
  | "delete_message"
  | "mute"
  | "kick"
  | "ban"
  | "clear"
  | "pin"
  | "set_slowmode"
  | "edit_room"
  | "promote_moderator"
  | "demote_moderator"
  | "manage_words"
  | "delete_room";

const RANK: Record<RoomRoleName, number> = { GUEST: 0, MEMBER: 1, MODERATOR: 2, OWNER: 3 };

const MIN_ROLE: Record<RoomAction, RoomRoleName> = {
  send: "GUEST",
  delete_message: "MODERATOR",
  mute: "MODERATOR",
  kick: "MODERATOR",
  ban: "MODERATOR",
  clear: "MODERATOR",
  pin: "MODERATOR",
  set_slowmode: "MODERATOR",
  manage_words: "MODERATOR",
  edit_room: "OWNER",
  promote_moderator: "OWNER",
  demote_moderator: "OWNER",
  delete_room: "OWNER",
};

const TARGETED: RoomAction[] = ["mute", "kick", "ban", "promote_moderator", "demote_moderator"];

export function isPlatformStaff(a: Actor) {
  return a.platformRole === "ADMIN" || a.platformRole === "MODERATOR";
}

/**
 * Pode `actor` executar `action` (opcionalmente contra `target`)?
 * Regra: ninguém age contra alguém de cargo igual ou superior; staff da
 * plataforma pode tudo, exceto agir contra admin (só admin age contra admin).
 */
export function can(actor: Actor, action: RoomAction, target?: Actor): boolean {
  if (target && TARGETED.includes(action)) {
    if (target.platformRole === "ADMIN" && actor.platformRole !== "ADMIN") return false;
    if (target.role === "OWNER" && action !== "promote_moderator") {
      if (!isPlatformStaff(actor)) return false;
    }
  }
  if (isPlatformStaff(actor)) return true;
  if (RANK[actor.role] < RANK[MIN_ROLE[action]]) return false;
  if (target && TARGETED.includes(action)) {
    if (action === "promote_moderator") return actor.role === "OWNER" && target.role === "MEMBER";
    if (action === "demote_moderator") return actor.role === "OWNER" && target.role === "MODERATOR";
    return RANK[actor.role] > RANK[target.role];
  }
  return true;
}

/** Ordenação da lista de online: cargo, depois "poder" dos itens. */
export function onlineSortKey(role: RoomRoleName, power: number) {
  return RANK[role] * 1_000_000 + Math.min(power, 999_999);
}
