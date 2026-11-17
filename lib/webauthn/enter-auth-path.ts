import type { DeviceCapabilities } from "@/lib/webauthn/device-detection"

/**
 * Decides what Enter on the lock screen should do.
 *
 * A remembered tag opens that passkey. Otherwise Enter opens the OS passkey
 * sheet immediately. Closing that sheet is how a new account starts — name,
 * recovery email, then a new passkey — not a form before the prompt.
 */
export type EnterAuthPath =
  | { action: "login-stored"; username: string }
  | { action: "passkey-prompt" }
  | { action: "unsupported" }

export function resolveEnterAuthPath(opts: {
  storedUsername: string | null
  capabilities: Pick<DeviceCapabilities, "hasWebAuthn" | "canUsePasskeys"> | null
}): EnterAuthPath {
  const username = opts.storedUsername?.trim()
  if (username && username !== "user") {
    return { action: "login-stored", username }
  }

  if (!opts.capabilities?.hasWebAuthn) {
    return { action: "unsupported" }
  }

  return { action: "passkey-prompt" }
}
