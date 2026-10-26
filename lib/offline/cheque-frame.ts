const WIRE_BYTES = 243

/** `SOZU1:` plus base64url of the 243-byte cheque wire. */
export function chequeWire(frame: string): Buffer | null {
  const text = frame.trim()
  if (!text.startsWith("SOZU1:")) return null
  const encoded = text.slice("SOZU1:".length)
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null
  const bytes = Buffer.from(encoded, "base64url")
  if (bytes.length !== WIRE_BYTES) return null
  return bytes
}
