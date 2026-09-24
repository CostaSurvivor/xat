import Link from "next/link";
import { isVerified, requireUser } from "@/server/auth";
import { StoryComposer } from "@/components/StoryComposer";

export const metadata = { title: "Novo story" };

export default async function NovoStory() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link href="/feed" className="text-sm text-mute hover:text-fg">← Feed</Link>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">⏳ Novo story</h1>
      {isVerified(user) ? (
        <StoryComposer nick={user.nick} />
      ) : (
        <p className="card p-6 text-center text-sm">Verifique seu perfil para postar stories. <Link href="/verificacao" className="text-gold underline">Verificar agora</Link></p>
      )}
    </div>
  );
}
