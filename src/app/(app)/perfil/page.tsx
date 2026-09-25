import Link from "next/link";
import { CityFields } from "@/components/CityFields";
import { PasswordForm } from "@/components/PasswordForm";
import { hasPassword } from "@/lib/oauth";
import { db } from "@/lib/db";
import { LIKE_GROUPS, PERSON_FIELDS } from "@/lib/config";
import { ageOn } from "@/lib/age";
import { isSubscriber, isVerified, requireUser } from "@/server/auth";
import { deleteMedia, setAlbumAccess, updatePersons, updateProfile, uploadPhoto } from "@/app/actions/profile";
import { logout } from "@/app/actions/auth";
import { ProfileTypeForm } from "@/components/ProfileTypeForm";
import { PROFILE_TYPES, type ProfileTypeKey } from "@/lib/config";
import { ActionForm, AutoSubmitFile } from "@/components/Forms";
import { Avatar } from "@/components/Avatar";
import { ProtectedImage } from "@/components/ProtectedImage";
import { ThemedAlbumsOwner } from "@/components/ThemedAlbums";
import { PushSettings } from "@/components/PushSettings";
import { readPrefs } from "@/lib/push";

export const metadata = { title: "Meu perfil" };

export default async function MeuPerfil() {
  const user = await requireUser();
  const verified = isVerified(user);
  const persons = await db.profilePerson.findMany({ where: { userId: user.id }, orderBy: { label: "asc" } });
  const { visitCountSince, visitsFor } = await import("@/server/visits");
  const recentVisits = (await visitsFor(user.id)).slice(0, 8);
  const vip = isSubscriber(user);
  const [album, requests, visitsWeek, pendingTestimonials] = await Promise.all([
    db.media.findMany({ where: { ownerId: user.id, kind: "PRIVATE_ALBUM", status: "APPROVED", albumId: null }, orderBy: { createdAt: "desc" } }),
    db.albumAccess.findMany({ where: { ownerId: user.id }, include: { viewer: { select: { id: true, nick: true } } }, orderBy: { createdAt: "desc" } }),
    visitCountSince(user.id, 7),
    db.testimonial.count({ where: { profileId: user.id, status: "PENDING" } }),
  ]);
  const likes = (user.likes as string[] | null) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-[family-name:var(--font-display)] text-2xl font-bold">Meu perfil e configurações</h1>
        <Link href="/depoimentos" className="btn-ghost">📝 Depoimentos{pendingTestimonials ? ` (${pendingTestimonials})` : ""}</Link>
        <Link href={`/u/${user.nick}`} className="btn-ghost">Ver como os outros veem</Link>
        <form action={logout}><button className="btn-ghost">Sair</button></form>
      </div>

      <section className="card p-4" id="visitas">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="mr-auto font-semibold text-gold">👀 Últimas visitas</h2>
          <span className="text-xs text-mute">{visitsWeek} {visitsWeek === 1 ? "visita" : "visitas"} na semana</span>
          <Link href="/visitas" className="text-xs text-wine underline">ver todas</Link>
        </div>
        {recentVisits.length === 0 ? (
          <p className="text-sm text-mute">Ninguém visitou seu perfil nos últimos 30 dias. Poste uma foto ou entre numa sala para aparecer mais!</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentVisits.map((v, i) =>
              vip ? (
                <Link key={v.id} href={`/u/${encodeURIComponent(v.nick)}`} className="flex w-16 shrink-0 flex-col items-center gap-1">
                  <Avatar mediaId={v.avatarId} nick={v.nick} size={52} style={v.style} />
                  <span className="w-full truncate text-center text-[11px]">{v.nick}</span>
                </Link>
              ) : (
                <span key={i} className="flex w-16 shrink-0 flex-col items-center gap-1" aria-hidden>
                  <span className="h-[52px] w-[52px] rounded-full bg-gradient-to-br from-pink-200 to-wine/40 blur-[2px]" />
                  <span className="h-2.5 w-10 rounded bg-panel2" />
                </span>
              ),
            )}
          </div>
        )}
        {!vip && recentVisits.length > 0 && <p className="mt-2 text-xs text-mute">Ver <b>quem</b> visitou é exclusivo para assinantes. <Link href="/assinar" className="text-gold underline">Assinar</Link></p>}
      </section>

      <section className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar mediaId={user.avatarId} nick={user.nick} size={72} />
        <div className="min-w-40 flex-1">
          <p className="label">Nick</p>
          <p className="font-semibold">{user.nick}</p>
          <Link href="/suporte?novo=NICK_CHANGE" className="text-xs text-mute underline">Pedir troca de nick</Link>
        </div>
        {verified ? (
          <ActionForm action={uploadPhoto} okText="Foto atualizada!">
            <input type="hidden" name="kind" value="AVATAR" />
            <AutoSubmitFile name="photo" label="📷 Trocar foto de perfil" />
          </ActionForm>
        ) : (
          <Link href="/verificacao" className="text-sm text-gold underline">Verifique-se para colocar foto</Link>
        )}
      </section>

      <section className="card p-5">
        <ActionForm action={updateProfile} className="space-y-4">
          <div>
            <label className="label">Frase de status (aparece sob o nick no chat)</label>
            <input name="statusText" maxLength={60} defaultValue={user.statusText ?? ""} className="input" placeholder="Ex.: Casal SP, só papo bom 🍷" />
          </div>
          <div>
            <label className="label">Sobre vocês</label>
            <textarea name="bio" maxLength={1500} defaultValue={user.bio ?? ""} className="input h-28" placeholder="Casal liberal de SP, curtimos…" />
          </div>
          <CityFields defaultState={user.state ?? "SP"} defaultCity={user.city ?? ""} />
          <div className="space-y-3">
            <span className="label">O que curtem</span>
            {LIKE_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-1 text-xs text-gold">{g.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.tags.map((t) => (
                    <label key={t} className="cursor-pointer">
                      <input type="checkbox" name="likes" value={t} defaultChecked={likes.includes(t)} className="peer sr-only" />
                      <span className="inline-block rounded-full border border-line px-2.5 py-1 text-xs text-mute peer-checked:border-gold peer-checked:bg-wine peer-checked:text-white">{t}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="label">Quem pode me chamar no PV</label>
            <select name="pmPolicy" defaultValue={user.pmPolicy} className="input">
              <option value="EVERYONE">Todos</option>
              <option value="FRIENDS">Só amigos</option>
              <option value="FOLLOWING">Só quem eu sigo</option>
              <option value="COUPLES">Só casais</option>
              <option value="NOBODY">Ninguém</option>
            </select>
          </div>
          <div>
            <label className="label">Quem vê o álbum privado</label>
            <select name="albumVisibility" defaultValue={user.albumVisibility} className="input">
              <option value="PRIVATE">🔒 Manter privado (só quem eu liberar)</option>
              <option value="FRIENDS">🤝 Liberar para amigos</option>
              <option value="FOLLOWERS">👀 Liberar para seguidores</option>
            </select>
          </div>
          <div className="space-y-2 text-sm text-mute">
            <label className="flex gap-2"><input type="checkbox" name="acceptPmPhotos" defaultChecked={user.acceptPmPhotos} /> Aceito receber fotos no PV (chegam borradas até eu abrir)</label>
            <label className="flex gap-2"><input type="checkbox" name="hideCity" defaultChecked={user.hideCity} /> Esconder minha cidade</label>
            <label className="flex gap-2"><input type="checkbox" name="showDistance" defaultChecked={user.showDistance} /> Aparecer na busca por proximidade (mostra só a distância aproximada, ex.: “~15 km”; nunca o endereço)</label>
            <label className="flex gap-2"><input type="checkbox" name="hideFromUnverified" defaultChecked={user.hideFromUnverified} /> Esconder meu perfil e fotos de quem não é verificado</label>
          </div>
          <button className="btn-gold">Salvar</button>
        </ActionForm>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold text-gold">Tipo de perfil</h2>
        {user.role === "ADMIN" ? (
          <ProfileTypeForm current={user.profileType as ProfileTypeKey} births={persons.map((p) => p.birthDate.toISOString().slice(0, 10))} />
        ) : (
          <p className="text-sm">
            <b>{PROFILE_TYPES[user.profileType as ProfileTypeKey].label}</b>
            <span className="text-mute"> · para trocar, </span>
            <Link href="/suporte?novo=PROFILE_TYPE" className="text-gold underline">peça à moderação</Link>
            <span className="text-mute"> (evita perfis falsos).</span>
          </p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold text-gold">{persons.length > 1 ? "Sobre ele e sobre ela" : "Sobre você"}</h2>
        <p className="mb-3 text-xs text-mute">Tudo opcional: preencha só o que quiser mostrar.</p>
        <ActionForm action={updatePersons} className="space-y-4">
          <div className={`grid gap-4 ${persons.length > 1 ? "md:grid-cols-2" : ""}`}>
            {persons.map((p) => (
              <fieldset key={p.id} className="space-y-2 rounded-xl border border-line p-3">
                <legend className="px-1 text-sm font-semibold">{p.label} · {ageOn(p.birthDate)} anos</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2 text-xs text-mute">
                    Data de nascimento
                    <input type="date" name={`${p.id}.birthDate`} defaultValue={p.birthDate.toISOString().slice(0, 10)} required className="input mt-0.5 py-1.5" />
                  </label>
                  {(Object.keys(PERSON_FIELDS) as (keyof typeof PERSON_FIELDS)[]).map((k) => (
                    <label key={k} className="text-xs text-mute">
                      {PERSON_FIELDS[k].label}
                      <select name={`${p.id}.${k}`} defaultValue={p[k] ?? ""} className="input mt-0.5 py-1.5">
                        <option value="">—</option>
                        {PERSON_FIELDS[k].options.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </label>
                  ))}
                  <label className="text-xs text-mute">
                    Altura (cm)
                    <input type="number" min={120} max={230} name={`${p.id}.heightCm`} defaultValue={p.heightCm ?? ""} className="input mt-0.5 py-1.5" placeholder="170" />
                  </label>
                </div>
              </fieldset>
            ))}
          </div>
          <button className="btn-gold">Salvar</button>
        </ActionForm>
      </section>

      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gold">🔒 Álbum privado</h2>
          {verified && (
            <ActionForm action={uploadPhoto} okText="Foto adicionada!">
              <input type="hidden" name="kind" value="PRIVATE_ALBUM" />
              <AutoSubmitFile name="photo" label="+ Adicionar foto" />
            </ActionForm>
          )}
        </div>
        <p className="text-xs text-mute">Quem pode ver é definido em “Quem vê o álbum privado” acima; você também pode liberar pessoas uma a uma. Os demais veem versões borradas.</p>
        <div className="grid grid-cols-3 gap-1.5">
          {album.map((m) => (
            <div key={m.id} className="relative">
              <ProtectedImage id={m.id} className="aspect-square rounded-lg" />
              <form action={deleteMedia.bind(null, m.id)} className="absolute right-1 top-1"><button className="rounded-full bg-black/70 text-white px-2 text-xs">✕</button></form>
            </div>
          ))}
        </div>
        {requests.length > 0 && (
          <div className="border-t border-line pt-3">
            <h3 className="mb-2 text-sm font-semibold">Pedidos de acesso</h3>
            <ul className="space-y-1.5">
              {requests.map((r) => (
                <li key={r.viewerId} className="flex items-center gap-2 text-sm">
                  <Link href={`/u/${r.viewer.nick}`} className="mr-auto">@{r.viewer.nick}</Link>
                  {r.granted ? (
                    <form action={setAlbumAccess.bind(null, r.viewerId, false)}><button className="btn-ghost py-1 text-xs">Revogar</button></form>
                  ) : (
                    <form action={setAlbumAccess.bind(null, r.viewerId, true)}><button className="btn-gold py-1 text-xs">Liberar</button></form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <ThemedAlbumsOwner ownerId={user.id} verified={verified} />

      <PushSettings prefs={readPrefs(user.pushPrefs)} devices={await db.pushSubscription.count({ where: { userId: user.id } })} />

      <section className="card p-5">
        <h2 className="mb-3 font-semibold text-gold">🔑 {hasPassword(user) ? "Trocar senha" : "Definir senha"}</h2>
        <PasswordForm hasPassword={hasPassword(user)} compact />
      </section>

      <section className="card p-5 text-sm">
        <h2 className="mb-2 font-semibold text-gold">Conta e privacidade</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/loja/inventario" className="btn-ghost">🎒 Meus itens</Link>
          <Link href="/carteira" className="btn-ghost">🌶️ Carteira</Link>
          <Link href="/conta" className="btn-ghost">🔑 Senha e dados (LGPD)</Link>
          <Link href="/suporte" className="btn-ghost">🎫 Suporte</Link>
        </div>
      </section>
    </div>
  );
}
