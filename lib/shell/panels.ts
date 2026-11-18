/** Wallet panels, left to right. Collections is the panel after History. */
export const PANEL_NAMES = ["settings", "home", "history", "collections"] as const

export type PanelName = (typeof PANEL_NAMES)[number]

export function panelIndex(name: string | null): number {
  if (!name) return 1
  const idx = PANEL_NAMES.indexOf(name as PanelName)
  if (idx >= 0) return idx
  if (name === "wallet") return 1
  return 1
}

/** Only a wallet panel deep link may be used as a post-auth return path. */
export function panelAuthReturnPath(value: string | null): string | null {
  const raw = value?.trim() ?? ""
  if (!raw.startsWith("/home?") && !raw.startsWith("/home#")) return null
  try {
    const url = new URL(raw, "http://local")
    if (url.pathname !== "/home") return null
    const panel = url.searchParams.get("panel")
    if (!panel || !PANEL_NAMES.includes(panel as PanelName)) return null
    return `/home?panel=${panel}`
  } catch {
    return null
  }
}
