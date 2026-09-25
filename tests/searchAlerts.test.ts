import { describe, expect, it } from "vitest";
import { ALERTS, alertLabel, matchesAlert, nextSent, parseAlert, sameFilters, type AlertFilters } from "@/lib/searchAlerts";

const POA = { lat: -30.03, lng: -51.23 };
const CANOAS = { lat: -29.92, lng: -51.18 }; // ~13 km
const SP = { lat: -23.55, lng: -46.63 };
const cand = (o: Partial<Parameters<typeof matchesAlert>[1]> = {}) => ({
  profileType: "COUPLE_MF", state: "RS", likes: ["Soft swing"], avatarId: "a1", showDistance: true, hideCity: false, ...CANOAS, ...o,
});
const f = (o: Partial<AlertFilters> = {}): AlertFilters => ({ tipo: null, uf: null, raio: null, curte: null, foto: false, ...o });

describe("parseAlert", () => {
  it("aceita filtros válidos e ignora os inválidos", () => {
    expect(parseAlert({ tipo: "CASAIS", uf: "RS", raio: "100", curte: "Soft swing", foto: "1" })).toEqual(f({ tipo: "CASAIS", uf: "RS", raio: 100, curte: "Soft swing", foto: true }));
    expect(parseAlert({ tipo: "HACK", uf: "XX", raio: "7", curte: "nada", uf2: 1 } as never)).toHaveProperty("error");
  });
  it("exige pelo menos um filtro de verdade (foto sozinha não vale)", () => {
    expect(parseAlert({ foto: "1" })).toHaveProperty("error");
    expect(parseAlert({ uf: "SP" })).not.toHaveProperty("error");
  });
});

describe("matchesAlert", () => {
  it("tipo: CASAIS pega qualquer casal", () => {
    expect(matchesAlert(f({ tipo: "CASAIS" }), cand(), POA)).toBe(true);
    expect(matchesAlert(f({ tipo: "CASAIS" }), cand({ profileType: "SINGLE_MAN" }), POA)).toBe(false);
    expect(matchesAlert(f({ tipo: "SINGLE_WOMAN" }), cand(), POA)).toBe(false);
  });
  it("estado, curte e foto", () => {
    expect(matchesAlert(f({ uf: "SP" }), cand(), POA)).toBe(false);
    expect(matchesAlert(f({ curte: "Soft swing" }), cand(), POA)).toBe(true);
    expect(matchesAlert(f({ curte: "Soft swing" }), cand({ likes: null }), POA)).toBe(false);
    expect(matchesAlert(f({ foto: true, uf: "RS" }), cand({ avatarId: null }), POA)).toBe(false);
  });
  it("raio: mede de onde quem salvou está e respeita quem esconde a distância", () => {
    expect(matchesAlert(f({ raio: 25 }), cand(), POA)).toBe(true);
    expect(matchesAlert(f({ raio: 10 }), cand(), POA)).toBe(false);
    expect(matchesAlert(f({ raio: 100 }), cand(SP), POA)).toBe(false);
    expect(matchesAlert(f({ raio: 25 }), cand({ showDistance: false }), POA)).toBe(false);
    expect(matchesAlert(f({ raio: 25 }), cand(), { lat: null, lng: null })).toBe(false);
  });
});

describe("rótulo, igualdade e limite diário", () => {
  it("rótulo legível", () => {
    expect(alertLabel(f({ tipo: "CASAIS", uf: "RS", raio: 100, curte: "Soft swing", foto: true }))).toBe("Casais · RS · até 100 km · curte Soft swing · com foto");
    expect(alertLabel(f({ tipo: "SINGLE_WOMAN" }))).toBe("Mulher");
  });
  it("mesmos filtros", () => {
    expect(sameFilters(f({ uf: "RS" }), f({ uf: "RS" }))).toBe(true);
    expect(sameFilters(f({ uf: "RS" }), f({ uf: "RS", foto: true }))).toBe(false);
  });
  it("no máximo ALERTS.perDay avisos por dia, zerando no dia seguinte", () => {
    expect(nextSent({ sentDay: null, sentCount: 0 }, "2026-09-25")).toEqual({ sentDay: "2026-09-25", sentCount: 1 });
    expect(nextSent({ sentDay: "2026-09-25", sentCount: ALERTS.perDay }, "2026-09-25")).toBeNull();
    expect(nextSent({ sentDay: "2026-09-24", sentCount: ALERTS.perDay }, "2026-09-25")).toEqual({ sentDay: "2026-09-25", sentCount: 1 });
  });
});
