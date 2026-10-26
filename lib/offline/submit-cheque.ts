import "server-only"

import {
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk"
import { getFunderKeypair } from "@/lib/stellar/soroban-fee-payer"
import { isValidStellarReceiveAddress } from "@/lib/payment/stellar-address"
import { chequeWire } from "@/lib/offline/cheque-frame"
import { DEMO_OFFLINE_VAULT_ID } from "@/lib/offline/vault-ledger"

const RPC_URL = "https://soroban-testnet.stellar.org"
const VAULT = DEMO_OFFLINE_VAULT_ID

export type SubmitChequeResult =
  | { ok: true; hash: string; settler: string }
  | { ok: false; error: string }

/** The phone that just got internet asks the vault to settle a cheque it already signed. */
export async function submitOfflineCheque(frame: string, settler: string): Promise<SubmitChequeResult> {
  const wire = chequeWire(frame)
  if (!wire) return { ok: false, error: "Cheque frame is not a 243-byte SOZU1 wire." }

  const funder = getFunderKeypair()
  if (!funder) return { ok: false, error: "Funder is not configured." }

  const requested = settler.trim().toUpperCase()
  const settlerAddress = isValidStellarReceiveAddress(requested) ? requested : funder.publicKey()
  const first = await invokeSettle(funder, wire, settlerAddress)
  if (first.ok || settlerAddress === funder.publicKey()) return first
  return invokeSettle(funder, wire, funder.publicKey())
}

async function invokeSettle(funder: Keypair, wire: Buffer, settler: string): Promise<SubmitChequeResult> {
  const server = new rpc.Server(RPC_URL, { allowHttp: false })
  try {
    const account = await server.getAccount(funder.publicKey())
    const contract = new Contract(VAULT)
    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "settle",
          xdr.ScVal.scvBytes(wire),
          Address.fromString(settler).toScVal(),
        ),
      )
      .setTimeout(60)
      .build()

    const prepared = await server.prepareTransaction(tx)
    prepared.sign(funder)
    const sent = await server.sendTransaction(prepared)
    if (sent.status === "ERROR") {
      return { ok: false, error: "Vault rejected the cheque." }
    }
    const hash = sent.hash
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const done = await server.getTransaction(hash)
      if (done.status === "SUCCESS") return { ok: true, hash, settler }
      if (done.status === "FAILED") return { ok: false, error: "Vault rejected the cheque." }
    }
    return { ok: true, hash, settler }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit the cheque."
    return { ok: false, error: message }
  }
}
