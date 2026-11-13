import { Transaction, xdr } from "@stellar/stellar-sdk"

/** Soroban resource/fees blob from a server-prepared envelope (needed after cloneFrom rebuild). */
export function extractSorobanDataXdr(
  envelopeXdr: string,
  networkPassphrase: string,
): string | null {
  try {
    const tx = new Transaction(envelopeXdr, networkPassphrase)
    const envelope = tx.toEnvelope()
    if (envelope.type !== "envelopeTypeTx") return null
    const ext = envelope.v1.tx.ext
    if (ext.type !== "sorobanData") return null
    return ext.sorobanData.toXdr("base64")
  } catch {
    return null
  }
}

export function parseSorobanDataXdr(sorobanDataXdr: string): xdr.SorobanTransactionData {
  return xdr.SorobanTransactionData.fromXDR(sorobanDataXdr, "base64")
}
