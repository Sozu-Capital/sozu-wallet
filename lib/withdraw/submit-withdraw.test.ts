import { describe, expect, it, vi } from "vitest"
import { Account, Address, Contract, Keypair, Networks, StrKey, TransactionBuilder } from "@stellar/stellar-sdk"
import { createMemoryIdempotencyStore, IdempotencyStoreUnavailableError } from "@/lib/idempotency/idempotency"
import { parseSacTransferEnvelope } from "@/lib/stellar/parse-sac-transfer-envelope"
import { minorToI128ScVal } from "./amount"
import { parseWithdrawDestination } from "./destination"
import { SorobanTransactionPendingError } from "@/lib/stellar/soroban-pending"
import { classifyWithdrawSubmitError, submitWithdraw } from "./submit-withdraw"
import { getWithdrawUsdcAsset } from "./usdc-asset"

const passphrase = Networks.TESTNET
const usdc = getWithdrawUsdcAsset("testnet").contractId
const senderC = StrKey.encodeContract(Buffer.alloc(32, 3))
const feePayer = Keypair.random().publicKey()
const exchangeG = Keypair.random().publicKey()
const AMOUNT = BigInt("123456789")

function transferEnvelope(opts: { to: string; amount?: bigint; from?: string; contract?: string; seq?: string }) {
  return new TransactionBuilder(new Account(feePayer, opts.seq ?? "100"), { fee: "100", networkPassphrase: passphrase })
    .addOperation(
      new Contract(opts.contract ?? usdc).call(
        "transfer",
        Address.fromString(opts.from ?? senderC).toScVal(),
        Address.fromString(opts.to).toScVal(),
        minorToI128ScVal(opts.amount ?? AMOUNT),
      ),
    )
    .setTimeout(30)
    .build()
    .toEnvelope()
    .toXDR("base64")
}

const dest = (() => {
  const r = parseWithdrawDestination(exchangeG, "987654321")
  if (!r.ok) throw new Error(r.code)
  return r.destination
})()

const expected = { contractId: usdc, from: senderC, to: dest.transferTo, amountMinor: AMOUNT }
const base = (over: Partial<Parameters<typeof submitWithdraw>[0]> = {}) => ({
  userId: "user-1",
  idempotencyKey: "9f1c2b4e-1111-4222-8333-444455556666",
  signedEnvelopeXdr: transferEnvelope({ to: dest.transferTo }),
  expected,
  networkPassphrase: passphrase,
  store: createMemoryIdempotencyStore(),
  submitEnvelope: vi.fn(async () => "a".repeat(64)),
  ...over,
})

describe("parseSacTransferEnvelope", () => {
  it("reads contract, from, muxed to and exact amount", () => {
    const r = parseSacTransferEnvelope(transferEnvelope({ to: dest.transferTo }), passphrase)
    if (!r.ok) throw new Error(r.reason)
    expect(r.intent).toMatchObject({ contractId: usdc, from: senderC, to: dest.transferTo, amountMinor: AMOUNT })
    expect(r.intent.to.startsWith("M")).toBe(true)
  })
})

describe("submitWithdraw", () => {
  it("submits the confirmed transfer and returns the hash", async () => {
    const p = base()
    const r = await submitWithdraw(p)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ success: true, transactionHash: "a".repeat(64), amountMinor: "123456789", transferTo: dest.transferTo })
    expect(p.submitEnvelope).toHaveBeenCalledTimes(1)
  })

  it("double tap: a second signature for the same payment with the same key sends once", async () => {
    const p = base()
    await submitWithdraw(p)
    const secondSignature = transferEnvelope({ to: dest.transferTo, seq: "101" })
    const replay = await submitWithdraw({ ...p, signedEnvelopeXdr: secondSignature })
    expect(replay.status).toBe(200)
    expect(replay.replayed).toBe(true)
    expect(replay.body).toMatchObject({ transactionHash: "a".repeat(64) })
    expect(p.submitEnvelope).toHaveBeenCalledTimes(1)
  })

  it("rejects envelopes that differ from what she confirmed", async () => {
    const cases: Array<[Parameters<typeof transferEnvelope>[0], string]> = [
      [{ to: exchangeG }, "wrong_destination"], // memo dropped
      [{ to: dest.transferTo, amount: AMOUNT - BigInt(1) }, "wrong_amount"],
      [{ to: dest.transferTo, from: StrKey.encodeContract(Buffer.alloc(32, 9)) }, "wrong_sender"],
      [{ to: dest.transferTo, contract: StrKey.encodeContract(Buffer.alloc(32, 5)) }, "wrong_contract"],
    ]
    for (const [env, reason] of cases) {
      const p = base({ signedEnvelopeXdr: transferEnvelope(env) })
      const r = await submitWithdraw(p)
      expect(r.status, reason).toBe(422)
      expect(r.body).toMatchObject({ code: "envelope_mismatch", reason })
      expect(p.submitEnvelope).not.toHaveBeenCalled()
    }
  })

  it("requires a valid idempotency key and a parseable envelope", async () => {
    expect((await submitWithdraw(base({ idempotencyKey: undefined }))).body).toMatchObject({ code: "invalid_idempotency_key" })
    expect((await submitWithdraw(base({ signedEnvelopeXdr: "not-xdr" }))).body).toMatchObject({ code: "invalid_envelope" })
  })

  it("fails closed when the idempotency table is missing", async () => {
    const p = base({
      store: {
        claim: async () => {
          throw new IdempotencyStoreUnavailableError("missing")
        },
        complete: async () => {},
      },
    })
    const r = await submitWithdraw(p)
    expect(r.status).toBe(503)
    expect(p.submitEnvelope).not.toHaveBeenCalled()
  })

  it("keeps the full hash of a late withdrawal and resolves it without sending again", async () => {
    const hash = "b".repeat(64)
    const lookupLedger = vi
      .fn<(_hash: string) => Promise<"SUCCESS" | "FAILED" | "PENDING">>()
      .mockResolvedValueOnce("PENDING")
      .mockResolvedValueOnce("PENDING")
      .mockResolvedValueOnce("SUCCESS")
    const p = base({
      submitEnvelope: vi.fn(async () => {
        throw new SorobanTransactionPendingError(hash)
      }),
      lookupLedger,
    })
    const first = await submitWithdraw(p)
    expect(first.status).toBe(502)
    expect(first.body).toMatchObject({ code: "submit_pending", transactionHash: hash })
    const still = await submitWithdraw(p)
    expect(still.status).toBe(502)
    expect(still.replayed).toBe(true)
    const landed = await submitWithdraw(p)
    expect(landed.status).toBe(200)
    expect(landed.body).toMatchObject({ success: true, transactionHash: hash, transferTo: dest.transferTo })
    expect(p.submitEnvelope).toHaveBeenCalledTimes(1)
  })

  it("maps submit errors to codes and stores them for the key", async () => {
    const p = base({
      submitEnvelope: vi.fn(async () => {
        throw new Error("Transaction abcd1234… is still pending on Soroban RPC.")
      }),
    })
    const r = await submitWithdraw(p)
    expect(r.body).toMatchObject({ success: false, code: "submit_pending" })
    expect((await submitWithdraw(p)).replayed).toBe(true)
    expect(p.submitEnvelope).toHaveBeenCalledTimes(1)
    expect(classifyWithdrawSubmitError("Soroban auth rejected (__check_auth)").code).toBe("submit_auth_rejected")
    expect(classifyWithdrawSubmitError("Simulation failed: x").code).toBe("submit_failed")
  })
})
