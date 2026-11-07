import type { WaitlistLocale } from "@/lib/waitlist/signup"

const COPY = {
  es: {
    subject: "Estás en la primera lista",
    headline: "Estás dentro.",
    paragraphs: [
      "Sozu es el movimiento de las finanzas descentralizadas en Chile. Tu lugar está en la primera lista del beta cerrado.",
      "Agradecemos tu confianza. Compensaremos los posibles roces de ser miembro desde el principio con mayores rendimientos a lo largo del vuelo.",
      "La honraremos durante toda la relación comercial.",
    ],
  },
  en: {
    subject: "You're on the first list",
    headline: "You're in.",
    paragraphs: [
      "Sozu is the decentralized-finance movement in Chile. Your place is on the first closed-beta list.",
      "We are grateful for your trust. We will compensate any friction from being a member from the start with higher yields throughout the flight.",
      "It will be honored throughout our business relationship.",
    ],
  },
} as const

export function waitlistKnightUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://app.sozu.capital").replace(/\/$/, "")
  return `${base}/waitlist/knight.png`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function waitlistConfirmLetter(locale: WaitlistLocale | null, email: string) {
  const copy = COPY[locale === "en" ? "en" : "es"]
  const knight = waitlistKnightUrl()
  const paragraphs = copy.paragraphs
    .map(
      (line) =>
        `<p style="margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:300;line-height:1.5;letter-spacing:-0.01em;color:#111111;">${escapeHtml(line)}</p>`,
    )
    .join("")

  const html = `<!DOCTYPE html>
<html lang="${locale === "en" ? "en" : "es"}">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.paragraphs[0])}</div>
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
              ${paragraphs}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="bottom" style="padding:0 16px 8px;font-family:Helvetica,Arial,sans-serif;font-size:10px;font-weight:300;letter-spacing:0.28em;color:#000000;">
                    SOZU CAPITAL
                    <div style="margin-top:10px;letter-spacing:0;font-size:11px;line-height:1.4;color:#6b6b6b;">${escapeHtml(email)}</div>
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

  const text = [copy.headline, "", ...copy.paragraphs, "", "SOZU CAPITAL", email].join("\n")
  return { subject: copy.subject, html, text }
}

export async function sendWaitlistConfirmation(params: {
  email: string
  locale: WaitlistLocale | null
}): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return { sent: false, skipped: true, error: "no_resend_key" }

  const letter = waitlistConfirmLetter(params.locale, params.email)
  const from = process.env.WAITLIST_EMAIL_FROM?.trim() || "Sozu <hola@sozu.capital>"

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
