/**
 * Who pays the Soroban fee. Passkey accounts have no G and never pay.
 * Factory accounts (requireSignerAsSource) still use their existing G.
 */
export function selectSorobanFeePayer(params: {
  signerPublicKey?: string | null
  funderPublicKey: string | null
  requireSignerAsSource?: boolean
}): { feePayer: string; usedFunder: boolean } {
  const signer = params.signerPublicKey?.trim().toUpperCase() ?? ""
  const signerIsG = signer.startsWith("G") && signer.length === 56

  if (params.requireSignerAsSource) {
    if (!signerIsG) {
      throw new Error("Factory signer (G…) is required to sponsor this transaction.")
    }
    return { feePayer: signer, usedFunder: false }
  }

  const funder = params.funderPublicKey?.trim().toUpperCase() ?? ""
  if (funder.startsWith("G") && funder.length === 56) {
    return { feePayer: funder, usedFunder: true }
  }

  if (signerIsG) {
    return { feePayer: signer, usedFunder: false }
  }

  throw new Error("STELLAR_FUNDER_SECRET is required. Passkey accounts do not hold XLM.")
}
