import { ResetForm } from "@/components/ResetForms";

export const metadata = { title: "Nova senha" };

export default async function Redefinir({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <div className="card mx-auto mt-10 max-w-sm space-y-4 p-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Criar nova senha</h1>
      <ResetForm token={token} />
    </div>
  );
}
