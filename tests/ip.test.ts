import { describe, expect, it } from "vitest";
import { clientIpFrom } from "@/lib/ip";

const h = (o: Record<string, string>) => (k: string) => o[k] ?? null;

describe("IP do visitante", () => {
  it("ignora o que o visitante escreve no começo do X-Forwarded-For", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "1.2.3.4, 200.10.20.30" }))).toBe("200.10.20.30");
    expect(clientIpFrom(h({ "x-forwarded-for": "9.9.9.9, 8.8.8.8, 200.10.20.30" }))).toBe("200.10.20.30");
  });
  it("com 2 proxies de confiança pega a penúltima", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "1.2.3.4, 200.10.20.30, 10.0.0.1" }), 2)).toBe("200.10.20.30");
  });
  it("uma entrada só; sem cabeçalho usa x-real-ip; lixo vira 0.0.0.0", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "200.10.20.30" }))).toBe("200.10.20.30");
    expect(clientIpFrom(h({ "x-real-ip": "2804:14c::1" }))).toBe("2804:14c::1");
    expect(clientIpFrom(h({}))).toBe("0.0.0.0");
    expect(clientIpFrom(h({ "x-forwarded-for": "<script>" }))).toBe("0.0.0.0");
  });
});
