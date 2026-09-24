import { SITE_NAME } from "@/lib/config";

/** Marca: balão de conversa com chama + nome. Divide o nome em "Sex" / resto quando aplicável. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg-bubble" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c0264f" />
          <stop offset="1" stopColor="#5c0d24" />
        </linearGradient>
        <linearGradient id="lg-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#b8871b" />
          <stop offset="0.6" stopColor="#f1d77a" />
          <stop offset="1" stopColor="#fff3c4" />
        </linearGradient>
      </defs>
      <path d="M32 4C16.5 4 4 14.6 4 27.7c0 7.5 4.1 14.2 10.5 18.5L12 58l13.1-7.4c2.2.5 4.5.7 6.9.7 15.5 0 28-10.6 28-23.6S47.5 4 32 4z" fill="url(#lg-bubble)" />
      <path d="M32 13c1.6 5.2 7.8 8.3 7.8 15.4 0 5.3-3.6 9.3-7.8 9.3s-7.8-3.8-7.8-8.6c0-3.6 2-5.5 3.4-7.6.4 2.4 1.5 3.9 3 4.4C29.4 21.6 30.4 17 32 13z" fill="url(#lg-flame)" />
    </svg>
  );
}

export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  const m = /^(sex)(.+)$/i.exec(SITE_NAME);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <LogoMark size={size} />
      <span className="font-[family-name:var(--font-display)] font-extrabold leading-none tracking-tight" style={{ fontSize: size * 0.8 }}>
        {m ? (
          <>
            <span className="gold-text">{m[1]}</span>
            <span className="text-fg">{m[2]}</span>
          </>
        ) : (
          <span className="gold-text">{SITE_NAME}</span>
        )}
      </span>
    </span>
  );
}
