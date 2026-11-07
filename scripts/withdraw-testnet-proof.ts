/**
 * Headless testnet proof for withdraw-all server pieces (no passkey: a throwaway G stands in for the
 * smart account and signs its own auth entry). Uses the same builder, pre-checks, envelope
 * verification, idempotency core and submitSignedSorobanEnvelope as /api/wallet/withdraw/*.
 *
 *   npx @sozu/faucet@latest claim > /tmp/faucet.json        # throwaway G with Circle testnet USDC
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/withdraw-testnet-proof.ts /tmp/faucet.json
 *
 * Never prints secrets. Testnet only.
 */
import { readFileSync, writeFileSync } from "node:fs"
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
  authorizeEntry,
  rpc,
  xdr,
} from "@stellar/stellar-sdk"
import { createMemoryIdempotencyStore } from "@/lib/idempotency/idempotency"
import { getConfiguredFunderPublicKey } from "@/lib/stellar/soroban-fee-payer"
import { submitSignedSorobanEnvelope } from "@/lib/stellar/send-token"
import { minorToDecimalString } from "@/lib/withdraw/amount"
import { parseWithdrawDestination } from "@/lib/withdraw/destination"
import { evaluateClassicDestination, fetchHorizonAccount } from "@/lib/withdraw/destination-check"
import { buildExactTokenTransfer, contractInstanceExists, readExactTokenBalance } from "@/lib/withdraw/exact-transfer"
import { submitWithdraw } from "@/lib/withdraw/submit-withdraw"
import { getWithdrawUsdcAsset, networkPassphraseFor } from "@/lib/withdraw/usdc-asset"

const network = "testnet" as const
const passphrase = networkPassphraseFor(network)
const horizonUrl = "https://horizon-testnet.stellar.org"
const horizon = new Horizon.Server(horizonUrl)
const sorobanRpc = new rpc.Server(process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org")
const usdc = getWithdrawUsdcAsset(network)
const classicUsdc = new Asset("USDC", usdc.issuer)

async function friendbot(pk: string) {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${pk}`)
  if (!res.ok) throw new Error(`friendbot ${res.status}`)
}

async function classicTx(kp: Keypair, ops: xdr.Operation[]) {
  const account = await horizon.loadAccount(kp.publicKey())
  const b = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase })
  ops.forEach((op) => b.addOperation(op))
  const tx = b.setTimeout(60).build()
  tx.sign(kp)
  return (await horizon.submitTransaction(tx)).hash
}

async function signAuthAsHolder(unsignedXdr: string, holder: Keypair): Promise<string> {
  const latest = await sorobanRpc.getLatestLedger()
  const env = xdr.TransactionEnvelope.fromXDR(unsignedXdr, "base64")
  const op = env.v1().tx().operations()[0].body().invokeHostFunctionOp()
  const signed = await Promise.all(
    op.auth().map((entry) => authorizeEntry(entry, holder, latest.sequence + 60, passphrase)),
  )
  op.auth(signed)
  return env.toXDR("base64")
}

async function checkDestination(address: string, memo: string, amountMinor: bigint) {
  const parsed = parseWithdrawDestination(address, memo)
  if (!parsed.ok) return { parse: parsed.code }
  const d = parsed.destination
  if (d.kind === "contract") return { kind: d.kind, exists: await contractInstanceExists(d.baseAddress, network) }
  return { kind: d.kind, check: evaluateClassicDestination(await fetchHorizonAccount(horizonUrl, d.baseAddress), d.baseAddress, usdc, amountMinor) }
}

async function withdrawAll(label: string, holder: Keypair, address: string, memo: string, feePayer: string) {
  const parsed = parseWithdrawDestination(address, memo)
  if (!parsed.ok) throw new Error(parsed.code)
  const dest = parsed.destination
  const balance = await readExactTokenBalance({ contractId: usdc.contractId, holder: holder.publicKey(), sourceAccount: feePayer, network })
  const pre = evaluateClassicDestination(await fetchHorizonAccount(horizonUrl, dest.baseAddress), dest.baseAddress, usdc, balance)
  if (!pre.ok) throw new Error(`pre-check ${pre.code}`)
  const destBefore = await readExactTokenBalance({ contractId: usdc.contractId, holder: dest.baseAddress, sourceAccount: feePayer, network })

  const build = () =>
    buildExactTokenTransfer({ contractId: usdc.contractId, from: holder.publicKey(), to: dest.transferTo, amountMinor: balance, feePayer, network })
  // Double tap: two independently built + signed envelopes for the same payment, both made before either lands.
  const envelopeA = await signAuthAsHolder((await build()).unsignedXdr, holder)
  const envelopeB = await signAuthAsHolder((await build()).unsignedXdr, holder)

  let submits = 0
  const store = createMemoryIdempotencyStore()
  const common = {
    userId: "proof-user",
    idempotencyKey: crypto.randomUUID(),
    expected: { contractId: usdc.contractId, from: holder.publicKey(), to: dest.transferTo, amountMinor: balance },
    networkPassphrase: passphrase,
    store,
    submitEnvelope: async (x: string) => {
      submits++
      return submitSignedSorobanEnvelope(x)
    },
  }
  const first = await submitWithdraw({ ...common, signedEnvelopeXdr: envelopeA })
  const replay = await submitWithdraw({ ...common, signedEnvelopeXdr: envelopeB })
  const tampered = await submitWithdraw({
    ...common,
    idempotencyKey: crypto.randomUUID(),
    expected: { ...common.expected, to: dest.baseAddress === dest.transferTo ? feePayer : dest.baseAddress },
    signedEnvelopeXdr: envelopeB,
  })

  const after = await readExactTokenBalance({ contractId: usdc.contractId, holder: holder.publicKey(), sourceAccount: feePayer, network })
  const destAfter = await readExactTokenBalance({ contractId: usdc.contractId, holder: dest.baseAddress, sourceAccount: feePayer, network })
  return {
    label,
    from: holder.publicKey(),
    to: dest.address,
    transferTo: dest.transferTo,
    memoId: dest.memoId,
    balanceMinor: balance.toString(),
    balanceDisplay: minorToDecimalString(balance, 7),
    firstStatus: first.status,
    firstError: first.status === 200 ? undefined : first.body,
    transactionHash: (first.body as { transactionHash?: string }).transactionHash,
    replayStatus: replay.status,
    replayed: replay.replayed,
    replaySameHash: (replay.body as { transactionHash?: string }).transactionHash === (first.body as { transactionHash?: string }).transactionHash,
    networkSubmits: submits,
    tamperedEnvelope: tampered.body,
    senderBalanceAfterMinor: after.toString(),
    destinationDeltaMinor: (destAfter - destBefore).toString(),
  }
}

async function main() {
  const faucetPath = process.argv[2]
  if (!faucetPath) throw new Error("usage: withdraw-testnet-proof.ts <faucet-claim.json>")
  const faucet = JSON.parse(readFileSync(faucetPath, "utf8")) as { wallet?: { secret?: string } }
  if (!faucet.wallet?.secret) throw new Error("faucet JSON has no wallet.secret")
  const sender = Keypair.fromSecret(faucet.wallet.secret)
  const feePayer = getConfiguredFunderPublicKey()
  if (!feePayer) throw new Error("STELLAR_FUNDER_SECRET not configured")

  const dest = Keypair.random()
  const noTrust = Keypair.random()
  // Throwaway testnet keys, kept next to the faucet JSON so funds are never stranded.
  writeFileSync(`${faucetPath}.keys.json`, JSON.stringify({ dest: dest.secret(), noTrust: noTrust.secret() }), { mode: 0o600 })
  await Promise.all([friendbot(dest.publicKey()), friendbot(noTrust.publicKey())])
  await classicTx(dest, [Operation.changeTrust({ asset: classicUsdc })])
  // Leave the sender with a non-round balance so the full-balance amount has 7 significant decimals.
  await classicTx(sender, [Operation.payment({ destination: dest.publicKey(), asset: classicUsdc, amount: "12.3456789" })])

  const probeAmount = BigInt(1)
  const prechecks = {
    unfundedG: await checkDestination(Keypair.random().publicKey(), "", probeAmount),
    fundedGNoTrustline: await checkDestination(noTrust.publicKey(), "", probeAmount),
    gWithTrustline: await checkDestination(dest.publicKey(), "", probeAmount),
    gWithTextMemo: await checkDestination(dest.publicKey(), "abc123", probeAmount),
    undeployedC: await checkDestination(StrKey.encodeContract(Keypair.random().rawPublicKey()), "", probeAmount),
    deployedC_usdcSac: await checkDestination(usdc.contractId, "", probeAmount),
  }

  const runA = await withdrawAll("A: full balance -> plain G", sender, dest.publicKey(), "", feePayer)
  const runB = await withdrawAll("B: full balance -> G + numeric memo (muxed M)", dest, sender.publicKey(), "987654321", feePayer)

  let muxedEvent: unknown = null
  if (runB.transactionHash) {
    const tx = await sorobanRpc.getTransaction(runB.transactionHash)
    if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const events = (tx as unknown as { events?: { contractEventsXdr?: xdr.ContractEvent[][] } }).events?.contractEventsXdr?.flat() ?? []
      muxedEvent = events.map((e) => {
        const body = e.body().v0()
        return {
          topics: body.topics().map((t) => (t.switch().name === "scvSymbol" ? t.sym().toString() : t.switch().name)),
          data: body.data().switch().name === "scvMap"
            ? body.data().map()!.map((m) => `${m.key().sym().toString()}=${m.val().switch().name === "scvU64" ? m.val().u64().toString() : m.val().switch().name}`)
            : body.data().switch().name,
        }
      })
    }
  }

  console.log(JSON.stringify({ usdcSac: usdc.contractId, prechecks, runA, runB, runBTransferEvents: muxedEvent }, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
