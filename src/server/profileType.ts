import "server-only";
import { db } from "@/lib/db";
import { PROFILE_TYPES } from "@/lib/config";
import { allAdults, parseBirthDate } from "@/lib/age";
import { audit } from "./notify";

/**
 * Aplica troca de tipo de perfil (usado pelo admin e na aprovação de ticket).
 * Mantém as características das pessoas existentes; se entrar pessoa nova,
 * a verificação por selfie precisa ser refeita (evita fraude solteiro↔casal).
 */
export async function applyProfileType(userId: string, type: string, birthStrs: string[], actorId: string) {
  if (!(type in PROFILE_TYPES)) return { error: "Tipo inválido" };
  const labels = PROFILE_TYPES[type as keyof typeof PROFILE_TYPES].persons;
  const births = labels.map((_, i) => parseBirthDate(birthStrs[i] ?? ""));
  if (births.some((b) => !b)) return { error: "Informe a data de nascimento de todas as pessoas" };
  if (!allAdults(births as Date[])) return { error: "Todas as pessoas do perfil precisam ter 18 anos ou mais." };
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const persons = await db.profilePerson.findMany({ where: { userId }, orderBy: { id: "asc" } });
  const addsPerson = labels.length > persons.length;
  await db.$transaction(async (tx) => {
    for (let i = 0; i < labels.length; i++) {
      if (persons[i]) await tx.profilePerson.update({ where: { id: persons[i].id }, data: { label: labels[i], birthDate: births[i]! } });
      else await tx.profilePerson.create({ data: { userId, label: labels[i], birthDate: births[i]! } });
    }
    for (const extra of persons.slice(labels.length)) await tx.profilePerson.delete({ where: { id: extra.id } });
    await tx.user.update({
      where: { id: userId },
      data: {
        profileType: type as keyof typeof PROFILE_TYPES,
        birthDate: births[0]!,
        ...(addsPerson && user.role === "USER" ? { ageVerification: "NONE", ageVerifiedAt: null } : {}),
      },
    });
  });
  await audit(actorId, "profile.type", "User", userId, { from: user.profileType, to: type, reverify: addsPerson });
  return { ok: true, reverify: addsPerson && user.role === "USER" };
}
