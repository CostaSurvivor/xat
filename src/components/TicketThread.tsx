import { db } from "@/lib/db";
import { TICKET_CATEGORIES, TICKET_STATUS } from "@/lib/tickets";
import { closeTicket, replyTicket } from "@/app/actions/tickets";
import { ReplyForm } from "./TicketForms";

export async function TicketThread({ ticketId, viewerIsStaff }: { ticketId: string; viewerIsStaff: boolean }) {
  const t = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { messages: { orderBy: { createdAt: "asc" } }, user: { select: { nick: true } } } });
  const st = TICKET_STATUS[t.status];
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-lg font-bold">{t.subject}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
        </div>
        <p className="text-xs text-mute">
          #{t.id.slice(-6)} · {TICKET_CATEGORIES[t.category]} · aberto por @{t.user.nick} em {t.createdAt.toLocaleString("pt-BR")}
          {t.requestedNick && <> · nick pedido: <b className="text-gold2">{t.requestedNick}</b></>}
        </p>
      </div>
      <div className="space-y-2">
        {t.messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromStaff === viewerIsStaff ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.fromStaff ? "bg-wine/60" : "bg-panel2"}`}>
              <p className="mb-0.5 text-[11px] text-white/60">{m.fromStaff ? "🛡️ Administração" : `@${t.user.nick}`} · {m.createdAt.toLocaleString("pt-BR")}</p>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            </div>
          </div>
        ))}
      </div>
      {t.status !== "CLOSED" ? (
        <div className="card space-y-2 p-4">
          <ReplyForm action={replyTicket.bind(null, t.id)} />
          <form action={closeTicket.bind(null, t.id)} className="text-right"><button className="text-xs text-mute underline">Encerrar chamado</button></form>
        </div>
      ) : (
        <p className="text-center text-sm text-mute">Chamado encerrado. Se precisar, abra um novo.</p>
      )}
    </div>
  );
}
