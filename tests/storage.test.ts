/**
 * Driver S3 contra um S3 de teste (ex.: s3rver/minio). Pula se S3_TEST_ENDPOINT não existir.
 */
import { describe, expect, it } from "vitest";

const endpoint = process.env.S3_TEST_ENDPOINT;
(endpoint ? describe : describe.skip)("storage s3", async () => {
  Object.assign(process.env, {
    STORAGE_DRIVER: "s3", S3_BUCKET: process.env.S3_TEST_BUCKET || "midias", S3_ENDPOINT: endpoint, S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "S3RVER", S3_SECRET_ACCESS_KEY: "S3RVER", S3_FORCE_PATH_STYLE: "1", S3_PREFIX: "teste",
  });
  const { storage } = await import("@/server/storage");
  const data = Buffer.from("0123456789abcdef");

  it("grava, lê, mede, faz range e apaga", async () => {
    await storage.put("u/1/o.webp", data, "image/webp");
    expect((await storage.get("u/1/o.webp")).toString()).toBe("0123456789abcdef");
    expect(await storage.size("u/1/o.webp")).toBe(16);
    const r = await storage.stream("u/1/o.webp", 4, 7);
    expect(Buffer.from(await new Response(r).arrayBuffer()).toString()).toBe("4567");
    await storage.remove("u/1/o.webp");
    await expect(storage.get("u/1/o.webp")).rejects.toThrow();
  });
  it("recusa chave com ..", async () => {
    await expect(storage.put("../fora", data)).rejects.toThrow(/inválida/);
  });
});
