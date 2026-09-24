import { describe, expect, it } from "vitest";
import { SHORTCUTS, opAllowed, queueOrder } from "@/lib/modqueue";

describe("fila de moderação", () => {
  it("possível menor primeiro; depois verificações, eventos e denúncias leves; mais antigo antes", () => {
    const q = queueOrder([
      { id: "spam", kind: "report" as const, priority: 20, createdAt: "2026-01-01" },
      { id: "ev", kind: "event" as const, priority: 0, createdAt: "2026-01-01" },
      { id: "v2", kind: "verification" as const, priority: 0, createdAt: "2026-01-03" },
      { id: "menor", kind: "report" as const, priority: 100, createdAt: "2026-01-05" },
      { id: "v1", kind: "verification" as const, priority: 0, createdAt: "2026-01-02" },
      { id: "assedio", kind: "report" as const, priority: 50, createdAt: "2026-01-04" },
    ]);
    expect(q.map((i) => i.id)).toEqual(["menor", "assedio", "v1", "v2", "ev", "spam"]);
  });
  it("escalar nunca tem atalho, mas é permitido pelo botão; operações desconhecidas são recusadas", () => {
    expect(Object.values(SHORTCUTS.report).some((s) => s.op === "escalate")).toBe(false);
    expect(opAllowed("report", "escalate")).toBe(true);
    expect(opAllowed("verification", "escalate")).toBe(false);
    expect(opAllowed("event", "delete_all")).toBe(false);
    expect(opAllowed("verification", "approve")).toBe(true);
  });
});
