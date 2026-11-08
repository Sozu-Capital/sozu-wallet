import "server-only"

import * as rpc from "@stellar/stellar-sdk/rpc"
import { Keypair, Transaction, TransactionBuilder, xdr } from "@stellar/stellar-sdk"
import { getStellarConfig } from "@/lib/turnkey/config"
import { resolveSorobanRpcUrl } from "@/lib/stellar/soroban-env"
import { selectSorobanFeePayer } from "@/lib/stellar/select-fee-payer"
import type { StellarNetwork } from "@/lib/stellar/asset-types"

/** Classic G that pays Soroban fees (STELLAR_FUNDER_SECRET). */
export function getConfiguredFunderPublicKey(): string | null {
  const secret = process.env.STELLAR_FUNDER_SECRET?.trim()
  if (!secret) return null
  try {
    return Keypair.fromSecret(secret).publicKey()
  } catch {
    return null
  }
}

/** Server keypair for co-signing Soroban envelopes whose `source` is the funder G. */
export function getFunderKeypair(): Keypair | null {
  const secret = process.env.STELLAR_FUNDER_SECRET?.trim()
  if (!secret) return null
  try {
    return Keypair.fromSecret(secret)
  } catch {
    return null
  }
}

/**
 * Rebuild a fee-payer-sourced envelope on the fee payer's current sequence number.
 * The envelope was built when the order/payment was created; any other fee-payer tx that
 * landed since (another user's send) makes that sequence stale. Soroban auth entries are
 * copied as signed: they bind to their own nonce and expiry ledger, not the tx sequence.
 */
export async function resequenceOnFeePayer(
  server: Pick<rpc.Server, "getAccount">,
  tx: Transaction,
  networkPassphrase: string,
): Promise<Transaction> {
  const account = await server.getAccount(tx.source)
  // Copy the envelope and change only the sequence. Rebuilding with TransactionBuilder
  // adds the Soroban resource fee a second time on the SDK that CI installs.
  const body = xdr.Transaction.fromXDR(tx.toEnvelope().v1().tx().toXDR())
  const next = (BigInt(account.sequenceNumber()) + BigInt(1)).toString()
  body.seqNum(xdr.Int64.fromString(next))
  const envelope = xdr.TransactionEnvelope.envelopeTypeTx(
    new xdr.TransactionV1Envelope({ tx: body, signatures: [] }),
  )
  const rebuilt = TransactionBuilder.fromXDR(envelope.toXDR("base64"), networkPassphrase)
  if (!(rebuilt instanceof Transaction)) {
    throw new Error("Resequenced fee-payer envelope was not an inner transaction.")
  }
  return rebuilt
}

export function isBadSequenceResult(result: { status: string; errorResult?: xdr.TransactionResult }): boolean {
  if (result.status !== "ERROR" || !result.errorResult) return false
  try {
    return result.errorResult.result().switch().name === "txBadSeq"
  } catch {
    return false
  }
}

/** Shared by transfers and sponsored deploys. A second instance can still collide; callers retry on txBadSeq. */
export const FEE_PAYER_SEQUENCE_ATTEMPTS = 3

let feePayerQueue: Promise<unknown> = Promise.resolve()

/**
 * Serialize fee-payer submits inside one server instance so two requests never read the same
 * sequence number. Other instances can still collide; callers retry on txBadSeq.
 */
/**
 * Block the next fee-payer submit until this source's sequence has caught the tx we just sent.
 * `sendTransaction` returns while the tx is still pending, and `getAccount` keeps the old sequence
 * until a ledger includes it. Releasing the lock before that lets the next submit reuse it.
 */
export async function waitForSourceSequence(
  server: Pick<rpc.Server, "getAccount">,
  source: string,
  minimumSequence: string,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<boolean> {
  const attempts = opts.attempts ?? 12
  const delayMs = opts.delayMs ?? 1000
  for (let i = 0; i < attempts; i++) {
    try {
      const account = await server.getAccount(source)
      if (BigInt(account.sequenceNumber()) >= BigInt(minimumSequence)) return true
    } catch {
      /* account not visible yet */
    }
    if (i < attempts - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return false
}

export function withFeePayerLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = feePayerQueue.then(fn, fn)
  feePayerQueue = run.catch(() => undefined)
  return run
}

async function sorobanAccountExists(publicKey: string, network: StellarNetwork): Promise<boolean> {
  const rpcUrl = resolveSorobanRpcUrl()
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  try {
    await server.getAccount(publicKey.trim().toUpperCase())
    return true
  } catch {
    return false
  }
}

/** Fund a testnet G via Friendbot when it has no on-chain account yet. */
export async function ensureTestnetAccountFunded(publicKey: string): Promise<void> {
  const pk = publicKey.trim().toUpperCase()
  if (!pk.startsWith("G") || pk.length !== 56) {
    throw new Error("Invalid G address for Friendbot funding.")
  }

  if (await sorobanAccountExists(pk, "testnet")) {
    return
  }

  const cfg = getStellarConfig()
  if (cfg.network !== "testnet") {
    throw new Error(
      `Account ${pk.slice(0, 8)}… is not active on the network. Fund it with XLM before sending.`,
    )
  }

  const friendbotUrl = `${cfg.horizonUrl.replace(/\/$/, "")}/friendbot?addr=${encodeURIComponent(pk)}`
  const res = await fetch(friendbotUrl, { redirect: "follow" })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `Could not fund passkey signer ${pk.slice(0, 8)}… on testnet (Friendbot ${res.status}). ${body.slice(0, 200)}`,
    )
  }

  if (!(await sorobanAccountExists(pk, "testnet"))) {
    throw new Error(
      `Friendbot returned success but account ${pk.slice(0, 8)}… is still missing. Retry in a few seconds.`,
    )
  }
}

/**
 * Soroban txs need a funded classic G as `source` (fee payer).
 * OZ smart accounts (C) authorize via passkey; signer G does not need USDC.
 *
 * - Default: use STELLAR_FUNDER_SECRET G when configured (passkey G may be unfunded).
 * - Factory G-signer path: must use passkey G as source → fund on testnet if needed.
 */
export async function resolveSorobanFeePayer(params: {
  signerPublicKey?: string | null
  network: StellarNetwork
  requireSignerAsSource?: boolean
}): Promise<{ feePayer: string; usedFunder: boolean }> {
  const choice = selectSorobanFeePayer({
    signerPublicKey: params.signerPublicKey,
    funderPublicKey: getConfiguredFunderPublicKey(),
    requireSignerAsSource: params.requireSignerAsSource,
  })

  if (!choice.usedFunder && params.network === "testnet") {
    await ensureTestnetAccountFunded(choice.feePayer)
    return choice
  }

  if (!(await sorobanAccountExists(choice.feePayer, params.network))) {
    throw new Error(
      choice.usedFunder
        ? `STELLAR_FUNDER_SECRET account ${choice.feePayer.slice(0, 8)}… is not on ${params.network}. Fund the funder or fix .env.local.`
        : `Signer account ${choice.feePayer.slice(0, 8)}… is not on ${params.network}. Fund it with XLM first.`,
    )
  }

  return choice
}
