import { describe, expect, it } from "vitest"
import {
  Account,
  Address,
  Asset,
  Contract,
  Keypair,
  Networks,
  SorobanDataBuilder,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk"
import { isBadSequenceResult, resequenceOnFeePayer, withFeePayerLock } from "./soroban-fee-payer"

const funder = Keypair.random()
const usdc = new Asset("USDC", Keypair.random().publicKey()).contractId(Networks.TESTNET)

function signedLookingTransfer(sequence: string) {
  const op = new Contract(usdc).call(
    "transfer",
    Address.fromString(Keypair.random().publicKey()).toScVal(),
    Address.fromString(Keypair.random().publicKey()).toScVal(),
    nativeToScVal(BigInt(1_000_000), { type: "i128" }),
  )
  const auth = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Contract(usdc).address().toScAddress(),
          functionName: "transfer",
          args: [],
        }),
      ),
      subInvocations: [],
    }),
  })
  op.body().invokeHostFunctionOp().auth([auth])
  return new TransactionBuilder(new Account(funder.publicKey(), sequence), {
    fee: "12345",
    networkPassphrase: Networks.TESTNET,
    sorobanData: new SorobanDataBuilder().setResourceFee(5000).build(),
  })
    .addOperation(op)
    .setTimeout(60)
    .build()
}

describe("resequenceOnFeePayer", () => {
  it("moves the envelope onto the fee payer's current sequence and keeps ops, auth, fee, and soroban data", async () => {
    const stale = signedLookingTransfer("100")
    expect(stale.sequence).toBe("101")
    const server = { getAccount: async (id: string) => new Account(id, "250") }

    const fresh = await resequenceOnFeePayer(server as never, stale, Networks.TESTNET)

    expect(fresh.sequence).toBe("251")
    expect(fresh.source).toBe(funder.publicKey())
    expect(fresh.fee).toBe(stale.fee)
    expect(fresh.timeBounds).toEqual(stale.timeBounds)
    const opsXdr = (t: typeof stale) => t.toEnvelope().v1().tx().operations().map((o) => o.toXDR("base64"))
    expect(opsXdr(fresh)).toEqual(opsXdr(stale))
    expect(fresh.toEnvelope().v1().tx().ext().sorobanData().resourceFee().toString()).toBe("5000")
  })
})

describe("isBadSequenceResult", () => {
  const result = (name: "txBadSeq" | "txBadAuth") =>
    xdr.TransactionResult.fromXDR(
      new xdr.TransactionResult({
        feeCharged: xdr.Int64.fromString("100"),
        result: xdr.TransactionResultResult[name](),
        ext: new xdr.TransactionResultExt(0),
      }).toXDR(),
    )

  it("detects txBadSeq and nothing else", () => {
    expect(isBadSequenceResult({ status: "ERROR", errorResult: result("txBadSeq") })).toBe(true)
    expect(isBadSequenceResult({ status: "ERROR", errorResult: result("txBadAuth") })).toBe(false)
    expect(isBadSequenceResult({ status: "PENDING" })).toBe(false)
  })
})

describe("withFeePayerLock", () => {
  it("runs submits one at a time and keeps going after a failure", async () => {
    const events: string[] = []
    const job = (name: string, ms: number, fail = false) =>
      withFeePayerLock(async () => {
        events.push(`start ${name}`)
        await new Promise((r) => setTimeout(r, ms))
        events.push(`end ${name}`)
        if (fail) throw new Error(name)
        return name
      })

    const results = await Promise.allSettled([job("a", 20, true), job("b", 5), job("c", 1)])

    expect(events).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"])
    expect(results.map((r) => r.status)).toEqual(["rejected", "fulfilled", "fulfilled"])
  })
})
