type FeedbackMail = {
  message: string
  userId: string | null
  username: string | null
  path: string | null
}

const DEFAULT_TO = "support@sozu.capital"
const DEFAULT_FROM = "Sozu <feedback@sozu.capital>"

/**
 * Delivers in-app feedback to the support inbox.
 * Requires RESEND_API_KEY and a receiving mailbox at FEEDBACK_EMAIL_TO.
 */
export async function sendFeedbackMail({ message, userId, username, path }: FeedbackMail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) throw new Error("RESEND_API_KEY is not set")

  const from = process.env.FEEDBACK_EMAIL_FROM?.trim() || DEFAULT_FROM
  const to = process.env.FEEDBACK_EMAIL_TO?.trim() || DEFAULT_TO
  const tag = username?.replace(/^@+/, "").replace(/[\r\n]/g, "").slice(0, 40) || null
  const lines = [
    message,
    "",
    "—",
    tag ? `Tag: @${tag}` : "Tag: unknown",
    userId ? `User: ${userId}` : "User: signed out",
    path ? `Page: ${path}` : null,
  ].filter((line): line is string => Boolean(line))

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: tag ? `Sozu feedback from @${tag}` : "Sozu feedback",
      text: lines.join("\n"),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Feedback email failed (${response.status}) ${body.slice(0, 180)}`)
  }
}
