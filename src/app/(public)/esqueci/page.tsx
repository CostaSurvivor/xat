import { ForgotForm } from "@/components/ResetForms";

export const metadata = { title: "Esqueci minha senha" };

export default function Esqueci() {
  return (
    <div className="card mx-auto mt-10 max-w-sm space-y-4 p-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Esqueci minha senha</h1>
      <p className="text-sm text-mute">Informe o e-mail da conta. Vamos enviar um link para criar uma nova senha.</p>
      <ForgotForm />
    </div>
  );
}
