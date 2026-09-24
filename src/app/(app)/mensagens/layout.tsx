import { requireUser } from "@/server/auth";
import { inbox } from "@/server/pm";
import { Inbox } from "@/components/Inbox";

export const dynamic = "force-dynamic";

/** PV estilo WhatsApp: conversas à esquerda, chat à direita. */
export default async function PmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const list = await inbox(user);
  return (
    <div className="-mx-1 grid h-[calc(100dvh-150px)] min-h-[460px] gap-3 md:h-[calc(100dvh-110px)] md:grid-cols-[340px_1fr]">
      <Inbox initial={list} />
      {children}
    </div>
  );
}
