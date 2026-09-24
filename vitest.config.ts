import { defineConfig } from "vitest/config";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

// carrega .env (se existir) para os testes de integração do ledger
const env: Record<string, string> = {};
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
}

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"], fileParallelism: false, env, testTimeout: 30_000 },
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/server-only-stub.ts") } },
});
