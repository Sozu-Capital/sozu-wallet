type RecoveryMail = {
  to: string
  link: string
}

/**
 * Sends the one-time recovery link.
 * Resend is used when RESEND_API_KEY is set. Otherwise the link is written to
 * the server log so a local session can still be tested.
 */
export async function sendRecoveryMail({ to, link }: RecoveryMail): Promise<"resend" | "log"> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RECOVERY_EMAIL_FROM?.trim() || "Sozu <recovery@sozu.capital>"
  const text = [
    "Alguien pidió una llave nueva para tu cuenta Sozu.",
    "Abrí este enlace en el dispositivo donde querés crearla. Vence en 30 minutos.",
    "",
    link,
    "",
    "Si no fuiste vos, ignorá este mensaje. La llave anterior sigue funcionando.",
  ].join("\n")

  if (!apiKey) {
    console.info("[recovery] RESEND_API_KEY is not set. Recovery link:", link)
    return "log"
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Recuperá tu cuenta Sozu",
      text,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Recovery email failed (${response.status}) ${body.slice(0, 180)}`)
  }
  return "resend"
}
