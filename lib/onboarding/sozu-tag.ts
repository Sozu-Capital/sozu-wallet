export type TagStatus = "idle" | "typing" | "checking" | "available" | "taken" | "invalid" | "error"

export type TagCheckPhase = "checking" | "available" | "taken" | "error"

/** Client alternatives when a tag is taken. Year suffix is the last two digits. */
export function sozuTagSuggestions(tag: string, year = new Date().getFullYear()): string[] {
  const base = tag.slice(0, 30)
  const yy = String(year % 100).padStart(2, "0")
  const raw = [`${base}_sozu`, `${base}${yy}`, `${base}wallet`]
  const seen = new Set<string>()
  const out: string[] = []

  for (const candidate of raw) {
    const next = candidate.slice(0, 30)
    const key = next.toLowerCase()
    if (next.length < 3 || key === base.toLowerCase() || seen.has(key)) continue
    if (!/^[a-zA-Z0-9_]+$/.test(next)) continue
    seen.add(key)
    out.push(next)
  }

  return out
}

/**
 * Field status while the user is typing. A taken or available result only
 * appears after the debounced check writes `phase`.
 */
export function tagFieldStatus(input: {
  value: string
  focused: boolean
  phase: TagCheckPhase | null
  showInvalid: boolean
}): TagStatus {
  const { value, focused, phase, showInvalid } = input
  if (value.length === 0) return focused ? "typing" : "idle"
  if (value.length < 3) return showInvalid || !focused ? "invalid" : "typing"
  return phase ?? "typing"
}
