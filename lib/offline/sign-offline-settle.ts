"use client"

/** Prepares the vault settle, asks the passkey to sign it, then submits. Returns the tx hash. */
export async function signOfflineSettle(frame: string, settler: string): Promise<string> {
  const prepared = await fetch("/api/offline/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frame, settler }),
  })
  const build = (await prepared.json().catch(() => null)) as {
    unsignedXdr?: string
    sorobanDataXdr?: string | null
    error?: string
    settler?: string
  } | null
  if (!prepared.ok || !build?.unsignedXdr) {
    throw new Error(build?.error || "Could not prepare the settlement.")
  }

  const { getCurrentCredentialId, storeCredentialIdInSession } = await import("@/lib/storage/key-utils")
  const credentialId = await getCurrentCredentialId()
  if (!credentialId) {
    throw new Error("Sign in with your passkey, then confirm the settlement.")
  }
  storeCredentialIdInSession(credentialId)

  const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
  const { signSorobanPreparedTxWithPasskey } = await import("@/lib/stellar/smartAccounts/signSorobanUsdc")
  const { extractSorobanDataXdr } = await import("@/lib/stellar/soroban-prepared-envelope")
  const { kit, config } = await getSmartAccountKit()
  const sorobanDataXdr =
    typeof build.sorobanDataXdr === "string" && build.sorobanDataXdr.length > 0
      ? build.sorobanDataXdr
      : extractSorobanDataXdr(build.unsignedXdr, config.networkPassphrase)

  const signedEnvelopeXdr = await signSorobanPreparedTxWithPasskey({
    kit,
    unsignedXdr: build.unsignedXdr,
    sorobanDataXdr,
    networkPassphrase: config.networkPassphrase,
    credentialId,
    smartAccountContractId: (build.settler || settler).trim().toUpperCase(),
    webauthnVerifierAddress: config.webauthnVerifierAddress,
    supportsOzKitApi: false,
    signMethod: "oz_passkey",
  })

  const submitted = await fetch("/api/offline/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedEnvelopeXdr }),
  })
  const result = (await submitted.json().catch(() => null)) as { hash?: string; error?: string } | null
  if (!submitted.ok || !result?.hash) {
    throw new Error(result?.error || "The settlement did not land.")
  }
  return result.hash
}
