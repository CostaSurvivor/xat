import { ACHIEVEMENTS, nextGoals, type evaluate } from "@/lib/achievements";

type List = ReturnType<typeof evaluate>;

/** Selos no perfil: visitantes veem os conquistados; o dono vê também o progresso das próximas. */
export function Achievements({ list, mine }: { list: List; mine: boolean }) {
  const done = list.filter((a) => a.done);
  if (!mine && done.length === 0) return null;
  const next = mine ? nextGoals(list) : [];
  return (
    <section className="card p-4" aria-label="Conquistas" data-testid="conquistas">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="mr-auto font-semibold">🏅 Conquistas</h2>
        <span className="text-xs text-mute">{done.length} de {ACHIEVEMENTS.length}</span>
      </div>
      {done.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {done.map((a) => (
            <li key={a.key} title={a.desc} className="flex items-center gap-1 rounded-full border border-gold/40 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-fg">
              <span aria-hidden="true">{a.emoji}</span>{a.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute">Nenhuma conquista ainda. Comece pelas de baixo!</p>
      )}
      {next.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <p className="text-xs font-semibold text-mute">Próximas</p>
          {next.map((a) => (
            <div key={a.key} className="text-xs">
              <div className="mb-1 flex justify-between"><span>{a.emoji} <b>{a.name}</b> · {a.desc}</span><span className="text-mute">{a.progress}/{a.goal}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuemin={0} aria-valuemax={a.goal} aria-valuenow={a.progress} aria-label={a.name}>
                <div className="h-full rounded-full bg-wine" style={{ width: `${Math.max(3, (a.progress / a.goal) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
