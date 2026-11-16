import { Transaction, xdr } from "@stellar/stellar-sdk"
import { xdrField, xdrType } from "@/lib/stellar/xdr-access"

/** Soroban resource/fees blob from a server-prepared envelope (needed after cloneFrom rebuild). */
export function extractSorobanDataXdr(
  envelopeXdr: string,
  networkPassphrase: string,
): string | null {
  try {
    const tx = new Transaction(envelopeXdr, networkPassphrase)
    const envelope = tx.toEnvelope()
    if (xdrType(envelope) !== "envelopeTypeTx") return null
    const ext = xdrField<object>(xdrField<object>(xdrField(envelope, "v1"), "tx"), "ext")
    if (xdrType(ext) !== "sorobanData") return null
    return xdrField<{ toXDR: (encoding: string) => string }>(ext, "sorobanData").toXDR("base64")
  } catch {
    return null
  }
}

export function parseSorobanDataXdr(sorobanDataXdr: string): xdr.SorobanTransactionData {
  return xdr.SorobanTransactionData.fromXDR(sorobanDataXdr, "base64")
}
