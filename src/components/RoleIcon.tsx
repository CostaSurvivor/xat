/** Bonequinho colorido por cargo (estilo xat). */
export type ChatRole = "FOUNDER" | "ADMIN" | "STAFF" | "OWNER" | "MODERATOR" | "MEMBER" | "GUEST";

export const CHAT_ROLES: Record<ChatRole, { label: string; color: string; mark?: "crown" | "shield" | "star" }> = {
  // cores no padrão do xat: convidado verde, membro azul, moderador branco, dono laranja
  FOUNDER: { label: "Fundador", color: "#f1d77a", mark: "crown" },
  ADMIN: { label: "Admin", color: "#ff4d4d", mark: "crown" },
  STAFF: { label: "Moderação SexPapo", color: "#b07cff", mark: "shield" },
  OWNER: { label: "Dono da sala", color: "#ff9f1a", mark: "star" },
  MODERATOR: { label: "Moderador", color: "#f4f4f4" },
  MEMBER: { label: "Membro", color: "#3b8cff" },
  GUEST: { label: "Convidado", color: "#35d06a" },
};

export function chatRole(platformRole: string | undefined, roomRole: string | undefined, founder = false): ChatRole {
  if (founder) return "FOUNDER";
  if (platformRole === "ADMIN") return "ADMIN";
  if (platformRole === "MODERATOR") return "STAFF";
  return (roomRole as ChatRole) || "GUEST";
}

export const CHAT_ROLE_RANK: Record<ChatRole, number> = { FOUNDER: 6, ADMIN: 5, STAFF: 4, OWNER: 3, MODERATOR: 2, MEMBER: 1, GUEST: 0 };

/** Acessórios do boneco (itens da loja, categoria DOLL). Desenhados em SVG fixo: nada vem do usuário. */
export const DOLL_ACCESSORIES = {
  cowboy: "Chapéu de cowboy",
  horns: "Chifre de boi (Cuckold)",
  cuckqueen: "Tiara com chifrinhos (Cuckqueen)",
  wand: "Varinha mágica",
  tophat: "Cartola",
  halo: "Auréola de anjo",
  devil: "Chifres de diabinha",
  bunny: "Orelhas de coelhinha",
  mask: "Máscara de baile",
  whip: "Chicote",
  champagne: "Taça de champanhe",
  gaucho: "Chapéu gaúcho",
  chimarrao: "Cuia de chimarrão",
} as const;
export type DollAccessory = keyof typeof DOLL_ACCESSORIES;

function Accessory({ kind }: { kind: string }) {
  switch (kind) {
    case "cowboy":
      return (
        <g>
          <ellipse cx="10" cy="3.2" rx="7.2" ry="1.3" fill="#8b5a2b" stroke="#3b2410" strokeWidth=".4" />
          <path d="M6.6 3 C6.8 0.4 8.2 -0.6 10 0.6 C11.8 -0.6 13.2 0.4 13.4 3 Z" fill="#a0692f" stroke="#3b2410" strokeWidth=".4" />
          <path d="M6.9 2.4 H13.1" stroke="#d4af37" strokeWidth=".6" />
        </g>
      );
    case "horns":
      return (
        <g fill="#efe4c8" stroke="#6b5a3a" strokeWidth=".4">
          <path d="M7.2 3.8 C4.6 3.6 2.6 1.8 2.2 -0.8 C3.6 0.8 5.4 1.6 7.8 2.4 Z" />
          <path d="M12.8 3.8 C15.4 3.6 17.4 1.8 17.8 -0.8 C16.4 0.8 14.6 1.6 12.2 2.4 Z" />
        </g>
      );
    case "cuckqueen":
      return (
        <g>
          <path d="M7.3 3 L7.9 1.1 L9 2.3 L10 0.6 L11 2.3 L12.1 1.1 L12.7 3 Z" fill="#ffb3d1" stroke="#b0336b" strokeWidth=".4" />
          <path d="M6.8 3.6 C5.6 2.6 5.2 1.2 5.6 0 C6.2 1.2 7 1.9 7.8 2.4 Z M13.2 3.6 C14.4 2.6 14.8 1.2 14.4 0 C13.8 1.2 13 1.9 12.2 2.4 Z" fill="#ff5c8a" stroke="#8a1840" strokeWidth=".35" />
        </g>
      );
    case "wand":
      return (
        <g>
          <path d="M15.2 17 L19 8.6" stroke="#e9d8b4" strokeWidth="1" strokeLinecap="round" />
          <path d="M19 5.4 l.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z" fill="#f1d77a" stroke="#a77d14" strokeWidth=".3" />
          <circle cx="17.2" cy="4.8" r=".4" fill="#fff" /><circle cx="20.8" cy="10.4" r=".35" fill="#fff" />
        </g>
      );
    case "tophat":
      return (
        <g>
          <rect x="7.2" y="-1.6" width="5.6" height="4.6" rx=".4" fill="#1a1a1a" stroke="#000" strokeWidth=".3" />
          <rect x="7.2" y="1.6" width="5.6" height=".9" fill="#a01c43" />
          <ellipse cx="10" cy="3.1" rx="4.8" ry=".9" fill="#111" />
        </g>
      );
    case "halo":
      return <ellipse cx="10" cy="0.9" rx="3.6" ry="1.1" fill="none" stroke="#f1d77a" strokeWidth=".9" />;
    case "devil":
      return (
        <g fill="#d61f3c" stroke="#6d0b1c" strokeWidth=".35">
          <path d="M7.4 3.2 C6.6 1.8 6.8 0.4 7.6 -0.6 C7.8 0.8 8.3 1.6 8.9 2.4 Z" />
          <path d="M12.6 3.2 C13.4 1.8 13.2 0.4 12.4 -0.6 C12.2 0.8 11.7 1.6 11.1 2.4 Z" />
        </g>
      );
    case "bunny":
      return (
        <g fill="#fff" stroke="#222" strokeWidth=".35">
          <ellipse cx="8.2" cy="-0.6" rx="1.1" ry="3.2" transform="rotate(-12 8.2 -0.6)" />
          <ellipse cx="11.8" cy="-0.6" rx="1.1" ry="3.2" transform="rotate(12 11.8 -0.6)" />
          <ellipse cx="8.2" cy="-0.4" rx=".5" ry="2.2" fill="#ffb3d1" stroke="none" transform="rotate(-12 8.2 -0.4)" />
          <ellipse cx="11.8" cy="-0.4" rx=".5" ry="2.2" fill="#ffb3d1" stroke="none" transform="rotate(12 11.8 -0.4)" />
        </g>
      );
    case "mask":
      return (
        <g>
          <path d="M5.8 5.4 C6.6 4.4 8.4 4.4 9.4 5.4 L10 5.9 L10.6 5.4 C11.6 4.4 13.4 4.4 14.2 5.4 C13.8 7.2 11.6 7.4 10.6 6.6 L10 6.3 L9.4 6.6 C8.4 7.4 6.2 7.2 5.8 5.4 Z" fill="#1a0a0f" stroke="#d4af37" strokeWidth=".4" />
          <path d="M14.2 5.4 L16.4 3.6" stroke="#d4af37" strokeWidth=".4" />
        </g>
      );
    case "whip":
      return <path d="M15.4 16.8 L17.6 12 C19.6 9.8 21.4 11.6 20 13.6 C19 15 21.2 16.4 22 15" fill="none" stroke="#c98a4b" strokeWidth=".8" strokeLinecap="round" />;
    case "gaucho":
      // chapéu campeiro preto de aba reta com barbicacho (cordão no queixo)
      return (
        <g>
          <ellipse cx="10" cy="3.1" rx="7.6" ry="1.1" fill="#1f1f1f" stroke="#000" strokeWidth=".3" />
          <path d="M6.9 3 L7.4 0.2 H12.6 L13.1 3 Z" fill="#2b2b2b" stroke="#000" strokeWidth=".3" />
          <path d="M7.1 2.3 H12.9" stroke="#b91c1c" strokeWidth=".5" />
          <path d="M6.4 3.4 Q10 9.4 13.6 3.4" fill="none" stroke="#7c4a1e" strokeWidth=".35" />
        </g>
      );
    case "chimarrao":
      // cuia com erva e bomba prateada, na mão
      return (
        <g>
          <path d="M16.6 10 Q16.4 13.8 18.4 14.2 Q20.4 13.8 20.2 10 Z" fill="#8b5a2b" stroke="#3b2410" strokeWidth=".3" />
          <ellipse cx="18.4" cy="10" rx="1.8" ry=".45" fill="#4d7c0f" />
          <path d="M18.9 10 L20.4 6.6" stroke="#cbd5e1" strokeWidth=".45" strokeLinecap="round" />
          <path d="M16.9 11.2 H19.9" stroke="#d4af37" strokeWidth=".3" />
        </g>
      );
    case "champagne":
      return (
        <g>
          <path d="M17 8.4 h3 l-1.5 3.2 z" fill="#f7e08a" stroke="#a77d14" strokeWidth=".3" />
          <path d="M18.5 11.6 v3.2 M17.3 14.8 h2.4" stroke="#ddd" strokeWidth=".5" />
          <circle cx="18.2" cy="9.2" r=".25" fill="#fff" /><circle cx="19" cy="9.8" r=".2" fill="#fff" />
        </g>
      );
  }
  return null;
}

/**
 * Bonequinho estilo xat: cor pelo cargo; assinante ganha brilho neon + diamante
 * (e a cor VIP quando não tem cargo na sala); acessório comprado na loja por cima.
 */
export function RoleIcon({ role, size = 16, vip = false, accessory, offline = false }: { role: ChatRole; size?: number; vip?: boolean; accessory?: string | null; offline?: boolean }) {
  const r = CHAT_ROLES[role];
  const plain = role === "GUEST" || role === "MEMBER";
  const color = offline ? "#e0403a" : vip && plain ? "#ff4fd8" : r.color;
  const label = vip ? `${r.label} · Assinante` : r.label;
  const glowId = `g-${role}-${vip ? 1 : 0}`;
  return (
    <svg width={size} height={size} viewBox="-3 -3 26 26" aria-label={label} role="img" className="shrink-0 overflow-visible">
      <title>{label}</title>
      {vip && (
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.1" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
      )}
      <g filter={vip ? `url(#${glowId})` : undefined}>
        <circle cx="10" cy="6" r="3.6" fill={color} stroke={vip ? "#fff" : "#000"} strokeOpacity={vip ? ".8" : ".35"} strokeWidth=".8" />
        <path d="M3.2 18.5c0-4.1 3-6.9 6.8-6.9s6.8 2.8 6.8 6.9z" fill={color} stroke={vip ? "#fff" : "#000"} strokeOpacity={vip ? ".8" : ".35"} strokeWidth=".8" />
      </g>
      {role === "FOUNDER" && <circle cx="10" cy="11" r="9.5" fill="none" stroke="#d4af37" strokeOpacity=".6" strokeWidth=".8" />}
      {r.mark === "crown" && !accessory && <path d="M6.5 2.6 7.6 0.6 10 2.2 12.4 0.6 13.5 2.6z" fill="#f1d77a" stroke="#7a5a10" strokeWidth=".4" />}
      {r.mark === "star" && <path d="M16 9.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L13.1 11.3l2-.3z" fill="#f1d77a" stroke="#7a5a10" strokeWidth=".4" />}
      {r.mark === "shield" && <path d="M16 9l2.6 1v2.1c0 1.6-1.1 2.8-2.6 3.3-1.5-.5-2.6-1.7-2.6-3.3V10z" fill="#ffffff" stroke="#1d5f99" strokeWidth=".6" />}
      {vip && <path d="M2.4 12.6 l1.5-1.9 1.5 1.9-1.5 2.4z" fill="#7ee8ff" stroke="#fff" strokeWidth=".35" />}
      {accessory && <Accessory kind={accessory} />}
    </svg>
  );
}
