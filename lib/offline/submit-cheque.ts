import "server-only"

import {
  Address,
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk"
import { getFunderKeypair } from "@/lib/stellar/soroban-fee-payer"
import { isValidStellarReceiveAddress } from "@/lib/payment/stellar-address"
import { chequeWire } from "@/lib/offline/cheque-frame"
import { extractSorobanDataXdr } from "@/lib/stellar/soroban-prepared-envelope"
import { chequeSubmitReason, DEMO_OFFLINE_VAULT_ID } from "@/lib/offline/vault-ledger"
import { submitSignedSorobanEnvelope } from "@/lib/stellar/send-token"

const RPC_URL = "https://soroban-testnet.stellar.org"
const VAULT = DEMO_OFFLINE_VAULT_ID

export type SubmitChequeResult =
  | { ok: true; hash: string; settler: string }
  | { ok: false; error: string; reason: "note-used" | "collateral" | "rejected" | "passkey" }

export type PrepareChequeResult =
  | {
      ok: true
      unsignedXdr: string
      sorobanDataXdr: string | null
      settler: string
    }
  | { ok: false; error: string; reason: "note-used" | "collateral" | "rejected" }

/**
 * Builds the vault settle call for the passkey account.
 * The funder only pays the fee. It is not the settler, and this does not sign.
 */
export async function prepareOfflineSettle(frame: string, settler: string): Promise<PrepareChequeResult> {
  const wire = chequeWire(frame)
  if (!wire) return failed("Cheque frame is not a 243-byte SOZU1 wire.")

  const requested = settler.trim().toUpperCase()
  if (!requested.startsWith("C") || !isValidStellarReceiveAddress(requested)) {
    return failed("The passkey account has to settle this cheque.")
  }

  const funder = getFunderKeypair()
  if (!funder) return failed("Funder is not configured.")

  const server = new rpc.Server(RPC_URL, { allowHttp: false })
  try {
    const account = await server.getAccount(funder.publicKey())
    const contract = new Contract(VAULT)
    const tx = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "settle",
          xdr.ScVal.scvBytes(wire),
          Address.fromString(requested).toScVal(),
        ),
      )
      .setTimeout(300)
      .build()

    const prepared = await server.prepareTransaction(tx)
    const unsignedXdr = prepared.toEnvelope().toXDR("base64")
    return {
      ok: true,
      unsignedXdr,
      sorobanDataXdr: extractSorobanDataXdr(unsignedXdr, Networks.TESTNET),
      settler: requested,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare the settlement."
    console.error("[offline prepare]", message)
    return failed(message)
  }
}

/** Submits an envelope the passkey already signed. The funder co-signs the fee. */
export async function submitSignedOfflineCheque(signedEnvelopeXdr: string): Promise<SubmitChequeResult> {
  try {
    const hash = await submitSignedSorobanEnvelope(signedEnvelopeXdr)
    return { ok: true, hash, settler: "" }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit the cheque."
    console.error("[offline submit]", message)
    return { ok: false, error: message, reason: chequeSubmitReason(message) }
  }
}

/**
 * Phone upload. Simulates as the passkey account and does not submit.
 * A cheque the vault already spent comes back as note-used. Anything else waits for the passkey.
 */
export async function submitOfflineCheque(frame: string, settler: string): Promise<SubmitChequeResult> {
  const prepared = await prepareOfflineSettle(frame, settler)
  if (!prepared.ok) return prepared
  return {
    ok: false,
    error: "Confirm this settlement with your passkey.",
    reason: "passkey",
  }
}

function failed(error: string): PrepareChequeResult {
  return { ok: false, error, reason: chequeSubmitReason(error) }
}
