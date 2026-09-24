import "server-only";
import nodemailer from "nodemailer";
import { SITE_NAME } from "@/lib/config";

/**
 * E-mail via SMTP (Hostinger: smtp.hostinger.com, porta 465, SSL).
 * Sem SMTP configurado, as funções apenas retornam false.
 */
export const mailEnabled = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendMail(to: string, subject: string, lines: string[], cta?: { label: string; url: string }) {
  if (!mailEnabled()) return false;
  const html = `<div style="background:#0b0708;padding:24px;font-family:Arial,sans-serif;color:#f4ecee">
  <div style="max-width:520px;margin:auto;background:#161012;border:1px solid #2e2025;border-radius:16px;padding:24px">
    <h1 style="margin:0 0 16px;color:#d4af37;font-size:22px">${esc(SITE_NAME)}</h1>
    ${lines.map((l) => `<p style="line-height:1.5">${esc(l)}</p>`).join("")}
    ${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#d4af37;color:#0b0708;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${esc(cta.label)}</a></p>` : ""}
    <p style="color:#a8979c;font-size:12px">Você recebeu este e-mail porque tem uma conta no ${esc(SITE_NAME)}. Conteúdo exclusivo para maiores de 18 anos.</p>
  </div></div>`;
  try {
    await getTransport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject: `${SITE_NAME} · ${subject}`, html, text: [...lines, cta ? `${cta.label}: ${cta.url}` : ""].join("\n\n") });
    return true;
  } catch (e) {
    console.error("mail error", e);
    return false;
  }
}

export function siteUrl() {
  return (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
}
