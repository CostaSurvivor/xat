import { ActionForm } from "@/components/Forms";
import { changePassword } from "@/app/actions/account";

/** Trocar senha; contas criadas pelo Google (sem senha) definem a primeira sem pedir a atual. */
export function PasswordForm({ hasPassword, compact = false }: { hasPassword: boolean; compact?: boolean }) {
  return (
    <ActionForm action={changePassword} className={compact ? "grid gap-2 sm:grid-cols-3" : "space-y-2"} okText="Senha salva! Outras sessões foram encerradas." resetOnOk>
      {hasPassword ? (
        <input name="current" type="password" required placeholder="Senha atual" className="input" autoComplete="current-password" />
      ) : (
        <p className={`text-xs text-mute ${compact ? "sm:col-span-3" : ""}`}>Você entra pelo Google. Defina uma senha para também entrar com e-mail e para confirmar trocas.</p>
      )}
      <input name="next" type="password" required minLength={8} placeholder="Nova senha (8+ caracteres)" className="input" autoComplete="new-password" />
      <input name="confirm" type="password" required minLength={8} placeholder="Repita a nova senha" className="input" autoComplete="new-password" />
      <button className={`btn-gold ${compact ? "sm:col-span-3 sm:justify-self-start" : ""}`}>{hasPassword ? "Salvar nova senha" : "Definir senha"}</button>
    </ActionForm>
  );
}
