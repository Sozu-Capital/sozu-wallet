/** Unsigned Soroban build returned by server routes for passkey signing (offramp, withdraw-all). */
export type PreparedPasskeyBuild = {
  unsignedXdr: string
  sorobanDataXdr: string | null
  signMethod: string
  supportsOzKitApi: boolean
  walletAddress: string
  ozCredentialId: string | null
}

/** Signs a prepared build with the user's passkey — same path as the `oz_passkey` branch of use-send-payment. */
export async function signPreparedBuildWithPasskey(build: PreparedPasskeyBuild): Promise<string> {
  const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
  const { signSorobanPreparedTxWithPasskey } = await import("@/lib/stellar/smartAccounts/signSorobanUsdc")
  const { extractSorobanDataXdr } = await import("@/lib/stellar/soroban-prepared-envelope")
  const { getCurrentCredentialId, storeCredentialIdInSession } = await import("@/lib/storage/key-utils")
  const { kit, config } = await getSmartAccountKit()
  const credentialId = build.ozCredentialId ?? (await getCurrentCredentialId())
  if (!credentialId) throw new Error("Credential ID not found. Please log in again.")
  storeCredentialIdInSession(credentialId)
  const sorobanDataXdr =
    build.sorobanDataXdr && build.sorobanDataXdr.length > 0
      ? build.sorobanDataXdr
      : extractSorobanDataXdr(build.unsignedXdr, config.networkPassphrase)
  return signSorobanPreparedTxWithPasskey({
    kit,
    unsignedXdr: build.unsignedXdr,
    sorobanDataXdr,
    networkPassphrase: config.networkPassphrase,
    credentialId,
    smartAccountContractId: build.walletAddress,
    webauthnVerifierAddress: config.webauthnVerifierAddress,
    supportsOzKitApi: build.supportsOzKitApi === true,
    signMethod: build.signMethod,
  })
}
