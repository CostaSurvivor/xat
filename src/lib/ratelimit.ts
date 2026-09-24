/**
 * Token bucket em memória (por processo). Sem VPS não temos Redis; o flood
 * detection também consulta o banco (ver server/chat.ts) para ser robusto
 * mesmo com mais de um processo.
 */
type Bucket = { tokens: number; updated: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(private capacity: number, private refillPerSec: number, private now: () => number = Date.now) {}

  take(key: string, cost = 1): boolean {
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: this.capacity, updated: t };
    const elapsed = (t - b.updated) / 1000;
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerSec);
    b.updated = t;
    if (b.tokens < cost) {
      this.buckets.set(key, b);
      return false;
    }
    b.tokens -= cost;
    this.buckets.set(key, b);
    if (this.buckets.size > 50_000) this.gc();
    return true;
  }

  private gc() {
    const t = this.now();
    for (const [k, b] of this.buckets) if (t - b.updated > 10 * 60_000) this.buckets.delete(k);
  }
}

const g = globalThis as unknown as { __rl?: Record<string, RateLimiter> };
g.__rl ??= {};
export function limiter(name: string, capacity: number, refillPerSec: number): RateLimiter {
  return (g.__rl![name] ??= new RateLimiter(capacity, refillPerSec));
}

/** Detecta flood: mesma mensagem repetida ou muitas mensagens numa janela. */
export function isFlood(recent: { body: string; createdAt: Date }[], body: string, now = Date.now()): boolean {
  const last10s = recent.filter((m) => now - m.createdAt.getTime() < 10_000);
  if (last10s.length >= 6) return true;
  const norm = (s: string) => s.trim().toLowerCase();
  const same = recent.filter((m) => now - m.createdAt.getTime() < 60_000 && norm(m.body) === norm(body));
  return same.length >= 3;
}
