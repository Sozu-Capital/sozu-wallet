import { waitlistKnightUrl } from "@/lib/waitlist/confirm-email"

export type AccountEmailLocale = "en" | "es"

const COPY = {
  es: {
    subject: "Tu cuenta Sozu está lista",
    headline: "Solo vos tenés acceso.",
    account: (tag: string) =>
      `Tu cuenta @${tag} se abre con la llave de este dispositivo. Nadie más puede entrar. Sozu no guarda una contraseña.`,
    keep: "No pierdas esa llave.",
    backup: "Si la perdés, este correo es el respaldo rápido para crear una llave nueva.",
  },
  en: {
    subject: "Your Sozu account is ready",
    headline: "Only you have access.",
    account: (tag: string) =>
      `Your @${tag} account opens with the passkey on this device. Nobody else can get in. Sozu does not store a password.`,
    keep: "Don't lose that passkey.",
    backup: "If you do, this email is the quick backup for creating a new one.",
  },
} as const

export function accountEmailLocale(raw: unknown): AccountEmailLocale {
  return raw === "en" ? "en" : "es"
}

function displayTag(raw: string): string {
  const tag = raw.replace(/^@+/, "").replace(/[\r\n\t]/g, "").trim().slice(0, 40)
  return tag || "Sozu"
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function accountCreatedLetter(locale: AccountEmailLocale, email: string, tag: string) {
  const copy = COPY[locale]
  const safeTag = displayTag(tag)
  const knight = waitlistKnightUrl()
  const paragraphs = [copy.account(safeTag), copy.keep, copy.backup]
  const body = paragraphs
    .map(
      (line) =>
        `<p style="margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:300;line-height:1.5;letter-spacing:-0.01em;color:#111111;">${escapeHtml(line)}</p>`,
    )
    .join("")

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(paragraphs[0])}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:64px 24px 32px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;">
          <tr>
            <td style="padding:0 8px 36px;font-family:Helvetica,Arial,sans-serif;font-size:40px;font-weight:300;line-height:1.12;letter-spacing:-0.03em;color:#000000;">
              ${escapeHtml(copy.headline)}
            </td>
          </tr>
          <tr>
            <td style="padding:0 8px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="bottom" style="padding:0 16px 8px;font-family:Helvetica,Arial,sans-serif;font-size:10px;font-weight:300;letter-spacing:0.28em;color:#000000;">
                    SOZU CAPITAL
                    <div style="margin-top:10px;letter-spacing:0;font-size:11px;line-height:1.4;color:#6b6b6b;">@${escapeHtml(safeTag)} · ${escapeHtml(email)}</div>
                  </td>
                  <td valign="bottom" align="right" width="180" style="width:180px;">
                    <img src="${escapeHtml(knight)}" width="180" alt="" style="display:block;width:180px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [copy.headline, "", ...paragraphs, "", "SOZU CAPITAL", `@${safeTag}`, email].join("\n")
  return { subject: copy.subject, html, text }
}

export async function sendAccountCreatedEmail(params: {
  email: string
  locale: AccountEmailLocale
  tag: string
}): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return { sent: false, skipped: true, error: "no_resend_key" }

  const letter = accountCreatedLetter(params.locale, params.email, params.tag)
  const from = process.env.ACCOUNT_EMAIL_FROM?.trim() || "Sozu <hola@sozu.capital>"

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.email],
        subject: letter.subject,
        html: letter.html,
        text: letter.text,
      }),
    })
    if (!response.ok) {
      const detail = await response.text()
      return { sent: false, skipped: false, error: detail.slice(0, 300) }
    }
    return { sent: true, skipped: false }
  } catch (error) {
    return { sent: false, skipped: false, error: error instanceof Error ? error.message : "send_failed" }
  }
}
