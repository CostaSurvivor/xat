/** Blocos cinza enquanto a página carrega (sensação de rapidez no celular). */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-panel2 ${className}`} />;
}

export function FeedSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando" data-testid="carregando">
      <div className="flex gap-3 overflow-hidden">{Array.from({ length: 6 }, (_, i) => <SkeletonBlock key={i} className="h-16 w-16 shrink-0 rounded-full" />)}</div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="card space-y-3 p-4">
          <div className="flex items-center gap-3"><SkeletonBlock className="h-10 w-10 rounded-full" /><SkeletonBlock className="h-4 w-32" /></div>
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-48 w-full" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando" data-testid="carregando">
      <SkeletonBlock className="h-8 w-40" />
      <SkeletonBlock className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="card flex flex-col items-center gap-2 p-4"><SkeletonBlock className="h-[72px] w-[72px] rounded-full" /><SkeletonBlock className="h-3 w-20" /><SkeletonBlock className="h-3 w-14" /></div>
        ))}
      </div>
    </div>
  );
}
