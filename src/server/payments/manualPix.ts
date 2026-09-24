import { pixPayload } from "@/lib/pix";
import { getPixConfig } from "@/server/settings";
import type { PaymentProvider } from "./types";

/** Pix para a chave do dono; o admin confere o extrato e aprova. */
export const manualPix: PaymentProvider = {
  id: "pix_manual",
  label: "Pix (aprovação manual)",
  async createCharge(input) {
    const pix = await getPixConfig();
    if (!pix.key) throw new Error("Chave Pix não configurada");
    return {
      kind: "pix_static",
      payload: pixPayload({ key: pix.key, name: pix.merchantName, city: pix.merchantCity, amountCents: input.amountCents, txid: input.code }),
    };
  },
};
