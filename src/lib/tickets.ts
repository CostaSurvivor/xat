export const TICKET_CATEGORIES: Record<string, string> = {
  NICK_CHANGE: "Troca de nick",
  PROFILE_TYPE: "Troca de tipo de perfil",
  PAYMENT: "Pagamento / Pix",
  ACCOUNT: "Minha conta",
  VERIFICATION: "Verificação",
  REPORT: "Denúncia",
  SUGGESTION: "Sugestão",
  OTHER: "Outro",
};
export const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Aguardando equipe", cls: "bg-gold/20 text-gold2" },
  ANSWERED: { label: "Respondido", cls: "bg-green-900/50 text-green-300" },
  CLOSED: { label: "Encerrado", cls: "bg-panel2 text-mute" },
};
