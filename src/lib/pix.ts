/** Gera o "Pix copia e cola" (BR Code EMV estático) com valor e identificador. */
function f(id: string, value: string) {
  return id + value.length.toString().padStart(2, "0") + value;
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const clean = (s: string, max: number) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, max).trim() || "X";

export function pixPayload(opts: { key: string; name: string; city: string; amountCents: number; txid: string }) {
  const account = f("00", "br.gov.bcb.pix") + f("01", opts.key.trim());
  const txid = opts.txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const body =
    f("00", "01") +
    f("26", account) +
    f("52", "0000") +
    f("53", "986") +
    f("54", (opts.amountCents / 100).toFixed(2)) +
    f("58", "BR") +
    f("59", clean(opts.name, 25)) +
    f("60", clean(opts.city, 15)) +
    f("62", f("05", txid)) +
    "6304";
  return body + crc16(body);
}
