/** Idade completa em anos numa data de referência (UTC, sem fuso). */
export function ageOn(birth: Date, ref: Date = new Date()): number {
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const m = ref.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

export const MIN_AGE = 18;

export function isAdult(birth: Date, ref: Date = new Date()): boolean {
  if (Number.isNaN(birth.getTime())) return false;
  if (birth.getUTCFullYear() < 1900) return false;
  return ageOn(birth, ref) >= MIN_AGE;
}

/** Todas as pessoas do perfil precisam ser maiores de idade. */
export function allAdults(births: Date[], ref: Date = new Date()): boolean {
  return births.length > 0 && births.every((b) => isAdult(b, ref));
}

/** "AAAA-MM-DD" -> Date UTC; inválido -> null */
export function parseBirthDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return d;
}
