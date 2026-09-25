import Link from "next/link";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import { PROFILE_TYPES } from "@/lib/config";
import { TESTIMONIALS } from "@/lib/testimonials";
import { blockedIds } from "@/server/access";
import { stylesFor } from "@/server/styles";
import { writeTestimonial } from "@/app/actions/testimonials";
import { ActionForm } from "./Forms";
import { Avatar } from "./Avatar";
import { Nick } from "./Nick";
import { ReportButton } from "./ReportButton";

type Viewer = { id: string; ageVerification: string };

/** Seção "Depoimentos" do perfil: aprovados + formulário para quem pode escrever. */
export async function TestimonialsSection({ profile, viewer }: { profile: { id: string; nick: string }; viewer: Viewer }) {
  const me = profile.id === viewer.id;
  const blocked = await blockedIds(viewer.id);
  const [list, mineRaw, pending] = await Promise.all([
    db.testimonial.findMany({
      where: { profileId: profile.id, status: "APPROVED", withdrawnAt: null, authorId: { notIn: blocked }, author: { status: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { author: { select: { id: true, nick: true, avatarId: true, profileType: true } } },
    }),
    me ? Promise.resolve(null) : db.testimonial.findUnique({ where: { profileId_authorId: { profileId: profile.id, authorId: viewer.id } } }),
    me ? db.testimonial.count({ where: { profileId: profile.id, status: "PENDING", withdrawnAt: null } }) : Promise.resolve(0),
  ]);
  // apagado pelo autor conta como "não escrito", exceto se o dono tinha ocultado (continua discreto)
  const mine = mineRaw && (!mineRaw.withdrawnAt || mineRaw.status === "HIDDEN") ? mineRaw : null;
  const styles = await stylesFor(list.map((t) => t.author.id));
  const met = list.filter((t) => t.metInPerson).length;

  return (
    <section id="depoimentos" className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold text-gold">📝 Depoimentos ({list.length})</h2>
        {met > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">🤝 {met} {met === 1 ? "pessoa conheceu" : "pessoas conheceram"} pessoalmente</span>}
        {me && <Link href="/depoimentos" className="btn-ghost py-1 text-xs">Gerenciar{pending ? ` (${pending} para aprovar)` : ""}</Link>}
      </div>
      {list.length === 0 && <p className="text-sm text-mute">{me ? "Ainda sem depoimentos. Peça para quem já conheceu vocês deixar um: ajuda outros perfis a confiarem." : "Ainda sem depoimentos."}</p>}
      <ul className="space-y-3">
        {list.map((t) => (
          <li key={t.id} className="flex gap-3">
            <Avatar mediaId={t.author.avatarId} nick={t.author.nick} size={40} style={styles[t.author.id]} />
            <div className="min-w-0 flex-1 rounded-xl bg-panel2/60 px-3 py-2">
              <p className="text-xs text-mute">
                <Nick nick={t.author.nick} style={styles[t.author.id]} /> · {PROFILE_TYPES[t.author.profileType].label} · {timeAgo(t.createdAt)}
                {t.metInPerson && <span className="ml-1 font-semibold text-emerald-700">· 🤝 conheceu pessoalmente</span>}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{t.body}</p>
              {!me && t.author.id !== viewer.id && <div className="mt-1 text-right"><ReportButton targetType="TESTIMONIAL" targetId={t.id} /></div>}
            </div>
          </li>
        ))}
      </ul>
      {!me && viewer.ageVerification === "APPROVED" && mine?.status !== "HIDDEN" && (
        <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">{mine ? "✏️ Editar meu depoimento" : `✍️ Deixar um depoimento para @${profile.nick}`}</summary>
          {mine?.status === "PENDING" && <p className="mt-2 text-xs text-amber-700">Seu depoimento está aguardando a aprovação de @{profile.nick}.</p>}
          <ActionForm action={writeTestimonial.bind(null, profile.id)} okText="Enviado! Aparece no perfil depois que o dono aprovar." className="mt-2 space-y-2">
            <textarea name="body" required minLength={TESTIMONIALS.minChars} maxLength={TESTIMONIALS.maxChars} defaultValue={mine?.body ?? ""} className="input h-24" placeholder="Como foi conhecer vocês? Educação, respeito, se é quem diz ser nas fotos…" />
            <label className="flex gap-2 text-sm text-mute"><input type="checkbox" name="metInPerson" defaultChecked={mine?.metInPerson ?? false} /> Nos conhecemos pessoalmente</label>
            <p className="text-[11px] text-mute">Sem telefone, links ou detalhes íntimos de terceiros. Editar devolve o depoimento para aprovação.</p>
            <button className="btn-gold">{mine ? "Salvar e reenviar" : "Enviar depoimento"}</button>
          </ActionForm>
        </details>
      )}
      {!me && mine?.status === "HIDDEN" && <p className="text-xs text-mute">Seu depoimento está aguardando a aprovação de @{profile.nick}.</p>}
      {!me && viewer.ageVerification !== "APPROVED" && <p className="text-xs text-mute"><Link href="/verificacao" className="text-gold underline">Verifique seu perfil</Link> para deixar depoimentos.</p>}
    </section>
  );
}
