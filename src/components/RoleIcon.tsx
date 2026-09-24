/** Bonequinho colorido por cargo (estilo xat). */
export type ChatRole = "FOUNDER" | "ADMIN" | "STAFF" | "OWNER" | "MODERATOR" | "MEMBER" | "GUEST";

export const CHAT_ROLES: Record<ChatRole, { label: string; color: string; mark?: "crown" | "shield" | "star" }> = {
  FOUNDER: { label: "Fundador", color: "#f1d77a", mark: "crown" },
  ADMIN: { label: "Admin", color: "#ff4d4d", mark: "crown" },
  STAFF: { label: "Moderação", color: "#3ba7ff", mark: "shield" },
  OWNER: { label: "Dono da sala", color: "#ff9f1a", mark: "star" },
  MODERATOR: { label: "Moderador", color: "#2fd07a" },
  MEMBER: { label: "Membro", color: "#b07cff" },
  GUEST: { label: "Convidado", color: "#d9d4d6" },
};

export function chatRole(platformRole: string | undefined, roomRole: string | undefined, founder = false): ChatRole {
  if (founder) return "FOUNDER";
  if (platformRole === "ADMIN") return "ADMIN";
  if (platformRole === "MODERATOR") return "STAFF";
  return (roomRole as ChatRole) || "GUEST";
}

export const CHAT_ROLE_RANK: Record<ChatRole, number> = { FOUNDER: 6, ADMIN: 5, STAFF: 4, OWNER: 3, MODERATOR: 2, MEMBER: 1, GUEST: 0 };

export function RoleIcon({ role, size = 16 }: { role: ChatRole; size?: number }) {
  const r = CHAT_ROLES[role];
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-label={r.label} role="img" className="shrink-0">
      <title>{r.label}</title>
      <circle cx="10" cy="6" r="3.6" fill={r.color} stroke="#000" strokeOpacity=".35" strokeWidth=".8" />
      <path d="M3.2 18.5c0-4.1 3-6.9 6.8-6.9s6.8 2.8 6.8 6.9z" fill={r.color} stroke="#000" strokeOpacity=".35" strokeWidth=".8" />
      {role === "FOUNDER" && <circle cx="10" cy="11" r="9.5" fill="none" stroke="#d4af37" strokeOpacity=".6" strokeWidth=".8" />}
      {r.mark === "crown" && <path d="M6.5 2.6 7.6 0.6 10 2.2 12.4 0.6 13.5 2.6z" fill="#f1d77a" stroke="#7a5a10" strokeWidth=".4" />}
      {r.mark === "star" && <path d="M16 9.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L13.1 11.3l2-.3z" fill="#f1d77a" stroke="#7a5a10" strokeWidth=".4" />}
      {r.mark === "shield" && <path d="M16 9l2.6 1v2.1c0 1.6-1.1 2.8-2.6 3.3-1.5-.5-2.6-1.7-2.6-3.3V10z" fill="#ffffff" stroke="#1d5f99" strokeWidth=".6" />}
    </svg>
  );
}
